import { getMarketCategory, fetchKalshiEventMarkets } from "./api";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function getApiKey() {
  return localStorage.getItem("polyalpha_api_key") || "";
}

// ============================================================
// STEP 1: Extract keywords and find candidate pairs
// ============================================================

const STOP_WORDS = new Set([
  "will", "the", "be", "a", "an", "of", "in", "to", "by", "or", "and",
  "on", "for", "is", "it", "its", "this", "that", "any", "before",
  "after", "another", "which", "what", "who", "when", "where", "how",
  "than", "has", "have", "was", "were", "been", "being", "are",
  "do", "does", "did", "not", "no", "yes", "win", "become", "get",
  "next", "first",
]);

function extractKeywords(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  const inter = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

/**
 * Group Polymarket markets by their parent event.
 * Multiple markets (outcomes) belong to the same event.
 */
function groupPolyByEvent(polymarkets) {
  const events = {};
  for (const pm of polymarkets) {
    const evts = pm.events || [];
    const eventSlug = evts.length > 0 ? evts[0].slug : pm.slug;
    const eventTitle = evts.length > 0 ? evts[0].title : pm.question || pm.title;
    if (!events[eventSlug]) {
      events[eventSlug] = {
        slug: eventSlug,
        title: eventTitle,
        category: getMarketCategory({ question: eventTitle }),
        markets: [],
      };
    }
    events[eventSlug].markets.push(pm);
  }
  return Object.values(events);
}

/**
 * Find candidate pairs between Polymarket events and Kalshi events.
 * Uses keyword overlap as a pre-filter.
 */
function findCandidates(polyEvents, kalshiEvents, maxCandidates = 30) {
  const candidates = [];

  for (const ke of kalshiEvents) {
    const keKw = extractKeywords(ke.title || "");
    if (keKw.length < 2) continue;

    for (const pe of polyEvents) {
      const peKw = extractKeywords(pe.title || "");
      if (peKw.length < 2) continue;

      const score = jaccardSimilarity(keKw, peKw);
      if (score >= 0.2) {
        candidates.push({ kalshiEvent: ke, polyEvent: pe, similarity: score });
      }
    }
  }

  candidates.sort((a, b) => b.similarity - a.similarity);

  // Deduplicate: keep best match per Kalshi event
  const seen = new Set();
  const deduped = [];
  for (const c of candidates) {
    const key = c.kalshiEvent.event_ticker;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(c);
    }
  }
  return deduped.slice(0, maxCandidates);
}

// ============================================================
// STEP 2: Claude validates which candidates are real matches
// ============================================================

async function validateWithClaude(candidates) {
  const apiKey = getApiKey();
  if (!apiKey || candidates.length === 0) {
    // No API key: strict fallback (only very high similarity)
    return candidates
      .filter((c) => c.similarity >= 0.55)
      .map((c) => ({ ...c, confirmed: true, claudeValidated: false }));
  }

  const list = candidates.map((c, i) =>
    `${i + 1}. Kalshi: "${c.kalshiEvent.title}" | Polymarket: "${c.polyEvent.title}"`
  ).join("\n");

  const prompt = `You compare prediction markets across platforms. Below are candidate pairs between Kalshi and Polymarket events, matched by keyword overlap.

CANDIDATES:
${list}

For each pair, determine if they refer to THE SAME real-world event. Be STRICT:
- "Next PM of Hungary" ≠ "Next PM of UK" (different countries)
- "Presidential Election 2028 (Party)" = "Which party wins 2028 Presidency" (same question)
- "James Bond villain" ≠ "James Bond actor" (different questions)
- "Elon Musk visits Mars" ≠ "Elon Musk trillionaire" (different topics)

Respond with ONLY a JSON array:
[{"index":1,"match":true,"reason":"Same event - both about 2028 US presidential election winner"},...]`;

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
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Claude API: ${res.status}`);
    const data = await res.json();

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const results = JSON.parse(jsonMatch[0]);

    return candidates
      .map((c, i) => {
        const r = results.find((x) => x.index === i + 1);
        return { ...c, confirmed: r?.match === true, claudeValidated: true, claudeReason: r?.reason || "" };
      })
      .filter((c) => c.confirmed);
  } catch (err) {
    console.warn("Claude validation failed:", err.message);
    return candidates
      .filter((c) => c.similarity >= 0.55)
      .map((c) => ({ ...c, confirmed: true, claudeValidated: false }));
  }
}

// ============================================================
// STEP 3: Build outcome-level comparisons with real prices
// ============================================================

/**
 * For each confirmed match, compare individual outcomes across platforms.
 * E.g., "JD Vance" on Polymarket vs "J.D. Vance" on Kalshi.
 */
async function buildComparisons(confirmedMatches) {
  const comparisons = [];

  // Fetch Kalshi markets for all confirmed matches in parallel
  const fetchResults = await Promise.all(
    confirmedMatches.map(async (match) => {
      const kalshiMarkets = await fetchKalshiEventMarkets(match.kalshiEvent.event_ticker);
      return { match, kalshiMarkets };
    })
  );

  for (const { match, kalshiMarkets } of fetchResults) {
    if (kalshiMarkets.length === 0) continue;

    const polyMarkets = match.polyEvent.markets || [];
    const kalshiSeries = match.kalshiEvent.series_ticker || "";
    const eventSlug = match.polyEvent.slug || "";

    // Build a lookup of Kalshi outcomes by normalized name
    const kalshiByName = {};
    for (const km of kalshiMarkets) {
      const name = (km.yes_sub_title || "").toLowerCase().trim();
      if (name) kalshiByName[name] = km;
    }

    // For each Polymarket outcome, try to find matching Kalshi outcome
    for (const pm of polyMarkets) {
      const polyOutcome = pm.groupItemTitle || "";
      if (!polyOutcome) continue;

      let polyYesPrice = null;
      try {
        const prices = JSON.parse(pm.outcomePrices || "[]");
        if (prices.length >= 1) polyYesPrice = parseFloat(prices[0]);
      } catch {}
      if (polyYesPrice == null || isNaN(polyYesPrice) || polyYesPrice <= 0) continue;

      // Find Kalshi match by name (fuzzy)
      const polyNameLower = polyOutcome.toLowerCase().trim();
      let kalshiMatch = kalshiByName[polyNameLower];

      // Fuzzy: try partial match
      if (!kalshiMatch) {
        for (const [kName, kMarket] of Object.entries(kalshiByName)) {
          if (kName.includes(polyNameLower) || polyNameLower.includes(kName)) {
            kalshiMatch = kMarket;
            break;
          }
          // Try last name match (e.g., "Vance" in "J.D. Vance")
          const polyParts = polyNameLower.split(/\s+/);
          const kParts = kName.split(/\s+/);
          const polyLast = polyParts[polyParts.length - 1];
          const kLast = kParts[kParts.length - 1];
          if (polyLast.length > 3 && polyLast === kLast) {
            kalshiMatch = kMarket;
            break;
          }
        }
      }

      if (!kalshiMatch) continue;

      const kalshiBid = parseFloat(kalshiMatch.yes_bid_dollars) || 0;
      const kalshiAsk = parseFloat(kalshiMatch.yes_ask_dollars) || 0;
      if (kalshiBid === 0 && kalshiAsk === 0) continue;

      const kalshiMid = kalshiBid > 0 && kalshiAsk > 0
        ? (kalshiBid + kalshiAsk) / 2
        : kalshiAsk > 0 ? kalshiAsk : kalshiBid;

      const diff = polyYesPrice - kalshiMid;
      const absDiff = Math.abs(diff);

      comparisons.push({
        id: `${match.kalshiEvent.event_ticker}-${pm.conditionId || pm.id}`,
        // Event
        eventTitle: match.kalshiEvent.title,
        category: match.polyEvent.category || "Other",
        // Outcome
        outcome: polyOutcome,
        kalshiOutcome: kalshiMatch.yes_sub_title || "",
        // Titles
        polyTitle: pm.question || pm.title || "",
        kalshiTitle: match.kalshiEvent.title,
        // URLs
        polyUrl: `https://polymarket.com/event/${eventSlug}`,
        kalshiUrl: `https://kalshi.com/markets/${kalshiSeries.toLowerCase()}`,
        // Validation
        claudeValidated: match.claudeValidated,
        claudeReason: match.claudeReason || "",
        // Prices
        polyYesPrice,
        kalshiBid,
        kalshiAsk,
        kalshiMid,
        // Comparison
        priceDiff: diff,
        absDiff,
        bestPlatform: diff > 0.005 ? "Kalshi" : diff < -0.005 ? "Polymarket" : "Equal",
        savingsPerShare: absDiff,
        // Volume
        polyVolume: parseFloat(pm.volume24hr) || 0,
        kalshiVolume: parseFloat(kalshiMatch.volume_fp) || 0,
        // Resolution conditions (for AI comparison)
        polyMarketSlug: pm.slug || "",
        polyDescription: pm.description || "",
        polyEndDate: pm.endDate || "",
        kalshiRules: kalshiMatch.rules_primary || "",
        kalshiRulesSecondary: kalshiMatch.rules_secondary || "",
        kalshiExpiration: kalshiMatch.expiration_time || "",
      });
    }
  }

  comparisons.sort((a, b) => b.absDiff - a.absDiff);
  return comparisons;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Full pipeline:
 * 1. Group Polymarket markets by event
 * 2. Find candidate pairs by keyword similarity
 * 3. Validate with Claude
 * 4. Build outcome-level comparisons with real prices
 */
export async function findCrossMarketComparisons(polymarketMarkets, kalshiEvents) {
  // Step 1: Group Polymarket markets by parent event
  const polyEvents = groupPolyByEvent(polymarketMarkets);

  // Step 2: Find candidates
  const candidates = findCandidates(polyEvents, kalshiEvents);
  if (candidates.length === 0) return [];

  // Step 3: Validate with Claude
  const confirmed = await validateWithClaude(candidates);
  if (confirmed.length === 0) return [];

  // Step 4: Build outcome-level comparisons
  return buildComparisons(confirmed);
}

/**
 * Fetch Polymarket description for a market and compare resolution conditions
 * with Kalshi using Claude. Returns a structured analysis.
 */
export async function compareResolutionConditions(comparison) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      same_bet: null,
      risk_level: "unknown",
      key_differences: ["API key required for AI comparison"],
      deadline_comparison: "Set your Anthropic API key in the header to enable AI analysis.",
      resolution_comparison: "The AI will compare exact resolution conditions from both platforms.",
      price_explanation: "Price differences usually reflect different deadlines or resolution criteria.",
      recommendation: "Click 'Set API Key' in the top-right corner, then try Ask AI again.",
      no_api_key: true,
    };
  }

  // Fetch full Polymarket description if not already available
  let polyDesc = comparison.polyDescription || "";
  if (!polyDesc && comparison.polyMarketSlug) {
    try {
      const res = await fetch(`/api/markets?slug=${comparison.polyMarketSlug}&limit=1`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        polyDesc = data[0].description || "";
      }
    } catch {}
  }

  const polyEndDate = comparison.polyEndDate
    ? new Date(comparison.polyEndDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Not specified";

  const kalshiExpDate = comparison.kalshiExpiration
    ? new Date(comparison.kalshiExpiration).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Not specified";

  const prompt = `You are a prediction market analyst. Compare these two markets from different platforms and determine if they are the SAME bet or different bets.

POLYMARKET:
- Market: "${comparison.polyTitle}"
- Outcome: "${comparison.outcome || "YES"}"
- YES price: ${(comparison.polyYesPrice * 100).toFixed(1)}¢
- Deadline: ${polyEndDate}
- Resolution conditions: ${polyDesc || "Not available"}

KALSHI:
- Market: "${comparison.kalshiTitle}"
- Outcome: "${comparison.kalshiOutcome || "YES"}"
- YES price: ${(comparison.kalshiMid * 100).toFixed(1)}¢
- Deadline: ${kalshiExpDate}
- Resolution rules: ${comparison.kalshiRules || "Not available"}
- Additional rules: ${comparison.kalshiRulesSecondary || "None"}

Analyze in this exact JSON format (no other text):
{
  "same_bet": true/false,
  "risk_level": "low"/"medium"/"high",
  "key_differences": ["difference 1", "difference 2"],
  "deadline_comparison": "one sentence comparing the deadlines",
  "resolution_comparison": "one sentence comparing resolution criteria",
  "price_explanation": "one sentence explaining why the prices differ",
  "recommendation": "one sentence actionable advice for the user"
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
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Claude API: ${res.status}`);
    const data = await res.json();

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn("AI comparison failed:", err.message);
    return {
      same_bet: null,
      risk_level: "unknown",
      key_differences: ["AI comparison unavailable"],
      deadline_comparison: "Could not compare",
      resolution_comparison: "Could not compare",
      price_explanation: "Could not determine",
      recommendation: "Manually check resolution conditions on both platforms before trading.",
    };
  }
}
