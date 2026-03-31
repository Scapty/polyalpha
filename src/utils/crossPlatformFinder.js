const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const KALSHI_MARKETS_API = "/api/kalshi-markets";
const KALSHI_EVENTS_API = "/api/kalshi-events";
const POLYMARKET_API = "/api/markets";

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

// --- Fetch Kalshi markets ---
async function fetchKalshiMarkets() {
  const cacheKey = "kalshi-all";
  const entry = finderCache.get(cacheKey);
  if (entry && Date.now() - entry.ts < FINDER_CACHE_TTL) return entry.data;

  const [marketsRes, eventsRes] = await Promise.all([
    fetch(`${KALSHI_MARKETS_API}?status=open&limit=1000`),
    fetch(`${KALSHI_EVENTS_API}?status=open&limit=200`),
  ]);

  if (!marketsRes.ok) throw new Error(`Kalshi markets API error: ${marketsRes.status}`);
  if (!eventsRes.ok) throw new Error(`Kalshi events API error: ${eventsRes.status}`);

  const marketsData = await marketsRes.json();
  const eventsData = await eventsRes.json();

  const markets = marketsData.markets || [];
  const events = eventsData.events || [];

  const eventMap = new Map();
  for (const e of events) {
    eventMap.set(e.event_ticker, e.title || e.sub_title || e.event_ticker);
  }

  const condensed = markets.map((m) => ({
    ticker: m.ticker,
    title: m.title || m.subtitle || m.yes_sub_title || "",
    event: eventMap.get(m.event_ticker) || m.event_ticker,
    yesBid: m.yes_bid != null ? (m.yes_bid / 100).toFixed(2) : null,
    yesAsk: m.yes_ask != null ? (m.yes_ask / 100).toFixed(2) : null,
    noBid: m.no_bid != null ? (m.no_bid / 100).toFixed(2) : null,
    noAsk: m.no_ask != null ? (m.no_ask / 100).toFixed(2) : null,
    volume24h: m.volume_24h || 0,
  }));

  const result = { markets: condensed, raw: markets, eventMap };
  finderCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}

// --- Fetch Polymarket markets ---
async function fetchPolymarketMarkets() {
  const cacheKey = "polymarket-all";
  const entry = finderCache.get(cacheKey);
  if (entry && Date.now() - entry.ts < FINDER_CACHE_TTL) return entry.data;

  const res = await fetch(`${POLYMARKET_API}?limit=500&active=true&closed=false`);
  if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("No Polymarket markets");

  const condensed = data.map((m) => {
    let yesPrice = null;
    let noPrice = null;
    try {
      const prices = JSON.parse(m.outcomePrices || "[]");
      if (prices.length >= 1) yesPrice = parseFloat(prices[0]).toFixed(2);
      if (prices.length >= 2) noPrice = parseFloat(prices[1]).toFixed(2);
    } catch {}

    return {
      id: m.conditionId || m.id,
      title: m.question || m.title || "",
      groupTitle: m.groupItemTitle || "",
      slug: m.slug || "",
      yesPrice,
      noPrice,
      volume24h: parseFloat(m.volume24hr) || 0,
    };
  }).filter((m) => m.title && m.yesPrice != null);

  const result = { markets: condensed };
  finderCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}

// --- Claude matching (bidirectional) ---
async function matchWithClaude(apiKey, userMarketTitle, userYesPrice, userNoPrice, targetMarkets, basePlatform) {
  const marketSubset = targetMarkets.slice(0, 500);

  const isFromPolymarket = basePlatform === "Polymarket";
  const sourcePlatform = isFromPolymarket ? "Polymarket" : "Kalshi";
  const targetPlatform = isFromPolymarket ? "Kalshi" : "Polymarket";

  // Build the market data description based on target platform
  const marketFields = isFromPolymarket
    ? "ticker, title, event, yesBid, yesAsk, noBid, noAsk, volume24h"
    : "id, title, groupTitle, slug, yesPrice, noPrice, volume24h";

  const prompt = `I have a bet on ${sourcePlatform} and I want to find the same or similar bet on ${targetPlatform}.

My ${sourcePlatform} bet: "${userMarketTitle}"
${sourcePlatform} YES price: $${userYesPrice}
${sourcePlatform} NO price: $${userNoPrice}

Here are currently open ${targetPlatform} markets (JSON array with ${marketFields}):
${JSON.stringify(marketSubset, null, 0)}

Find the ${targetPlatform} market that matches or is most similar to my ${sourcePlatform} bet.

Respond ONLY in valid JSON, no markdown, no backticks, no explanation outside the JSON:
{
  "match": {
    "found": true or false,
    "targetTicker": "ticker/id or null",
    "targetTitle": "market title on ${targetPlatform} or null",
    "targetEvent": "event title or null",
    "matchQuality": "exact" | "similar" | "related" | "none",
    "explanation": "why this is a match (1 sentence)"
  },
  "comparison": {
    "sourceYes": ${userYesPrice},
    "sourceNo": ${userNoPrice},
    "targetYesBid": 0.XX or null,
    "targetYesAsk": 0.XX or null,
    "targetNoBid": 0.XX or null,
    "targetNoAsk": 0.XX or null,
    "targetVolume24h": number,
    "bestYesPlatform": "${sourcePlatform}" or "${targetPlatform}",
    "bestNoPlatform": "${sourcePlatform}" or "${targetPlatform}",
    "savingsPerShare": 0.XX
  },
  "arbitrage": {
    "detected": true or false,
    "strategy": "description string or null",
    "totalCost": 0.XX or null,
    "profitPercent": X.X or null
  },
  "similarMarkets": [
    {
      "ticker": "ticker/id",
      "title": "title",
      "event": "event or empty",
      "yesBid": 0.XX,
      "relevance": "brief note"
    }
  ]
}

Rules:
- If you find an exact or very similar match, put it in "match" and leave "similarMarkets" empty
- If no exact match, set match.found=false and list up to 3 related markets in "similarMarkets"
- For arbitrage: check if buying YES on the cheaper platform + NO on the other totals less than $1.00
- Use the bid prices (what you can actually buy at) for comparison
- For Polymarket targets: yesPrice is the bid, there is no separate ask
- Only output the JSON object, nothing else`;

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
      max_tokens: 1000,
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

  const parsed = JSON.parse(jsonStr);

  // Normalize response to use consistent field names for the UI
  // Map targetTicker/targetTitle back to kalshi*/polymarket* fields for backward compat
  const normalized = { ...parsed };
  if (normalized.match) {
    if (isFromPolymarket) {
      normalized.match.kalshiTicker = normalized.match.targetTicker || null;
      normalized.match.kalshiTitle = normalized.match.targetTitle || null;
      normalized.match.kalshiEvent = normalized.match.targetEvent || null;
    } else {
      normalized.match.polymarketId = normalized.match.targetTicker || null;
      normalized.match.polymarketTitle = normalized.match.targetTitle || null;
    }
  }
  if (normalized.comparison) {
    if (isFromPolymarket) {
      normalized.comparison.polymarketYes = normalized.comparison.sourceYes;
      normalized.comparison.polymarketNo = normalized.comparison.sourceNo;
      normalized.comparison.kalshiYesBid = normalized.comparison.targetYesBid;
      normalized.comparison.kalshiYesAsk = normalized.comparison.targetYesAsk;
      normalized.comparison.kalshiNoBid = normalized.comparison.targetNoBid;
      normalized.comparison.kalshiNoAsk = normalized.comparison.targetNoAsk;
      normalized.comparison.kalshiVolume24h = normalized.comparison.targetVolume24h;
    } else {
      normalized.comparison.kalshiYes = normalized.comparison.sourceYes;
      normalized.comparison.kalshiNo = normalized.comparison.sourceNo;
      normalized.comparison.polymarketYes = normalized.comparison.targetYesBid;
      normalized.comparison.polymarketNo = normalized.comparison.targetNoBid;
      normalized.comparison.polymarketVolume24h = normalized.comparison.targetVolume24h;
    }
  }

  return normalized;
}

// --- Main search function ---
export async function findBestPrice({ marketTitle, yesPrice, noPrice, basePlatform }) {
  const apiKey = localStorage.getItem("polyalpha_api_key") || "";
  if (!apiKey) {
    throw new Error("API_KEY_REQUIRED");
  }

  if (!canSearch()) {
    throw new Error("RATE_LIMITED");
  }

  // Check cache
  const cacheKey = `finder:${basePlatform}:${marketTitle}:${yesPrice}:${noPrice}`;
  const cached = finderCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < FINDER_CACHE_TTL) {
    return cached.data;
  }

  const isFromPolymarket = basePlatform === "Polymarket";

  // Fetch the OPPOSITE platform's markets
  let targetMarkets;
  let marketsScanned;
  if (isFromPolymarket) {
    const { markets } = await fetchKalshiMarkets();
    targetMarkets = markets;
    marketsScanned = markets.length;
    if (targetMarkets.length === 0) throw new Error("KALSHI_UNAVAILABLE");
  } else {
    const { markets } = await fetchPolymarketMarkets();
    targetMarkets = markets;
    marketsScanned = markets.length;
    if (targetMarkets.length === 0) throw new Error("POLYMARKET_UNAVAILABLE");
  }

  // Match with Claude
  recordSearch();
  const result = await matchWithClaude(apiKey, marketTitle, yesPrice, noPrice, targetMarkets, basePlatform);

  const targetPlatform = isFromPolymarket ? "Kalshi" : "Polymarket";
  const enhanced = {
    ...result,
    searchedAt: Date.now(),
    basePlatform,
    targetPlatform,
    marketsScanned,
    // backward compat
    kalshiMarketsScanned: isFromPolymarket ? marketsScanned : undefined,
    polymarketMarketsScanned: !isFromPolymarket ? marketsScanned : undefined,
  };

  finderCache.set(cacheKey, { data: enhanced, ts: Date.now() });
  return enhanced;
}
