const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const KALSHI_EVENTS_API = "/api/kalshi/events";
const KALSHI_MARKETS_API = "/api/kalshi/markets";
const POLYMARKET_EVENTS_API = "/api/events";
const POLYMARKET_MARKETS_API = "/api/markets";

// --- Cache ---
const finderCache = new Map();
const FINDER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// --- Rate limiting ---
const RATE_LIMIT_KEY = "polyalpha_finder_searches";
const MAX_SEARCHES_PER_HOUR = 10;

function getRateLimitState() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { searches: [], count: 0 };
    const data = JSON.parse(raw);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recent = (data.searches || []).filter((ts) => ts > oneHourAgo);
    return { searches: recent, count: recent.length };
  } catch {
    return { searches: [], count: 0 };
  }
}

function recordSearch() {
  const state = getRateLimitState();
  state.searches.push(Date.now());
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ searches: state.searches }));
}

export function getSearchesRemaining() {
  const { count } = getRateLimitState();
  return Math.max(0, MAX_SEARCHES_PER_HOUR - count);
}

function canSearch() {
  return getSearchesRemaining() > 0;
}

function getApiKey() {
  return localStorage.getItem("polyalpha_api_key") || "";
}

// --- Stop words for fallback keyword extraction ---
const STOP_WORDS = new Set([
  "will", "the", "be", "a", "an", "of", "in", "to", "by", "or", "and",
  "on", "for", "is", "it", "its", "this", "that", "any", "before",
  "after", "another", "which", "what", "who", "when", "where", "how",
  "than", "has", "have", "was", "were", "been", "being", "are",
  "do", "does", "did", "not", "no", "yes", "win", "become", "get",
  "next", "first", "over", "under", "more", "less", "about", "between",
]);

function naiveKeywords(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

// ============================================================
// STEP 1: Extract source market identity
// Resolves tickers, slugs, and URLs into human-readable titles
// by calling the source platform's API.
// ============================================================

/**
 * Detect if the user input looks like a ticker/slug rather than
 * a human-readable question. Tickers are typically:
 *   - ALL CAPS with dashes/numbers: KXTRDBAN-25DEC31, INX-BTC-150K
 *   - URL slugs: will-bitcoin-exceed-150000
 *   - Polymarket URLs: https://polymarket.com/event/...
 *   - Kalshi URLs: https://kalshi.com/markets/...
 */
function looksLikeTicker(input) {
  // URL
  if (input.startsWith("http://") || input.startsWith("https://")) return true;
  // Kalshi ticker pattern: uppercase letters + dashes + optional numbers
  if (/^[A-Z0-9]+-[A-Z0-9-]+$/.test(input)) return true;
  // Slug pattern: lowercase-words-with-dashes, no spaces
  if (/^[a-z0-9]+(-[a-z0-9]+){2,}$/.test(input) && !input.includes(" ")) return true;
  // Very short input with no spaces (likely a ticker)
  if (input.length < 30 && !input.includes(" ") && /[-_]/.test(input)) return true;
  return false;
}

/**
 * Resolve a Kalshi ticker into a real market/event title.
 * Tries: market ticker → event ticker → prefix search on events.
 */
async function resolveKalshiTicker(input) {
  // Strip URL prefix if present
  let ticker = input;
  const kalshiUrlMatch = input.match(/kalshi\.com\/markets\/([^/?#]+)/i);
  if (kalshiUrlMatch) ticker = kalshiUrlMatch[1].toUpperCase();

  // Try as a market ticker first
  try {
    const res = await fetch(`${KALSHI_MARKETS_API}?ticker=${ticker}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      const markets = data.markets || [];
      if (markets.length > 0) {
        const m = markets[0];
        return {
          title: m.title || m.subtitle || m.yes_sub_title || ticker,
          event_title: m.event_title || "",
          yes_sub_title: m.yes_sub_title || "",
          yesBid: m.yes_bid != null ? (m.yes_bid / 100).toFixed(2) : null,
          yesAsk: m.yes_ask != null ? (m.yes_ask / 100).toFixed(2) : null,
          noBid: m.no_bid != null ? (m.no_bid / 100).toFixed(2) : null,
          noAsk: m.no_ask != null ? (m.no_ask / 100).toFixed(2) : null,
        };
      }
    }
  } catch {}

  // Try as an event ticker
  try {
    const res = await fetch(`${KALSHI_EVENTS_API}?event_ticker=${ticker}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      const events = data.events || [];
      if (events.length > 0) {
        return {
          title: events[0].title || events[0].sub_title || ticker,
          event_title: events[0].title || "",
        };
      }
    }
  } catch {}

  // Try prefix match: strip trailing date parts and search
  // e.g., KXTRDBAN-25DEC31 → search events for "KXTRDBAN"
  const prefix = ticker.split("-")[0];
  if (prefix && prefix !== ticker) {
    try {
      const allEvents = await fetchAllKalshiEvents();
      const match = allEvents.find((e) =>
        e.event_ticker === prefix ||
        e.event_ticker.startsWith(prefix) ||
        e.series_ticker === prefix
      );
      if (match) {
        // Now fetch the specific market within this event
        const markets = await fetchKalshiEventMarkets(match.event_ticker);
        const specific = markets.find((m) => m.ticker === ticker);
        if (specific) {
          return {
            title: specific.title || specific.subtitle || specific.yes_sub_title || match.title,
            event_title: match.title,
            yes_sub_title: specific.yes_sub_title || "",
            yesBid: specific.yes_bid != null ? (specific.yes_bid / 100).toFixed(2) : null,
            yesAsk: specific.yes_ask != null ? (specific.yes_ask / 100).toFixed(2) : null,
            noBid: specific.no_bid != null ? (specific.no_bid / 100).toFixed(2) : null,
            noAsk: specific.no_ask != null ? (specific.no_ask / 100).toFixed(2) : null,
          };
        }
        // Return the event title even if we didn't find the specific market
        return { title: match.title, event_title: match.title };
      }
    } catch {}
  }

  return null; // Could not resolve
}

/**
 * Resolve a Polymarket slug or URL into a real market title.
 */
async function resolvePolymarketSlug(input) {
  let slug = input;
  // Extract slug from URL
  const urlMatch = input.match(/polymarket\.com\/event\/([^/?#]+)/i);
  if (urlMatch) slug = urlMatch[1];

  try {
    const res = await fetch(`${POLYMARKET_EVENTS_API}?slug=${slug}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const event = data[0];
        const markets = event.markets || [];
        let yesPrice = null, noPrice = null;
        if (markets.length > 0) {
          try {
            const prices = JSON.parse(markets[0].outcomePrices || "[]");
            if (prices.length >= 1) yesPrice = parseFloat(prices[0]).toFixed(2);
            if (prices.length >= 2) noPrice = parseFloat(prices[1]).toFixed(2);
          } catch {}
        }
        return {
          title: event.title || markets[0]?.question || slug,
          yesPrice,
          noPrice,
        };
      }
    }
  } catch {}

  // Try as a market slug
  try {
    const res = await fetch(`${POLYMARKET_MARKETS_API}?slug=${slug}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const m = data[0];
        let yesPrice = null, noPrice = null;
        try {
          const prices = JSON.parse(m.outcomePrices || "[]");
          if (prices.length >= 1) yesPrice = parseFloat(prices[0]).toFixed(2);
          if (prices.length >= 2) noPrice = parseFloat(prices[1]).toFixed(2);
        } catch {}
        return {
          title: m.question || m.title || slug,
          yesPrice,
          noPrice,
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Given user input (could be a title, ticker, slug, or URL),
 * resolve it into a structured source identity with a real title.
 */
async function extractSourceIdentity(marketTitle, yesPrice, noPrice, basePlatform, onProgress) {
  // If it already looks like a human-readable question, use as-is
  if (!looksLikeTicker(marketTitle)) {
    return {
      title: marketTitle,
      specificOutcome: null,
      yesPrice,
      noPrice,
      platform: basePlatform,
      resolvedFromTicker: false,
    };
  }

  onProgress?.(1, `Resolving ${basePlatform} ticker to market title...`);

  let resolved = null;
  if (basePlatform === "Kalshi") {
    resolved = await resolveKalshiTicker(marketTitle);
  } else {
    resolved = await resolvePolymarketSlug(marketTitle);
  }

  if (!resolved) {
    // Could not resolve — use the raw input, Claude will do its best
    console.warn(`Could not resolve ticker/slug: ${marketTitle}`);
    return {
      title: marketTitle,
      specificOutcome: null,
      yesPrice,
      noPrice,
      platform: basePlatform,
      resolvedFromTicker: false,
    };
  }

  // Build a descriptive title from what we resolved
  let resolvedTitle = resolved.title;
  if (resolved.event_title && resolved.event_title !== resolved.title) {
    // This is a specific outcome within an event
    // e.g., title="Yes" event_title="Will X happen?" → use event_title
    // or title="Michigan" event_title="NCAA Winner" → combine
    if (resolved.yes_sub_title) {
      resolvedTitle = `${resolved.event_title}: ${resolved.yes_sub_title}`;
    } else {
      resolvedTitle = resolved.event_title;
    }
  }

  // Use resolved prices if user didn't provide them
  const finalYesPrice = (yesPrice && yesPrice !== "0.50") ? yesPrice : (resolved.yesBid || resolved.yesPrice || yesPrice);
  const finalNoPrice = (noPrice && noPrice !== "0.50") ? noPrice : (resolved.noBid || resolved.noPrice || noPrice);

  return {
    title: resolvedTitle,
    originalInput: marketTitle,
    specificOutcome: resolved.yes_sub_title || null,
    yesPrice: finalYesPrice,
    noPrice: finalNoPrice,
    platform: basePlatform,
    resolvedFromTicker: true,
  };
}

// ============================================================
// STEP 2: Generate smart search terms via Claude
// ============================================================

async function generateSearchTerms(source, onProgress) {
  const apiKey = getApiKey();

  const prompt = `You are a prediction market expert. Extract structured search data from this market.

Market title: "${source.title}"
Specific outcome being priced: "${source.specificOutcome || "N/A — this is the overall event"}"
Source platform: "${source.platform}"

Respond ONLY in JSON. No markdown, no backticks, no explanation.

{
  "primary_keywords": ["3-5 words that MUST appear in a matching market title"],
  "secondary_keywords": ["3-5 alternative phrasings, abbreviations, or synonyms"],
  "category": "sports | politics | crypto | economics | entertainment | science | geopolitics | tech | other",
  "event_type": "winner | yes_no | over_under | date_based | numeric_range",
  "normalized_question": "One sentence restating the core question in plain English, removing platform-specific phrasing",
  "specific_outcome": "If this market prices a specific outcome within a broader event (e.g., 'Michigan' in 'NCAA Tournament Winner'), extract that outcome name. Otherwise null."
}`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
    const data = await res.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) throw new Error("No text response");

    let jsonStr = textBlock.text.trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonStr);

    // Update specific outcome if Claude found one
    if (parsed.specific_outcome) {
      source.specificOutcome = parsed.specific_outcome;
    }

    return parsed;
  } catch (err) {
    console.warn("Claude keyword extraction failed, using fallback:", err.message);
    // Fallback: naive keyword extraction
    const words = naiveKeywords(source.title);
    return {
      primary_keywords: words.slice(0, 5),
      secondary_keywords: words.slice(5, 10),
      category: "other",
      event_type: "yes_no",
      normalized_question: source.title,
      specific_outcome: null,
    };
  }
}

// ============================================================
// STEP 3: Search target platform with extracted keywords
// ============================================================

/**
 * Fetch all open Kalshi events (with 5-min cache), paginating if needed.
 */
async function fetchAllKalshiEvents() {
  const cacheKey = "kalshi-all-events";
  const entry = finderCache.get(cacheKey);
  if (entry && Date.now() - entry.ts < FINDER_CACHE_TTL) return entry.data;

  const allEvents = [];
  let cursor = null;

  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({ status: "open", limit: "200" });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${KALSHI_EVENTS_API}?${params}`);
    if (!res.ok) throw new Error(`Kalshi events API error: ${res.status}`);

    const data = await res.json();
    const events = data.events || [];
    allEvents.push(...events);

    cursor = data.cursor;
    if (!cursor || events.length < 200) break;
  }

  finderCache.set(cacheKey, { data: allEvents, ts: Date.now() });
  return allEvents;
}

/**
 * Fetch markets for a specific Kalshi event.
 */
async function fetchKalshiEventMarkets(eventTicker) {
  const cacheKey = `kalshi-event-markets:${eventTicker}`;
  const entry = finderCache.get(cacheKey);
  if (entry && Date.now() - entry.ts < FINDER_CACHE_TTL) return entry.data;

  const res = await fetch(`${KALSHI_MARKETS_API}?event_ticker=${eventTicker}&status=open&limit=100`);
  if (!res.ok) throw new Error(`Kalshi markets API error: ${res.status}`);

  const data = await res.json();
  const markets = data.markets || [];
  finderCache.set(cacheKey, { data: markets, ts: Date.now() });
  return markets;
}

/**
 * Fetch all open Polymarket events (with 5-min cache), paginating if needed.
 */
async function fetchAllPolymarketEvents() {
  const cacheKey = "polymarket-all-events";
  const entry = finderCache.get(cacheKey);
  if (entry && Date.now() - entry.ts < FINDER_CACHE_TTL) return entry.data;

  const allEvents = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const res = await fetch(`${POLYMARKET_EVENTS_API}?active=true&closed=false&limit=100&offset=${offset}`);
    if (!res.ok) throw new Error(`Polymarket events API error: ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    allEvents.push(...data);
    if (data.length < 100) break;
  }

  finderCache.set(cacheKey, { data: allEvents, ts: Date.now() });
  return allEvents;
}

/**
 * Filter events by keyword matching. Returns matching events.
 */
function filterByKeywords(items, titleField, searchTerms) {
  const { primary_keywords, secondary_keywords } = searchTerms;

  // Try primary keywords first
  let matches = items.filter((item) => {
    const title = (item[titleField] || "").toLowerCase();
    return primary_keywords.some((kw) => title.includes(kw.toLowerCase()));
  });

  // If zero: try secondary keywords
  if (matches.length === 0 && secondary_keywords?.length) {
    matches = items.filter((item) => {
      const title = (item[titleField] || "").toLowerCase();
      return secondary_keywords.some((kw) => title.includes(kw.toLowerCase()));
    });
  }

  // If still zero: try each primary keyword individually (broadest search)
  if (matches.length === 0) {
    for (const kw of primary_keywords) {
      const kwLower = kw.toLowerCase();
      const found = items.filter((item) =>
        (item[titleField] || "").toLowerCase().includes(kwLower)
      );
      if (found.length > 0) {
        matches = found;
        break;
      }
    }
  }

  return matches;
}

/**
 * Search Kalshi for matching markets.
 * Returns a flat list of candidate markets with event context.
 */
async function searchKalshi(searchTerms, specificOutcome) {
  const allEvents = await fetchAllKalshiEvents();

  // Filter events by keywords
  const matchingEvents = filterByKeywords(allEvents, "title", searchTerms);
  if (matchingEvents.length === 0) return [];

  // Fetch markets for matching events (limit to top 10 events to stay fast)
  const topEvents = matchingEvents.slice(0, 10);
  const marketResults = await Promise.all(
    topEvents.map(async (event) => {
      const markets = await fetchKalshiEventMarkets(event.event_ticker);
      return markets.map((m) => ({
        ticker: m.ticker,
        title: m.title || m.subtitle || "",
        yes_sub_title: m.yes_sub_title || "",
        event_ticker: m.event_ticker,
        event_title: event.title,
        yesBid: m.yes_bid != null ? (m.yes_bid / 100) : null,
        yesAsk: m.yes_ask != null ? (m.yes_ask / 100) : null,
        noBid: m.no_bid != null ? (m.no_bid / 100) : null,
        noAsk: m.no_ask != null ? (m.no_ask / 100) : null,
        volume24h: m.volume_24h || 0,
        rules_primary: m.rules_primary || "",
        expiration_time: m.expiration_time || "",
      }));
    })
  );

  let candidates = marketResults.flat();

  // If specific outcome, further filter
  if (specificOutcome) {
    const outcomeLower = specificOutcome.toLowerCase();
    const outcomeFiltered = candidates.filter((m) => {
      const sub = (m.yes_sub_title || m.title || "").toLowerCase();
      return sub.includes(outcomeLower) || outcomeLower.includes(sub.split(" ").pop());
    });
    if (outcomeFiltered.length > 0) {
      candidates = outcomeFiltered;
    }
    // If no outcome match, keep all candidates — Claude will pick the best
  }

  return candidates.slice(0, 30);
}

/**
 * Search Polymarket for matching markets.
 * Returns a flat list of candidate markets with event context.
 */
async function searchPolymarket(searchTerms, specificOutcome) {
  const allEvents = await fetchAllPolymarketEvents();

  // Filter events by keywords
  const matchingEvents = filterByKeywords(allEvents, "title", searchTerms);
  if (matchingEvents.length === 0) return [];

  // Extract individual markets from events
  let candidates = [];
  for (const event of matchingEvents.slice(0, 10)) {
    const markets = event.markets || [];
    for (const m of markets) {
      let yesPrice = null;
      let noPrice = null;
      try {
        const prices = JSON.parse(m.outcomePrices || "[]");
        if (prices.length >= 1) yesPrice = parseFloat(prices[0]);
        if (prices.length >= 2) noPrice = parseFloat(prices[1]);
      } catch {}

      candidates.push({
        id: m.conditionId || m.id,
        title: m.question || m.title || "",
        groupTitle: m.groupItemTitle || "",
        slug: m.slug || "",
        eventSlug: event.slug || "",
        eventTitle: event.title || "",
        yesPrice: yesPrice != null ? yesPrice : null,
        noPrice: noPrice != null ? noPrice : null,
        volume24h: parseFloat(m.volume24hr) || 0,
      });
    }
  }

  candidates = candidates.filter((m) => m.title && m.yesPrice != null);

  // If specific outcome, further filter
  if (specificOutcome) {
    const outcomeLower = specificOutcome.toLowerCase();
    const outcomeFiltered = candidates.filter((m) => {
      const combined = `${m.title} ${m.groupTitle}`.toLowerCase();
      return combined.includes(outcomeLower);
    });
    if (outcomeFiltered.length > 0) {
      candidates = outcomeFiltered;
    }
  }

  return candidates.slice(0, 30);
}

// ============================================================
// STEP 4: AI matching on the shortlist
// ============================================================

async function matchOnShortlist(source, candidates, targetPlatform) {
  const apiKey = getApiKey();
  const sourcePlatform = source.platform;

  const prompt = `You are comparing prediction markets across platforms to find identical or equivalent bets.

SOURCE BET (on ${sourcePlatform}):
- Title: "${source.title}"
- Specific outcome: "${source.specificOutcome || "Overall event"}"
- YES price: $${source.yesPrice}
- NO price: $${source.noPrice}

CANDIDATE MARKETS ON ${targetPlatform} (${candidates.length} candidates):
${JSON.stringify(candidates, null, 0)}

RULES:
- "exact": Same event, same outcome, same resolution date. Prices are directly comparable.
- "similar": Same underlying event but slightly different resolution criteria, date, or phrasing. Prices are roughly comparable but user should verify.
- "none": No candidate matches the source bet. Do NOT force a match. Return found: false.

If a specific_outcome was provided (e.g., "Michigan"), you MUST match at the outcome level, not just the event level. "NCAA Tournament Winner" event existing on ${targetPlatform} is NOT a match unless the specific "Michigan" outcome market also exists.

Respond ONLY in JSON. No markdown, no backticks.

{
  "found": true or false,
  "matchQuality": "exact" | "similar" | "none",
  "matchedMarket": {
    "ticker": "TICKER_ID or market id",
    "title": "Full market title on target platform",
    "event_title": "Parent event title if applicable",
    "yesBid": 0.XX,
    "yesAsk": 0.XX,
    "noBid": 0.XX,
    "noAsk": 0.XX
  } or null,
  "explanation": "One sentence explaining why this is/isn't a match",
  "keyDifferences": "If similar: what differs. null if exact or none.",
  "recommendation": "Actionable advice for the user",
  "allCandidatesConsidered": ${candidates.length},
  "similarMarkets": [
    {
      "ticker": "TICKER",
      "title": "title",
      "matchQuality": "similar" | "related",
      "whyShown": "why this is relevant",
      "keyDifference": "critical difference"
    }
  ]
}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Claude API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) throw new Error("No text response from Claude");

  let jsonStr = textBlock.text.trim();
  jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(jsonStr);
}

// ============================================================
// STEP 5: Build comparison & arbitrage analysis
// ============================================================

function buildAnalysis(source, matchResult, targetPlatform) {
  const basePlatform = source.platform;
  const matched = matchResult.matchedMarket;

  if (!matchResult.found || !matched) {
    return {
      match: {
        found: false,
        matchQuality: "none",
        explanation: matchResult.explanation || `No matching market found on ${targetPlatform}.`,
      },
      comparison: null,
      arbitrage: null,
      similarMarkets: matchResult.similarMarkets || [],
      candidatesConsidered: matchResult.allCandidatesConsidered || 0,
    };
  }

  const sourceYes = parseFloat(source.yesPrice);
  const sourceNo = parseFloat(source.noPrice);
  const targetYesBid = parseFloat(matched.yesBid) || 0;
  const targetYesAsk = parseFloat(matched.yesAsk) || targetYesBid;
  const targetNoBid = parseFloat(matched.noBid) || 0;
  const targetNoAsk = parseFloat(matched.noAsk) || targetNoBid;

  // Determine best prices
  const bestYesPlatform = sourceYes <= targetYesBid ? basePlatform : targetPlatform;
  const bestNoPlatform = sourceNo <= targetNoBid ? basePlatform : targetPlatform;
  const savingsPerShare = Math.abs(sourceYes - targetYesBid);

  // Arbitrage calculation
  // Strategy 1: YES on source + NO on target
  const combo1 = sourceYes + targetNoAsk;
  // Strategy 2: YES on target + NO on source
  const combo2 = targetYesAsk + sourceNo;

  const useCombo1 = combo1 <= combo2;
  const bestCombo = useCombo1 ? combo1 : combo2;

  // Fee calculation (in dollar terms, prices are 0-1)
  const POLY_RATE = 0.04;
  const KALSHI_RATE = 0.07;

  let totalFees = 0;
  if (useCombo1) {
    // YES on source, NO on target
    const yesP = sourceYes;
    const noP = targetNoAsk;
    const yesFee = basePlatform === "Polymarket"
      ? POLY_RATE * yesP * (1 - yesP)
      : KALSHI_RATE * yesP * (1 - yesP);
    const noFee = targetPlatform === "Polymarket"
      ? POLY_RATE * noP * (1 - noP)
      : KALSHI_RATE * noP * (1 - noP);
    totalFees = yesFee + noFee;
  } else {
    const yesP = targetYesAsk;
    const noP = sourceNo;
    const yesFee = targetPlatform === "Polymarket"
      ? POLY_RATE * yesP * (1 - yesP)
      : KALSHI_RATE * yesP * (1 - yesP);
    const noFee = basePlatform === "Polymarket"
      ? POLY_RATE * noP * (1 - noP)
      : KALSHI_RATE * noP * (1 - noP);
    totalFees = yesFee + noFee;
  }

  const grossProfit = 1.0 - bestCombo;
  const netProfit = grossProfit - totalFees;
  const isArbitrage = netProfit > 0;

  return {
    match: {
      found: true,
      matchQuality: matchResult.matchQuality,
      explanation: matchResult.explanation,
      keyDifferences: matchResult.keyDifferences,
      recommendation: matchResult.recommendation,
      targetTicker: matched.ticker,
      targetTitle: matched.title,
      targetEvent: matched.event_title || matched.title,
    },
    comparison: {
      sourceYes,
      sourceNo,
      targetYesBid,
      targetYesAsk,
      targetNoBid,
      targetNoAsk,
      bestYesPlatform,
      bestNoPlatform,
      savingsPerShare,
    },
    arbitrage: {
      detected: isArbitrage,
      grossProfit,
      netProfit,
      totalFees,
      bestComboTotal: bestCombo,
      strategy: useCombo1
        ? `Buy YES on ${basePlatform} ($${sourceYes.toFixed(2)}) + NO on ${targetPlatform} ($${targetNoAsk.toFixed(2)})`
        : `Buy YES on ${targetPlatform} ($${targetYesAsk.toFixed(2)}) + NO on ${basePlatform} ($${sourceNo.toFixed(2)})`,
      buyYesPlatform: useCombo1 ? basePlatform : targetPlatform,
      buyYesPrice: useCombo1 ? sourceYes : targetYesAsk,
      buyNoPlatform: useCombo1 ? targetPlatform : basePlatform,
      buyNoPrice: useCombo1 ? targetNoAsk : sourceNo,
      profitOn1000: isArbitrage ? Math.round((netProfit / bestCombo) * 1000) : 0,
    },
    similarMarkets: matchResult.similarMarkets || [],
    candidatesConsidered: matchResult.allCandidatesConsidered || 0,
  };
}

// ============================================================
// PUBLIC API — Main pipeline
// ============================================================

/**
 * Full 4-step funnel pipeline:
 * 1. Extract source market identity
 * 2. Generate smart search terms via Claude
 * 3. Search target platform with keywords
 * 4. AI matching on shortlist
 * 5. Build comparison & arbitrage analysis
 *
 * @param {Object} params
 * @param {string} params.marketTitle
 * @param {string} params.yesPrice
 * @param {string} params.noPrice
 * @param {string} params.basePlatform - "Polymarket" or "Kalshi"
 * @param {function} params.onProgress - callback(step, message) for UI updates
 * @returns {Object} Full analysis result
 */
export async function findBestPrice({ marketTitle, yesPrice, noPrice, basePlatform, onProgress }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_REQUIRED");
  if (!canSearch()) throw new Error("RATE_LIMITED");

  // Check cache
  const cacheKey = `finder:${basePlatform}:${marketTitle}:${yesPrice}:${noPrice}`;
  const cached = finderCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < FINDER_CACHE_TTL) return cached.data;

  const progress = onProgress || (() => {});
  const isFromPolymarket = basePlatform === "Polymarket";
  const targetPlatform = isFromPolymarket ? "Kalshi" : "Polymarket";

  // Step 1: Extract source identity
  progress(1, "Extracting market identity...");
  const source = extractSourceIdentity(marketTitle, yesPrice, noPrice, basePlatform);

  // Step 2: Generate search terms
  progress(2, "Generating search terms with AI...");
  const searchTerms = await generateSearchTerms(source);

  // Step 3: Search target platform
  progress(3, `Searching ${targetPlatform} markets...`);
  let candidates;
  if (isFromPolymarket) {
    candidates = await searchKalshi(searchTerms, source.specificOutcome);
  } else {
    candidates = await searchPolymarket(searchTerms, source.specificOutcome);
  }

  if (candidates.length === 0) {
    recordSearch();
    const result = {
      match: { found: false, matchQuality: "none", explanation: `No matching markets found on ${targetPlatform}.` },
      comparison: null,
      arbitrage: null,
      similarMarkets: [],
      candidatesConsidered: 0,
      searchedAt: Date.now(),
      basePlatform,
      targetPlatform,
      marketsScanned: 0,
      searchTerms,
    };
    finderCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  }

  // Step 4: AI matching
  progress(4, `Matching ${candidates.length} candidates with AI...`);
  recordSearch();
  const matchResult = await matchOnShortlist(source, candidates, targetPlatform);

  // Step 5: Build analysis
  progress(5, "Calculating arbitrage...");
  const analysis = buildAnalysis(source, matchResult, targetPlatform);

  const enhanced = {
    ...analysis,
    searchedAt: Date.now(),
    basePlatform,
    targetPlatform,
    marketsScanned: candidates.length,
    searchTerms,
  };

  finderCache.set(cacheKey, { data: enhanced, ts: Date.now() });
  return enhanced;
}
