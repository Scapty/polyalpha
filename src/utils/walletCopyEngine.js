/**
 * Wallet Copy Trading Simulator v4
 *
 * Closed trades are sourced TWO ways:
 *   1. Explicit buy→sell pairs  (user manually sold)
 *   2. Market resolutions       (market settled YES/NO via gamma API)
 *
 * Method 2 is the main one for buy-and-hold wallets.
 * For each resolved BUY: entry = trade.price, exit = settlement (0 or 1).
 * Both sources are combined, deduplicated, and sorted chronologically.
 */

function getTimestamp(trade) {
  if (trade.match_time) return new Date(trade.match_time).getTime();
  if (typeof trade.timestamp === "number") {
    return trade.timestamp > 1e12 ? trade.timestamp : trade.timestamp * 1000;
  }
  if (trade.created_at) return new Date(trade.created_at).getTime();
  return null;
}

// ── Method 1: explicit buy→sell pairs ────────────────────────────────────────
function extractPairTrades(trades) {
  const byMarket = {};
  trades.forEach((t) => {
    const key = t.conditionId || t.title || "unknown";
    if (!byMarket[key]) byMarket[key] = { trades: [], conditionId: t.conditionId, title: t.title };
    byMarket[key].trades.push(t);
  });

  const closed = [];
  Object.values(byMarket).forEach(({ trades: mTrades, conditionId, title }) => {
    const sorted = [...mTrades].sort((a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0));
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
            market: title || conditionId || "unknown",
            conditionId,
            buyPrice,
            sellPrice,
            size: Math.min(buySize, sellSize),
            returnPct: (sellPrice - buyPrice) / buyPrice,
            isWin: sellPrice > buyPrice,
            buyTime: getTimestamp(buy),
            sellTime: getTimestamp(t),
            source: "pair",
          });
        }
      }
    });
  });

  return closed.sort((a, b) => (a.sellTime || 0) - (b.sellTime || 0));
}

// ── Method 2: market resolutions ─────────────────────────────────────────────
function extractResolutionTrades(trades, marketResolutions, pairConditionIds) {
  if (!marketResolutions || marketResolutions.size === 0) return [];

  const byMarket = {};
  trades.forEach((t) => {
    const side = (t.side || "").toUpperCase();
    if (side !== "BUY" && side !== "B") return;

    const key = t.conditionId || t.title || "unknown";
    if (pairConditionIds.has(key)) return; // already captured by pair-matching

    if (!byMarket[key]) {
      byMarket[key] = { conditionId: t.conditionId, title: t.title, asset: t.asset, buys: [] };
    }
    byMarket[key].buys.push(t);
  });

  const closed = [];
  for (const { conditionId, title, asset, buys } of Object.values(byMarket)) {
    const resolution = marketResolutions.get(asset);
    if (!resolution || resolution.settlementPrice === null) continue;

    let totalSize = 0;
    let weightedPrice = 0;
    let earliestBuyTime = Infinity;

    for (const t of buys) {
      const size = parseFloat(t.size) || 0;
      const price = parseFloat(t.price) || 0;
      if (size > 0 && price > 0) {
        totalSize += size;
        weightedPrice += price * size;
        const ts = getTimestamp(t);
        if (ts && ts < earliestBuyTime) earliestBuyTime = ts;
      }
    }

    if (totalSize === 0) continue;

    const avgEntryPrice = weightedPrice / totalSize;
    const settlementPrice = resolution.settlementPrice;
    const sellTime = resolution.endDate
      ? new Date(resolution.endDate).getTime()
      : earliestBuyTime + 7 * 86400000;

    closed.push({
      market: title || conditionId || "unknown",
      conditionId,
      buyPrice: avgEntryPrice,
      sellPrice: settlementPrice,
      size: totalSize,
      returnPct: (settlementPrice - avgEntryPrice) / avgEntryPrice,
      isWin: settlementPrice > avgEntryPrice,
      buyTime: earliestBuyTime === Infinity ? null : earliestBuyTime,
      sellTime,
      source: "resolution",
    });
  }

  return closed.sort((a, b) => (a.sellTime || 0) - (b.sellTime || 0));
}

// ── Slippage model ────────────────────────────────────────────────────────────
function estimateSlippage(tradeSize, price) {
  const TYPICAL_LIQUIDITY = 25_000;
  const IMPACT_COEFF = 0.02;
  const BASE_SPREAD = 0.005;
  const sizeRatio = Math.abs(tradeSize) / TYPICAL_LIQUIDITY;
  return Math.min(BASE_SPREAD + IMPACT_COEFF * Math.sqrt(sizeRatio), price * 0.15);
}

// ── Main simulation ───────────────────────────────────────────────────────────
/**
 * @param {Array}  trades            - Raw trade objects from Data API
 * @param {number} initialAmount     - Starting capital
 * @param {number} maxTrades         - Most recent N closed trades to simulate
 * @param {Map}    marketResolutions - From fetchMarketResolutions(); empty Map = pairs only
 */
export function simulateWalletCopyTrading(
  trades,
  initialAmount = 1000,
  maxTrades = 50,
  marketResolutions = new Map()
) {
  if (!trades || trades.length === 0) return emptyResult(initialAmount);

  const pairTrades = extractPairTrades(trades);
  const pairConditionIds = new Set(pairTrades.map((t) => t.conditionId).filter(Boolean));
  pairTrades.forEach((t) => { if (t.market) pairConditionIds.add(t.market); });

  const resolutionTrades = extractResolutionTrades(trades, marketResolutions, pairConditionIds);

  const allClosed = [...pairTrades, ...resolutionTrades]
    .sort((a, b) => (a.sellTime || 0) - (b.sellTime || 0));

  if (allClosed.length === 0) return emptyResult(initialAmount);

  const recentClosed = allClosed.slice(-maxTrades);

  let equity = initialAmount;
  let peak = initialAmount;
  let maxDrawdown = 0;
  let winCount = 0;
  let lossCount = 0;
  let totalSlippageCost = 0;
  const equityCurve = [{ trade: 0, equity: initialAmount, drawdown: 0 }];

  recentClosed.forEach((trade, i) => {
    const buySlippage = estimateSlippage(trade.size, trade.buyPrice);
    // For resolution exits (settlement at exact 0 or 1) there is no copy-trade slippage on exit
    const sellSlippage = trade.source === "resolution"
      ? 0
      : estimateSlippage(trade.size, trade.sellPrice);

    const copyBuyPrice = Math.min(trade.buyPrice + buySlippage, 0.99);
    const copySellPrice = trade.source === "resolution"
      ? trade.sellPrice
      : Math.max(trade.sellPrice - sellSlippage, 0.01);
    const copyReturn = (copySellPrice - copyBuyPrice) / copyBuyPrice;

    totalSlippageCost += (buySlippage + sellSlippage) * trade.size;

    const positionFraction = Math.min(0.15, Math.max(0.02, trade.size / (equity || 1)));
    const positionAmount = equity * positionFraction;
    equity += positionAmount * copyReturn;
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
    pairTrades: pairTrades.length,
    resolutionTrades: resolutionTrades.length,
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
    pairTrades: 0,
    resolutionTrades: 0,
    estimatedSlippageCost: 0,
  };
}
