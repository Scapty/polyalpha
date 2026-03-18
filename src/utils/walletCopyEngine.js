/**
 * Wallet Copy Trading Simulator
 * Uses REAL trade data to simulate what would happen if you copied a trader's moves.
 *
 * Approach: Take the trader's actual trades, simulate applying them proportionally
 * to a starting capital. For matched buy-sell pairs, compute actual P&L from price
 * differences. For unmatched trades, use price-based heuristic.
 */

function getTimestamp(trade) {
  if (trade.match_time) return new Date(trade.match_time).getTime();
  if (typeof trade.timestamp === "number") {
    return trade.timestamp > 1e12 ? trade.timestamp : trade.timestamp * 1000;
  }
  if (trade.created_at) return new Date(trade.created_at).getTime();
  return null;
}

/**
 * Simulate copy-trading based on real trade data
 * @param {Array} trades - Array of real trade objects from the API
 * @param {number} initialAmount - Starting capital in USD
 * @param {number} maxTrades - Number of most recent trades to simulate
 * @returns {Object} Simulation results with equity curve
 */
export function simulateWalletCopyTrading(trades, initialAmount = 1000, maxTrades = 50) {
  if (!trades || trades.length === 0) {
    return emptyResult(initialAmount, 0);
  }

  // Sort trades oldest first
  const sorted = [...trades]
    .filter((t) => getTimestamp(t))
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  // Take the N most recent resolved trades
  const recentTrades = sorted.slice(-maxTrades);

  if (recentTrades.length === 0) {
    return emptyResult(initialAmount, 0);
  }

  // Group by market to find buy-sell pairs
  const byMarket = {};
  recentTrades.forEach((t, idx) => {
    const key = t.title || t.conditionId || t.market || "unknown";
    if (!byMarket[key]) byMarket[key] = [];
    byMarket[key].push({ ...t, _idx: idx });
  });

  // Build a map of trade index -> P&L result
  const tradePnl = new Map();

  Object.values(byMarket).forEach((marketTrades) => {
    const marketSorted = [...marketTrades].sort(
      (a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0)
    );

    const buyStack = [];
    marketSorted.forEach((t) => {
      const side = (t.side || "").toUpperCase();
      const price = parseFloat(t.price) || 0;

      if (side === "BUY" || side === "B") {
        buyStack.push(t);
      } else if ((side === "SELL" || side === "S") && buyStack.length > 0) {
        const buy = buyStack.shift();
        const buyPrice = parseFloat(buy.price) || 0;
        const sellPrice = price;

        // P&L per dollar invested: (sellPrice - buyPrice) / buyPrice
        if (buyPrice > 0) {
          const returnPct = (sellPrice - buyPrice) / buyPrice;
          tradePnl.set(buy._idx, { type: "paired", returnPct, isWin: returnPct > 0 });
          tradePnl.set(t._idx, { type: "paired-exit", returnPct: 0, isWin: returnPct > 0 });
        }
      }
    });

    // Handle unmatched buys — use heuristic based on price
    buyStack.forEach((t) => {
      const price = parseFloat(t.price) || 0.5;
      // Heuristic: if bought at favorable odds (< 0.5), assume slight win
      // If bought at unfavorable odds (>= 0.5), assume slight loss
      const returnPct = price < 0.5
        ? (1 - price) / price * 0.3  // partial win (30% of max)
        : -price * 0.2;              // partial loss (20% of bet)
      tradePnl.set(t._idx, { type: "unresolved", returnPct, isWin: returnPct > 0 });
    });
  });

  // Now simulate the equity curve
  let equity = initialAmount;
  let peak = initialAmount;
  let maxDrawdown = 0;
  let winCount = 0;
  let lossCount = 0;
  const equityCurve = [{ trade: 0, equity: initialAmount, drawdown: 0 }];

  recentTrades.forEach((trade, i) => {
    const pnl = tradePnl.get(i);

    if (!pnl || pnl.type === "paired-exit") {
      // Skip sell-side of pairs (P&L already accounted for on buy)
      equityCurve.push({
        trade: i + 1,
        equity: Math.round(equity * 100) / 100,
        drawdown: Math.round(((peak - equity) / peak) * 10000) / 100,
      });
      return;
    }

    // Position size: proportional to trader's size relative to equity
    const tradeSize = parseFloat(trade.size) || 0;
    const positionFraction = Math.min(0.15, Math.max(0.02, tradeSize / (equity || 1)));
    const positionAmount = equity * positionFraction;
    const pnlAmount = positionAmount * pnl.returnPct;

    equity += pnlAmount;
    equity = Math.max(equity, 0.01);

    if (pnl.isWin) winCount++;
    else lossCount++;

    peak = Math.max(peak, equity);
    const drawdown = ((peak - equity) / peak) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    equityCurve.push({
      trade: i + 1,
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  });

  const roi = ((equity - initialAmount) / initialAmount) * 100;

  return {
    equityCurve,
    roi: Math.round(roi * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    winCount,
    lossCount,
    finalEquity: Math.round(equity * 100) / 100,
    initialAmount,
    numTrades: recentTrades.length,
  };
}

function emptyResult(initialAmount, numTrades) {
  return {
    equityCurve: [{ trade: 0, equity: initialAmount, drawdown: 0 }],
    roi: 0,
    maxDrawdown: 0,
    winCount: 0,
    lossCount: 0,
    finalEquity: initialAmount,
    initialAmount,
    numTrades,
  };
}
