/**
 * Wallet Copy Trading Simulator — Clean Rebuild
 *
 * One source of truth: BUY trades from the Data API, resolved via Gamma.
 * For each unique market position (conditionId + outcomeIndex):
 *   - Entry price  = weighted-average of all BUY trades
 *   - Exit price   = market settlement price (0 or 1) from Gamma
 *   - Return %     = (exit - entry) / entry
 * Positions sold before resolution (explicit SELL trades) are also captured.
 *
 * Position sizing: flat % of current equity per trade (user-configurable).
 */

/**
 * Parse Gamma's closedTime field → Unix milliseconds.
 * Format: "2024-11-06 03:12:00+00" (space-separated, no colon in tz offset)
 * We normalise to full ISO 8601 before passing to Date().
 */
function parseClosedTime(s) {
  if (!s) return null;
  // "2024-11-06 03:12:00+00" → "2024-11-06T03:12:00+00:00"
  const iso = s.replace(" ", "T").replace(/\+(\d{2})$/, "+$1:00");
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
}

function getTimestamp(trade) {
  if (trade.match_time) return new Date(trade.match_time).getTime();
  if (typeof trade.timestamp === "number") {
    return trade.timestamp > 1e12 ? trade.timestamp : trade.timestamp * 1000;
  }
  if (trade.created_at) return new Date(trade.created_at).getTime();
  return null;
}

// ── Source A: explicit buy→sell pairs (trader sold before resolution) ─────────
function extractPairTrades(trades) {
  // Group all trades by conditionId
  const byMarket = {};
  for (const t of trades) {
    const key = t.conditionId || t.title || "unknown";
    if (!byMarket[key]) byMarket[key] = { conditionId: t.conditionId, title: t.title, trades: [] };
    byMarket[key].trades.push(t);
  }

  const closed = [];
  for (const { conditionId, title, trades: mTrades } of Object.values(byMarket)) {
    const sorted = [...mTrades].sort((a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0));
    const buyStack = [];
    for (const t of sorted) {
      const side = (t.side || "").toUpperCase();
      if (side === "BUY" || side === "B") {
        buyStack.push(t);
      } else if ((side === "SELL" || side === "S") && buyStack.length > 0) {
        const buy = buyStack.shift();
        const buyPrice = parseFloat(buy.price) || 0;
        const sellPrice = parseFloat(t.price) || 0;
        if (buyPrice > 0 && sellPrice > 0) {
          const sellTime = getTimestamp(t);
          const d = sellTime ? new Date(sellTime) : null;
          closed.push({
            market: title || conditionId || "unknown",
            conditionId,
            entryPrice: buyPrice,
            exitPrice: sellPrice,
            returnPct: (sellPrice - buyPrice) / buyPrice,
            isWin: sellPrice > buyPrice,
            buyTime: getTimestamp(buy),
            sellTime,
            date: d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
            source: "pair",
          });
        }
      }
    }
  }

  return closed.sort((a, b) => (a.sellTime || 0) - (b.sellTime || 0));
}

// ── Source B: hold-to-resolution (main path for most traders) ─────────────────
function extractResolutionTrades(trades, marketResolutions, pairConditionIds) {
  if (!marketResolutions || marketResolutions.size === 0) return [];

  // Group BUY trades by conditionId:outcomeIndex
  // (disambiguates YES vs NO within the same market without relying on asset token IDs
  //  which are uint256 values that JS silently truncates)
  const byOutcome = {};
  for (const t of trades) {
    const side = (t.side || "").toUpperCase();
    if (side !== "BUY" && side !== "B") continue;
    if (!t.conditionId) continue;
    if (pairConditionIds.has(t.conditionId)) continue; // covered by pair matching

    const oidx = t.outcomeIndex ?? -1;
    const key = `${t.conditionId}:${oidx}`;
    if (!byOutcome[key]) {
      byOutcome[key] = {
        conditionId: t.conditionId,
        title: t.title,
        asset: t.asset,
        outcomeIndex: oidx,
        buys: [],
      };
    }
    byOutcome[key].buys.push(t);
  }

  const closed = [];
  for (const { conditionId, title, asset, outcomeIndex, buys } of Object.values(byOutcome)) {
    // Look up resolution strictly by conditionId:outcomeIndex.
    // Do NOT fall back to `asset` (uint256 token IDs are silently truncated by JS,
    // causing two different markets to collide on the same key → wrong resolution).
    // Do NOT fall back to bare conditionId (would pick an arbitrary outcome for the market).
    const resolution = marketResolutions.get(`${conditionId}:${outcomeIndex}`);

    if (!resolution || resolution.settlementPrice === null) continue;

    // Weighted-average entry price + buy time bounds
    let totalSize = 0;
    let weightedPrice = 0;
    let earliestBuyTime = Infinity;
    let latestBuyTime = 0;

    for (const t of buys) {
      const size = parseFloat(t.size) || 0;
      const price = parseFloat(t.price) || 0;
      if (size > 0 && price > 0) {
        totalSize += size;
        weightedPrice += price * size;
        const ts = getTimestamp(t);
        if (ts) {
          if (ts < earliestBuyTime) earliestBuyTime = ts;
          if (ts > latestBuyTime) latestBuyTime = ts;
        }
      }
    }

    if (totalSize === 0) continue;

    const entryPrice = weightedPrice / totalSize;
    const exitPrice = resolution.settlementPrice;

    // Priority for sellTime (what we sort by and display):
    // 1. closedTime — Gamma's ACTUAL resolution timestamp (most accurate)
    // 2. endDate    — scheduled end date (good approximation when closedTime absent)
    // 3. latestBuyTime — last on-chain buy (always >= earliestBuyTime, never a future date)
    const closedTs = parseClosedTime(resolution.closedTime);
    const endTs = resolution.endDate ? new Date(resolution.endDate).getTime() : null;
    const sellTime = closedTs || (endTs && !isNaN(endTs) ? endTs : null) || (latestBuyTime > 0 ? latestBuyTime : null);

    const d = sellTime ? new Date(sellTime) : null;
    closed.push({
      market: title || conditionId || "unknown",
      conditionId,
      entryPrice,
      exitPrice,
      returnPct: (exitPrice - entryPrice) / entryPrice,
      isWin: exitPrice > entryPrice,
      buyTime: earliestBuyTime === Infinity ? null : earliestBuyTime,
      sellTime,
      date: d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
      source: "resolution",
    });
  }

  return closed.sort((a, b) => (a.sellTime || 0) - (b.sellTime || 0));
}

// ── Core simulation loop ───────────────────────────────────────────────────────
/**
 * @param {"fixed"|"compound"|"martingale"|"anti-martingale"} strategy
 *   fixed          — flat initialAmount×pct$ every trade (default)
 *   compound       — pct% of current equity each trade (reinvests gains)
 *   martingale     — double after every loss, reset after win
 *   anti-martingale— double after every win, reset after loss
 */
function runSimLoop(closedTrades, initialAmount, positionPct, strategy = "fixed", slippagePct = 0) {
  const pct = Math.max(1, Math.min(50, positionPct || 10)) / 100;
  const slippage = Math.max(0, Math.min(10, slippagePct || 0)) / 100; // 0–10%
  const baseBet = initialAmount * pct; // anchor for martingale strategies

  let equity = initialAmount;
  let peak = initialAmount;
  let maxDrawdown = 0;
  let winCount = 0;
  let lossCount = 0;
  let totalSlippageCost = 0;
  let streak = 0; // >0 = consecutive wins, <0 = consecutive losses
  const equityCurve = [{ trade: 0, equity: initialAmount, drawdown: 0 }];

  for (let i = 0; i < closedTrades.length; i++) {
    const trade = closedTrades[i];
    // Apply slippage: reduce return by slippage % on each position
    const adjustedReturn = trade.returnPct - slippage;
    const isWin = adjustedReturn > 0;

    // ── Bet sizing per strategy ──────────────────────────────────────────────
    let bet;
    switch (strategy) {
      case "compound":
        // Reinvest: bet is always pct% of current equity
        bet = equity * pct;
        break;
      case "martingale":
        // Double after each loss; reset to baseBet after a win.
        // Cap at 25% of current equity so a long losing streak can't wipe out instantly.
        bet = streak < 0
          ? baseBet * Math.pow(2, Math.abs(streak))
          : baseBet;
        bet = Math.min(bet, equity * 0.25);
        break;
      case "anti-martingale":
        // Double after each win; reset to baseBet after a loss.
        // Cap at 25% of current equity.
        bet = streak > 0
          ? baseBet * Math.pow(2, streak)
          : baseBet;
        bet = Math.min(bet, equity * 0.25);
        break;
      default: // "fixed"
        bet = baseBet;
    }

    const positionAmount = Math.min(bet, equity); // can't bet more than available
    const gain = positionAmount * adjustedReturn;
    const slippageCost = positionAmount * slippage;
    totalSlippageCost += slippageCost;
    equity = Math.max(equity + gain, 0.01);

    if (isWin) { winCount++; streak = streak > 0 ? streak + 1 : 1; }
    else        { lossCount++; streak = streak < 0 ? streak - 1 : -1; }

    peak = Math.max(peak, equity);
    const drawdown = ((peak - equity) / peak) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    equityCurve.push({
      trade: i + 1,
      market: trade.market || "",
      date: trade.date || "",
      isWin,
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
      entryPrice: trade.entryPrice ?? null,
      exitPrice: trade.exitPrice ?? null,
      returnPct: adjustedReturn,
      rawReturnPct: trade.returnPct ?? null,
      slippageCost: Math.round(slippageCost * 100) / 100,
      betAmount: Math.round(positionAmount * 100) / 100,
      gainLoss: Math.round(gain * 100) / 100,
    });
  }

  const roi = ((equity - initialAmount) / initialAmount) * 100;
  return {
    equityCurve,
    roi: Math.round(roi * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    winCount,
    lossCount,
    finalEquity: Math.round(equity * 100) / 100,
    initialAmount,
    numTrades: closedTrades.length,
    slippagePct: slippagePct,
    totalSlippageCost: Math.round(totalSlippageCost * 100) / 100,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Main simulation — uses trades + gamma resolutions.
 * @param {Array}  trades            Raw trade objects from Data API (up to 3000)
 * @param {number} initialAmount     Starting capital in $
 * @param {Map}    marketResolutions From fetchMarketResolutions()
 * @param {number} positionPct       % of equity to bet per trade (1–50)
 */
export function simulateWalletCopyTrading(
  trades,
  initialAmount = 1000,
  marketResolutions = new Map(),
  positionPct = 10,
  strategy = "fixed",
  slippagePct = 0
) {
  if (!trades || trades.length === 0) return null;

  const pairTrades = extractPairTrades(trades);
  const pairConditionIds = new Set(pairTrades.map((t) => t.conditionId).filter(Boolean));
  const resolutionTrades = extractResolutionTrades(trades, marketResolutions, pairConditionIds);

  // Merge and sort chronologically (oldest first)
  const allClosed = [...pairTrades, ...resolutionTrades]
    .sort((a, b) => (a.sellTime || 0) - (b.sellTime || 0));

  if (allClosed.length === 0) return null;

  // Simulate the most recent 100 resolved trades (sorted oldest→newest)
  const MAX_TRADES = 100;
  const simTrades = allClosed.length > MAX_TRADES
    ? allClosed.slice(-MAX_TRADES)
    : allClosed;

  const sim = runSimLoop(simTrades, initialAmount, positionPct, strategy, slippagePct);

  return {
    ...sim,
    totalClosedFound: allClosed.length,
    pairTrades: pairTrades.length,
    resolutionTrades: resolutionTrades.length,
    source: "gamma",
  };
}

/**
 * Fallback: uses /positions API data when trades/gamma path yields nothing.
 * Uses `redeemable` flag (positions that have settled) + avgPrice for accurate entry cost.
 */
export function simulateFromPositions(positions, initialAmount = 1000, positionPct = 10) {
  if (!positions || positions.length === 0) return null;

  const closed = positions
    .filter((p) => {
      const iv = parseFloat(p.initialValue) || parseFloat(p.initial_value) || 0;
      if (iv < 0.01) return false;
      const redeemable = p.redeemable === true || p.redeemable === "true";
      const size = parseFloat(p.size) || 0;
      // Positions that have been redeemable (resolved), or fully sold (size ~0)
      return redeemable || size < 0.01;
    })
    .map((p) => {
      const iv = parseFloat(p.initialValue) || parseFloat(p.initial_value) || 0;
      const pnl = parseFloat(p.cashPnl) || parseFloat(p.cash_pnl) || 0;
      // Use avgPrice (actual entry cost basis) if available; fall back to initialValue
      const avgPrice = parseFloat(p.avgPrice) || parseFloat(p.avg_price) || null;
      const size = parseFloat(p.size) || 0;
      const returnPct = avgPrice && size > 0
        ? pnl / (avgPrice * size)
        : (iv > 0 ? pnl / iv : 0);
      const endTs = p.endDate ? new Date(p.endDate).getTime() : null;
      return {
        market: (p.title || "") + (p.outcome ? ` (${p.outcome})` : ""),
        returnPct,
        isWin: pnl > 0,
        sellTime: endTs,
        date: endTs
          ? new Date(endTs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "",
      };
    })
    .sort((a, b) => (a.sellTime || 0) - (b.sellTime || 0));

  if (closed.length === 0) return null;

  const sim = runSimLoop(closed, initialAmount, positionPct);
  return {
    ...sim,
    totalClosedFound: closed.length,
    pairTrades: 0,
    resolutionTrades: closed.length,
    source: "positions",
  };
}
