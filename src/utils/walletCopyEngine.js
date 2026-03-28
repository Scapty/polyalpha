/**
 * Wallet Copy Trading Simulator v3
 *
 * Simulates copy-trading based ONLY on CLOSED trades (completed buy-sell pairs).
 * Open positions are excluded — we only show results for resolved trades.
 *
 * For each closed trade:
 *   1. Calculate the trader's actual return (sellPrice - buyPrice) / buyPrice
 *   2. Apply slippage to simulate a copy trader's worse execution
 *   3. Apply proportional position sizing to starting capital
 *   4. Track equity curve, drawdown, win/loss
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
 * Extract closed trades (buy-sell pairs) from raw trade data
 */
function extractClosedTrades(trades) {
  const byMarket = {};
  trades.forEach((t) => {
    const key = t.title || t.conditionId || t.market || "unknown";
    if (!byMarket[key]) byMarket[key] = [];
    byMarket[key].push(t);
  });

  const closed = [];

  Object.values(byMarket).forEach((marketTrades) => {
    const sorted = [...marketTrades].sort(
      (a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0)
    );

    const buyStack = [];
    sorted.forEach((t) => {
      const side = (t.side || "").toUpperCase();
      if (side === "BUY" || side === "B") {
        buyStack.push(t);
      } else if ((side === "SELL" || side === "S") && buyStack.length > 0) {
        const buy = buyStack.shift();
        const buyPrice = parseFloat(buy.price) || 0;
        const sellPrice = parseFloat(t.price) || 0;
        const buySize = parseFloat(buy.size) || 0;
        const sellSize = parseFloat(t.size) || 0;
        if (buyPrice > 0 && sellPrice > 0) {
          closed.push({
            market: t.title || t.conditionId || "unknown",
            buyPrice,
            sellPrice,
            size: Math.min(buySize, sellSize),
            returnPct: (sellPrice - buyPrice) / buyPrice,
            isWin: sellPrice > buyPrice,
            buyTime: getTimestamp(buy),
            sellTime: getTimestamp(t),
          });
        }
      }
    });
  });

  // Sort by sell time (chronological)
  return closed.sort((a, b) => (a.sellTime || 0) - (b.sellTime || 0));
}

/**
 * Estimate slippage for a copy trade
 * A copy trader buys AFTER the original → pays more
 */
function estimateSlippage(tradeSize, price) {
  const TYPICAL_LIQUIDITY = 25_000;
  const IMPACT_COEFF = 0.02;
  const BASE_SPREAD = 0.005;

  const sizeRatio = Math.abs(tradeSize) / TYPICAL_LIQUIDITY;
  const priceImpact = IMPACT_COEFF * Math.sqrt(sizeRatio);
  const totalSlippage = BASE_SPREAD + priceImpact;

  return Math.min(totalSlippage, price * 0.15);
}

/**
 * Simulate copy-trading based on closed trades only
 * @param {Array} trades - Raw trade objects from the API
 * @param {number} initialAmount - Starting capital in USD
 * @param {number} maxTrades - Number of most recent closed trades to simulate
 * @returns {Object} Simulation results
 */
export function simulateWalletCopyTrading(trades, initialAmount = 1000, maxTrades = 50) {
  if (!trades || trades.length === 0) {
    return emptyResult(initialAmount);
  }

  // Extract only closed trades
  const allClosed = extractClosedTrades(trades);
  if (allClosed.length === 0) {
    return emptyResult(initialAmount);
  }

  // Take most recent N closed trades
  const recentClosed = allClosed.slice(-maxTrades);

  let equity = initialAmount;
  let peak = initialAmount;
  let maxDrawdown = 0;
  let winCount = 0;
  let lossCount = 0;
  let totalSlippageCost = 0;
  const equityCurve = [{ trade: 0, equity: initialAmount, drawdown: 0 }];

  recentClosed.forEach((trade, i) => {
    // Estimate slippage on both legs
    const buySlippage = estimateSlippage(trade.size, trade.buyPrice);
    const sellSlippage = estimateSlippage(trade.size, trade.sellPrice);

    // Copy trader gets worse prices
    const copyBuyPrice = Math.min(trade.buyPrice + buySlippage, 0.99);
    const copySellPrice = Math.max(trade.sellPrice - sellSlippage, 0.01);
    const copyReturn = (copySellPrice - copyBuyPrice) / copyBuyPrice;

    totalSlippageCost += (buySlippage + sellSlippage) * trade.size;

    // Position size: proportional, capped at 15% of equity
    const positionFraction = Math.min(0.15, Math.max(0.02, trade.size / (equity || 1)));
    const positionAmount = equity * positionFraction;
    const pnlAmount = positionAmount * copyReturn;

    equity += pnlAmount;
    equity = Math.max(equity, 0.01);

    if (copyReturn > 0) winCount++;
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
    numTrades: recentClosed.length,
    totalClosedTrades: allClosed.length,
    estimatedSlippageCost: Math.round(totalSlippageCost * 100) / 100,
  };
}

function emptyResult(initialAmount) {
  return {
    equityCurve: [{ trade: 0, equity: initialAmount, drawdown: 0 }],
    roi: 0,
    maxDrawdown: 0,
    winCount: 0,
    lossCount: 0,
    finalEquity: initialAmount,
    initialAmount,
    numTrades: 0,
    totalClosedTrades: 0,
    estimatedSlippageCost: 0,
  };
}
