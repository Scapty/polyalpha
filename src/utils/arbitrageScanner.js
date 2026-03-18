import { getMarketCategory } from "./api";

// Minimum gap to count as a real opportunity (filter rounding noise)
const MIN_GAP = 0.01; // $0.01

/**
 * Scan a list of markets for Type 1 arbitrage: YES + NO < $1.00
 * Returns array of opportunity objects.
 */
export function scanForArbitrage(markets) {
  const opportunities = [];

  for (const market of markets) {
    let prices;
    try {
      prices = JSON.parse(market.outcomePrices || "[]");
    } catch {
      continue;
    }

    // Only binary markets (exactly 2 outcomes)
    if (!Array.isArray(prices) || prices.length !== 2) continue;

    const yesPrice = parseFloat(prices[0]);
    const noPrice = parseFloat(prices[1]);

    if (isNaN(yesPrice) || isNaN(noPrice)) continue;

    const total = yesPrice + noPrice;
    const gap = 1.0 - total;

    if (gap >= MIN_GAP) {
      opportunities.push({
        id: market.conditionId || market.id,
        question: market.question || "Unknown Market",
        slug: market.slug || "",
        yesPrice,
        noPrice,
        total,
        gap,
        profitPct: (gap / total) * 100,
        volume24hr: parseFloat(market.volume24hr) || 0,
        liquidity: parseFloat(market.liquidity) || 0,
        category: getMarketCategory(market),
        detectedAt: Date.now(),
      });
    }
  }

  // Sort by gap descending (biggest opportunities first)
  opportunities.sort((a, b) => b.gap - a.gap);

  return opportunities;
}

/**
 * Compare current scan with previous scan to detect closed opportunities.
 * Returns { newOpps, closedOpps, stillOpen }.
 */
export function diffScans(currentOpps, previousOpps) {
  const currentIds = new Set(currentOpps.map((o) => o.id));
  const previousIds = new Set(previousOpps.map((o) => o.id));

  const newOpps = currentOpps.filter((o) => !previousIds.has(o.id));
  const closedOpps = previousOpps.filter((o) => !currentIds.has(o.id));
  const stillOpen = currentOpps.filter((o) => previousIds.has(o.id));

  return { newOpps, closedOpps, stillOpen };
}

/**
 * Generate the insight text from history data.
 */
export function generateInsight(history, marketCount) {
  if (history.length === 0) {
    return `Scanning ${marketCount} active markets for arbitrage opportunities. No opportunities detected yet — keep the scanner running to capture real-time pricing inefficiencies.`;
  }

  const totalOpps = history.length;
  const durations = history.filter((h) => h.durationSec != null).map((h) => h.durationSec);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;
  const profits = history.map((h) => h.gap * Math.min(h.liquidity, 10000));
  const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;

  // Category breakdown
  const cats = {};
  for (const h of history) {
    cats[h.category] = (cats[h.category] || 0) + 1;
  }
  const topCategory = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  const topCatPct = Math.round((topCategory[1] / totalOpps) * 100);

  let text = `In the scanning period, ${totalOpps} arbitrage ${totalOpps === 1 ? "opportunity was" : "opportunities were"} detected across ${marketCount} markets.`;

  if (avgDuration != null) {
    text += ` The average opportunity lasted ${avgDuration} seconds and offered $${avgProfit.toFixed(2)} in estimated risk-free profit.`;
  }

  if (topCategory) {
    text += ` ${topCatPct}% of opportunities occurred in ${topCategory[0]} markets.`;
  }

  text += ` The speed at which these gaps close suggests automated trading bots are actively arbitraging — a human trader would need to detect, decide, and execute within seconds to capture these profits.`;

  return text;
}
