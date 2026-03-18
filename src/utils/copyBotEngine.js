/**
 * Copy Bot Simulator Engine
 * Simulates copy-trading a trader based on their historical performance profile
 */

// Seeded random for reproducible results per trader
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Strategy profiles determine risk/reward characteristics
const STRATEGY_PROFILES = {
  "Ensemble ML": { avgWin: 0.035, avgLoss: 0.022, consistency: 0.85 },
  "Arbitrage": { avgWin: 0.012, avgLoss: 0.005, consistency: 0.92 },
  "Deep RL": { avgWin: 0.04, avgLoss: 0.028, consistency: 0.80 },
  "News Sentiment": { avgWin: 0.045, avgLoss: 0.03, consistency: 0.78 },
  "Momentum": { avgWin: 0.05, avgLoss: 0.035, consistency: 0.75 },
  "Fundamental": { avgWin: 0.06, avgLoss: 0.055, consistency: 0.60 },
  "Social Signal": { avgWin: 0.07, avgLoss: 0.065, consistency: 0.55 },
  "Gut Feel": { avgWin: 0.10, avgLoss: 0.09, consistency: 0.50 },
  "Technical": { avgWin: 0.055, avgLoss: 0.048, consistency: 0.58 },
};

/**
 * Simulate copy trading a specific trader
 * @param {Object} trader - Trader object from leaderboardData
 * @param {number} initialAmount - Starting capital in USD
 * @param {number} numTrades - Number of trades to simulate
 * @returns {Object} Simulation results
 */
export function simulateCopyTrading(trader, initialAmount = 1000, numTrades = 100) {
  const profile = STRATEGY_PROFILES[trader.strategy] || STRATEGY_PROFILES["Fundamental"];
  const winRate = trader.winRate / 100;
  const rand = seededRandom(hashString(trader.name) + initialAmount + numTrades);

  let equity = initialAmount;
  let peak = initialAmount;
  let maxDrawdown = 0;
  let winCount = 0;
  let lossCount = 0;
  const returns = [];
  const equityCurve = [{ trade: 0, equity: initialAmount, drawdown: 0 }];

  for (let i = 1; i <= numTrades; i++) {
    // Determine win/loss with some randomness around the win rate
    const adjustedWinRate = winRate + (rand() - 0.5) * (1 - profile.consistency) * 0.3;
    const isWin = rand() < adjustedWinRate;

    // Calculate P&L with variance
    let pctChange;
    if (isWin) {
      pctChange = profile.avgWin * (0.5 + rand() * 1.0);
      winCount++;
    } else {
      pctChange = -profile.avgLoss * (0.5 + rand() * 1.0);
      lossCount++;
    }

    // Position sizing: risk 5-15% of equity per trade depending on strategy consistency
    const positionPct = 0.05 + profile.consistency * 0.10;
    const tradeReturn = pctChange * positionPct;
    returns.push(tradeReturn);

    equity = equity * (1 + tradeReturn);
    equity = Math.max(equity, 0.01); // Can't go below ~0

    peak = Math.max(peak, equity);
    const drawdown = ((peak - equity) / peak) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    equityCurve.push({
      trade: i,
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  }

  // Calculate stats
  const finalEquity = equity;
  const roi = ((finalEquity - initialAmount) / initialAmount) * 100;
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length
  );
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    equityCurve,
    roi: Math.round(roi * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    winCount,
    lossCount,
    winRate: Math.round((winCount / numTrades) * 10000) / 100,
    finalEquity: Math.round(finalEquity * 100) / 100,
    initialAmount,
    numTrades,
    traderName: trader.name,
    strategy: trader.strategy,
  };
}
