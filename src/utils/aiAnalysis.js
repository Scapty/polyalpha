/**
 * AI Enrichment — explains the algo score, does NOT change it
 *
 * enrichWithAI(address, metrics, scoringResult) → { reasoning, strategy, keySignals }
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function getApiKey() {
  return localStorage.getItem("polyalpha_api_key") || "";
}

async function callAI(prompt) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No API key");

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
      max_tokens: 350,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function enrichWithAI(address, metrics, scoringResult) {
  const prompt =
    `Analyze this Polymarket trader. The bot score is already determined (${scoringResult.score}/100, ${scoringResult.classification}). ` +
    `Your job is to EXPLAIN why and identify the strategy. Do NOT change the classification.\n\n` +
    `METRICS:\n` +
    `- Trade fills: ${metrics.tradeCount}${metrics.apiCapReached ? "+" : ""} (one order can create multiple fills due to CLOB splitting)\n` +
    `- Estimated actual orders: ${metrics.estimatedOrders} (${metrics.estimatedOrdersPerDay}/day)\n` +
    `- Period: ${metrics.daySpan} days, ${metrics.totalUniqueMarkets} unique markets\n` +
    `- Focus ratio: ${metrics.focusRatio} orders/market\n\n` +
    `SIZE ANALYSIS:\n` +
    `- Size CV: ${metrics.sizeCV ?? "N/A"} (< 0.05 = machine-identical, > 1.0 = human-varied)\n` +
    `- Avg trade value: $${metrics.avgTradeSize ?? "N/A"}\n\n` +
    `ACTIVITY:\n` +
    `- Avg hours/day: ${metrics.avgHoursPerDay}\n` +
    `- Longest sleep gap: ${metrics.maxSleepGapHours} hours\n\n` +
    `BEHAVIOR:\n` +
    `- Both-sides trading: ${metrics.bothSidesPct}% of markets\n` +
    `- Buy/sell: ${metrics.buyCount} buys, ${metrics.sellCount} sells (${metrics.sellRatio}% sells)\n` +
    `- Short-term crypto: ${metrics.shortTermCryptoPct}%\n` +
    `- Categories: ${JSON.stringify(metrics.categories)}\n\n` +
    `SCORING FACTORS:\n` +
    Object.entries(scoringResult.factors || {})
      .map(([k, v]) => `- ${k}: ${v.score}/100 (${v.detail})`)
      .join("\n") +
    `\n\nKNOWN PATTERNS:\n` +
    `- Latency arb bot: identical sizes (CV<0.05), exclusively 15-min crypto, 98%+ win rate\n` +
    `- Market maker bot: buys AND sells same market, 200+ orders/day, uniform sizing\n` +
    `- Human whale (Theo): few markets, varied sizes (CV>3), politics, holds to resolution, 0 sells\n` +
    `- Human: sleep gap 6-8h, round bet sizes, focus ratio 2-10\n\n` +
    `Respond in JSON only:\n` +
    `{\n  "reasoning": "2-3 sentences using actual numbers",\n  "strategy": "latency arb / market making / arb / conviction betting / news-driven / other",\n  "keySignals": ["signal1", "signal2", "signal3"]\n}`;

  try {
    const text = await callAI(prompt);
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { reasoning: null, strategy: "unknown", keySignals: [] };
  }
}
