import { getMarketCategory } from "./api";

// Minimum gap to count as a real opportunity (filter rounding noise)
const MIN_GAP = 0.005; // $0.005 — 0.5%

/**
 * Scan negRisk events for multi-outcome arbitrage.
 *
 * For each event whose outcomes are mutually exclusive (negRisk = true),
 * the sum of all YES best-ask prices should equal ~$1.00.
 *
 *  - If sumAsk < 1.00 → buy all outcomes for guaranteed profit ("Underpriced")
 *  - If sumBid > 1.00 → sell all outcomes for guaranteed profit ("Overpriced")
 *
 * We use bestBid/bestAsk from the Gamma API (real CLOB orderbook prices),
 * NOT outcomePrices (which are mid-point and always sum to ~1.0).
 */
export function scanForArbitrage(events) {
  const opportunities = [];

  for (const event of events) {
    if (!event.enableNegRisk) continue;

    const markets = event.markets || [];
    if (markets.length < 2) continue;

    // Collect real orderbook prices for each outcome
    const outcomes = [];
    let hasAllPrices = true;

    for (const m of markets) {
      const bestAsk = parseFloat(m.bestAsk);
      const bestBid = parseFloat(m.bestBid);

      if (isNaN(bestAsk) || bestAsk <= 0) {
        hasAllPrices = false;
        break;
      }

      outcomes.push({
        title: m.groupItemTitle || m.question || "Unknown",
        bestAsk,
        bestBid: isNaN(bestBid) ? 0 : bestBid,
        liquidity: parseFloat(m.liquidity) || 0,
        volume24hr: parseFloat(m.volume24hr) || 0,
        spread: parseFloat(m.spread) || 0,
        conditionId: m.conditionId,
      });
    }

    if (!hasAllPrices) continue;

    // --- Type A: Buy all outcomes (sum of asks < $1.00) ---
    const sumAsk = outcomes.reduce((s, o) => s + o.bestAsk, 0);
    const gapBuy = 1.0 - sumAsk;

    if (gapBuy >= MIN_GAP) {
      const minLiquidity = Math.min(...outcomes.map((o) => o.liquidity));
      opportunities.push({
        id: event.id || event.slug,
        title: event.title || "Unknown Event",
        slug: event.slug || "",
        image: event.image || event.icon || "",
        type: "buy_all",
        typeLabel: "Buy All Outcomes",
        outcomeCount: outcomes.length,
        sumAsk,
        sumBid: outcomes.reduce((s, o) => s + o.bestBid, 0),
        gap: gapBuy,
        profitPct: (gapBuy / sumAsk) * 100,
        liquidity: minLiquidity,
        totalLiquidity: parseFloat(event.liquidity) || 0,
        volume24hr: parseFloat(event.volume24hr) || 0,
        category: getMarketCategory({ question: event.title }),
        outcomes,
        detectedAt: Date.now(),
      });
    }

    // --- Type B: Sell all outcomes (sum of bids > $1.00) ---
    const sumBid = outcomes.reduce((s, o) => s + o.bestBid, 0);
    const gapSell = sumBid - 1.0;

    if (gapSell >= MIN_GAP) {
      const minLiquidity = Math.min(...outcomes.map((o) => o.liquidity));
      opportunities.push({
        id: `${event.id || event.slug}-sell`,
        title: event.title || "Unknown Event",
        slug: event.slug || "",
        image: event.image || event.icon || "",
        type: "sell_all",
        typeLabel: "Sell All Outcomes",
        outcomeCount: outcomes.length,
        sumAsk,
        sumBid,
        gap: gapSell,
        profitPct: (gapSell / 1.0) * 100,
        liquidity: minLiquidity,
        totalLiquidity: parseFloat(event.liquidity) || 0,
        volume24hr: parseFloat(event.volume24hr) || 0,
        category: getMarketCategory({ question: event.title }),
        outcomes,
        detectedAt: Date.now(),
      });
    }
  }

  // Sort by gap descending (biggest opportunities first)
  opportunities.sort((a, b) => b.gap - a.gap);
  return opportunities;
}

/**
 * Build "near miss" list — events closest to arbitrage.
 * Only includes events with no placeholder outcomes (bestAsk < 0.99 for all)
 * so the data is meaningful.
 */
export function buildNearMisses(events, limit = 5) {
  const entries = [];

  for (const event of events) {
    if (!event.enableNegRisk) continue;

    const markets = event.markets || [];
    if (markets.length < 2) continue;

    let sumAsk = 0;
    let sumBid = 0;
    let valid = true;
    let placeholders = 0;

    for (const m of markets) {
      const bestAsk = parseFloat(m.bestAsk);
      const bestBid = parseFloat(m.bestBid);
      if (isNaN(bestAsk) || bestAsk <= 0) { valid = false; break; }
      if (bestAsk >= 0.99) placeholders++;
      sumAsk += bestAsk;
      sumBid += isNaN(bestBid) ? 0 : bestBid;
    }

    if (!valid) continue;

    // Skip events dominated by placeholder markets — data isn't meaningful
    if (placeholders > markets.length * 0.3) continue;

    const distanceBuy = sumAsk - 1.0; // how far above $1.00 (positive = no arb yet)
    const distanceSell = 1.0 - sumBid; // how far below $1.00 (positive = no arb yet)

    // Pick the side closer to arbitrage
    const bestDistance = Math.min(distanceBuy, distanceSell);
    const bestSide = distanceBuy <= distanceSell ? "buy_all" : "sell_all";

    entries.push({
      id: event.id || event.slug,
      title: event.title || "Unknown",
      slug: event.slug || "",
      outcomeCount: markets.length,
      sumAsk,
      sumBid,
      distance: bestDistance,
      side: bestSide,
      volume24hr: parseFloat(event.volume24hr) || 0,
      category: getMarketCategory({ question: event.title }),
    });
  }

  // Sort by distance ascending (closest to arb first), exclude already-arb (<= 0)
  return entries
    .filter((e) => e.distance > 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Compare current scan with previous scan to detect new/closed opportunities.
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
 * Generate insight text from live + history data.
 */
export function generateInsight(liveOpps, history, eventCount) {
  const total = liveOpps.length + history.length;

  if (total === 0) {
    return `Scanning ${eventCount} active events for multi-outcome arbitrage. No opportunities detected yet — the scanner checks real orderbook prices (best bid/ask) every 30 seconds.`;
  }

  const allOpps = [...liveOpps, ...history];
  const buyAll = allOpps.filter((o) => o.type === "buy_all").length;
  const sellAll = allOpps.filter((o) => o.type === "sell_all").length;
  const avgGap = allOpps.reduce((s, o) => s + o.gap, 0) / allOpps.length;

  const durations = history.filter((h) => h.durationSec != null).map((h) => h.durationSec);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  // Category breakdown
  const cats = {};
  for (const o of allOpps) {
    cats[o.category] = (cats[o.category] || 0) + 1;
  }
  const topCategory = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];

  let text = `${total} arbitrage ${total === 1 ? "opportunity" : "opportunities"} detected across ${eventCount} events.`;
  text += ` ${buyAll} underpriced (buy all) and ${sellAll} overpriced (sell all).`;
  text += ` Average gap: ${(avgGap * 100).toFixed(2)}%.`;

  if (avgDuration != null) {
    text += ` Closed opportunities lasted an average of ${avgDuration} seconds.`;
  }

  if (topCategory) {
    const pct = Math.round((topCategory[1] / total) * 100);
    text += ` ${pct}% of opportunities are in ${topCategory[0]} markets.`;
  }

  return text;
}
