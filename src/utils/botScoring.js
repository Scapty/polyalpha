/**
 * 6-Factor Bot Scoring Algorithm v3
 *
 * KEY CHANGES from v2:
 * - Trade Frequency thresholds raised: 10/day is normal for active humans
 * - Timing Precision: 24h coverage alone is NOT a bot signal (pros trade all day)
 * - Sub-minute intervals remain a strong bot signal
 * - Override rules relaxed: need stronger evidence before forcing "Likely Bot"
 * - Classification bands: ≥70 Bot, ≤35 Human (wider Uncertain zone)
 * - Better distinction between "active human trader" and "automated bot"
 */

export function calculateBotScore(trades) {
  if (!trades || trades.length < 5) {
    return {
      score: 0,
      classification: "Insufficient Data",
      factors: defaultFactors(0),
      tradeCount: trades?.length || 0,
      stats: {},
    };
  }

  const f1 = calcTradeFrequency(trades);
  const f2 = calcWinRateConsistency(trades);
  const f3 = calcTimingPrecision(trades);
  const f4 = calcSizeUniformity(trades);
  const f5 = calcMarketDiversity(trades);
  const f6 = calcHoldingDuration(trades);

  const factors = [
    { name: "Trade Frequency", weight: 0.25, score: f1.score, detail: f1.detail, icon: "\u26A1" },
    { name: "Timing Precision", weight: 0.20, score: f3.score, detail: f3.detail, icon: "\u23F1\uFE0F" },
    { name: "Size Uniformity", weight: 0.15, score: f4.score, detail: f4.detail, icon: "\uD83D\uDCCF" },
    { name: "Win Rate Consistency", weight: 0.10, score: f2.score, detail: f2.detail, icon: "\uD83C\uDFAF" },
    { name: "Market Diversity", weight: 0.10, score: f5.score, detail: f5.detail, icon: "\uD83C\uDF10" },
    { name: "Holding Duration", weight: 0.20, score: f6.score, detail: f6.detail, icon: "\u23F3" },
  ];

  const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  let score = Math.round(weightedScore);

  // === OVERRIDE RULES — only trigger with strong evidence ===

  // Rule 1: Sub-minute trading is only a bot signal if COMBINED with high volume
  // A human clicking through 15 trades/day can easily have 50% sub-minute
  // But 100+ trades/day with 50%+ sub-minute = definitely automated
  if (f1.subMinuteRatio && f1.subMinuteRatio > 0.5 && f1.score >= 75) score = Math.max(score, 80);
  if (f1.subMinuteRatio && f1.subMinuteRatio > 0.7 && f1.score >= 55) score = Math.max(score, 75);

  // Rule 2: Trade frequency AND timing precision AND size uniformity all very high
  // = almost certainly automated
  if (f1.score >= 85 && f3.score >= 85 && f4.score >= 70) score = Math.max(score, 80);

  // Rule 3: 4+ factors above 70 = strong bot signal
  const highFactors = factors.filter((f) => f.score >= 70).length;
  if (highFactors >= 4) score = Math.max(score, 70);

  // Rule 4: Low activity + varied behavior = human
  if (f1.score <= 30 && f4.score <= 40 && highFactors <= 1) score = Math.min(score, 35);

  // CLASSIFICATION — wider Uncertain band (36-69)
  const classification = score >= 70 ? "Likely Bot" : score <= 35 ? "Likely Human" : "Uncertain";

  const timestamps = trades.map((t) => getTimestamp(t)).filter(Boolean).sort();
  const totalTrades = trades.length;
  const uniqueMarkets = new Set(trades.map((t) => t.title || t.conditionId || t.market)).size;
  const timeSpanHours = timestamps.length >= 2 ? (timestamps[timestamps.length - 1] - timestamps[0]) / 3600000 : 0;

  return {
    score,
    classification,
    factors,
    tradeCount: totalTrades,
    stats: {
      totalTrades,
      uniqueMarkets,
      tradesPerHour: timeSpanHours > 0 ? (totalTrades / timeSpanHours).toFixed(1) : "N/A",
      timeSpanDays: (timeSpanHours / 24).toFixed(1),
    },
  };
}

function getTimestamp(trade) {
  if (trade.match_time) return new Date(trade.match_time).getTime();
  if (typeof trade.timestamp === "number") {
    return trade.timestamp > 1e12 ? trade.timestamp : trade.timestamp * 1000;
  }
  if (trade.created_at) return new Date(trade.created_at).getTime();
  return null;
}

function defaultFactors(score) {
  return [
    { name: "Trade Frequency", weight: 0.25, score, detail: "Not enough data", icon: "\u26A1" },
    { name: "Timing Precision", weight: 0.20, score, detail: "Not enough data", icon: "\u23F1\uFE0F" },
    { name: "Size Uniformity", weight: 0.15, score, detail: "Not enough data", icon: "\uD83D\uDCCF" },
    { name: "Win Rate Consistency", weight: 0.10, score, detail: "Not enough data", icon: "\uD83C\uDFAF" },
    { name: "Market Diversity", weight: 0.10, score, detail: "Not enough data", icon: "\uD83C\uDF10" },
    { name: "Holding Duration", weight: 0.20, score, detail: "Not enough data", icon: "\u23F3" },
  ];
}

// --- Factor Calculations ---

function calcTradeFrequency(trades) {
  const timestamps = trades.map((t) => getTimestamp(t)).filter(Boolean).sort();
  if (timestamps.length < 2) return { score: 0, detail: "Single trade", subMinuteRatio: 0 };

  const totalHours = (timestamps[timestamps.length - 1] - timestamps[0]) / 3600000;
  if (totalHours <= 0) return { score: 98, detail: "All trades in same instant", subMinuteRatio: 1 };

  const totalDays = Math.max(totalHours / 24, 1);
  const tradesPerDay = trades.length / totalDays;

  // Compute intervals
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }

  // Sub-minute intervals = strong bot signal
  const subMinute = intervals.filter((iv) => iv < 60000).length;
  const subMinuteRatio = intervals.length > 0 ? subMinute / intervals.length : 0;

  // Median interval
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
  const medianMinutes = medianInterval / 60000;

  // SCORING: realistic thresholds — active humans can do 30+/day
  let score;
  if (tradesPerDay >= 200) score = 98;
  else if (tradesPerDay >= 100) score = 90;
  else if (tradesPerDay >= 50) score = 75;
  else if (tradesPerDay >= 30) score = 55;
  else if (tradesPerDay >= 15) score = 35;
  else if (tradesPerDay >= 5) score = 20;
  else score = 10;

  // Discount for short timespan: high trades/day over only 1-3 days is less
  // suspicious than sustained over weeks. Humans have burst days.
  if (totalDays < 3 && tradesPerDay >= 30) {
    score = Math.max(10, score - 20);
  } else if (totalDays < 7 && tradesPerDay >= 30) {
    score = Math.max(10, score - 10);
  }

  // Bonus: sub-minute trading (this is the real bot signal)
  if (subMinuteRatio > 0.7) score = Math.min(100, score + 15);
  else if (subMinuteRatio > 0.4) score = Math.min(100, score + 8);

  return {
    score: Math.min(100, score),
    detail: `${tradesPerDay.toFixed(1)} trades/day, median interval ${medianMinutes.toFixed(1)}min, ${(subMinuteRatio * 100).toFixed(0)}% sub-minute`,
    subMinuteRatio,
  };
}

function calcWinRateConsistency(trades) {
  const weeklyResult = calcWinRateByWeeklyWindows(trades);
  if (weeklyResult) return weeklyResult;

  const prices = trades.map((t) => parseFloat(t.price)).filter((p) => p > 0 && p <= 1);
  if (prices.length < 5) return { score: 50, detail: "Limited price data" };

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / prices.length;
  const cv = Math.sqrt(variance) / (mean || 1);

  let score;
  if (cv < 0.05) score = 90;
  else if (cv < 0.15) score = 65;
  else if (cv < 0.3) score = 45;
  else if (cv < 0.5) score = 30;
  else score = 15;

  return { score, detail: `Price consistency CV: ${cv.toFixed(3)}` };
}

function calcWinRateByWeeklyWindows(trades) {
  const byMarket = {};
  trades.forEach((t) => {
    const key = t.title || t.conditionId || t.market || "unknown";
    if (!byMarket[key]) byMarket[key] = [];
    byMarket[key].push(t);
  });

  const resolvedTrades = [];
  Object.values(byMarket).forEach((marketTrades) => {
    const sorted = [...marketTrades].sort((a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0));
    let lastBuy = null;
    sorted.forEach((t) => {
      const side = (t.side || "").toUpperCase();
      if (side === "BUY" || side === "B") {
        lastBuy = t;
      } else if ((side === "SELL" || side === "S") && lastBuy) {
        const buyPrice = parseFloat(lastBuy.price) || 0;
        const sellPrice = parseFloat(t.price) || 0;
        resolvedTrades.push({ timestamp: getTimestamp(t), isWin: sellPrice > buyPrice });
        lastBuy = null;
      }
    });
  });

  if (resolvedTrades.length < 10) return null;

  const windows = {};
  resolvedTrades.forEach((t) => {
    if (!t.timestamp) return;
    const weekKey = Math.floor(t.timestamp / (7 * 24 * 3600000));
    if (!windows[weekKey]) windows[weekKey] = { wins: 0, total: 0 };
    windows[weekKey].total++;
    if (t.isWin) windows[weekKey].wins++;
  });

  const windowRates = Object.values(windows)
    .filter((w) => w.total >= 3)
    .map((w) => w.wins / w.total);

  if (windowRates.length < 2) return null;

  const mean = windowRates.reduce((a, b) => a + b, 0) / windowRates.length;
  const stddev = Math.sqrt(windowRates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / windowRates.length);
  const stddevPct = stddev * 100;

  let score;
  if (stddevPct < 5) score = 85;
  else if (stddevPct < 10) score = 60;
  else if (stddevPct < 20) score = 40;
  else if (stddevPct < 35) score = 25;
  else score = 15;

  return {
    score,
    detail: `Win rate stddev: ${stddevPct.toFixed(1)}% across ${windowRates.length} weekly windows (avg ${(mean * 100).toFixed(0)}%)`,
  };
}

function calcTimingPrecision(trades) {
  const timestamps = trades.map((t) => getTimestamp(t)).filter(Boolean).sort();
  if (timestamps.length < 3) return { score: 0, detail: "Need more trades" };

  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean === 0) return { score: 100, detail: "Zero-interval trades (instant)" };

  const stddev = Math.sqrt(intervals.reduce((sum, iv) => sum + (iv - mean) ** 2, 0) / intervals.length);
  const cv = stddev / mean;

  // Interval regularity (low CV = very regular = bot-like)
  let cvScore;
  if (cv < 0.1) cvScore = 95;
  else if (cv < 0.3) cvScore = 70;
  else if (cv < 0.7) cvScore = 45;
  else if (cv < 1.5) cvScore = 25;
  else cvScore = 10;

  // Sub-minute percentage (strong bot indicator)
  const subMinute = intervals.filter((iv) => iv < 60000).length;
  const subMinutePct = (subMinute / intervals.length) * 100;
  if (subMinutePct > 60) cvScore = Math.min(100, cvScore + 20);
  else if (subMinutePct > 30) cvScore = Math.min(100, cvScore + 10);

  // 24h coverage — only a MILD signal (humans can trade all day)
  const uniqueHours = new Set(timestamps.map((ts) => new Date(ts).getUTCHours())).size;
  const uniqueDays = new Set(timestamps.map((ts) => {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  })).size;

  let coverageBonus = 0;
  if (uniqueDays >= 3 && uniqueHours >= 23) coverageBonus = 15; // 23+ hours over 3+ days is suspicious
  else if (uniqueDays >= 3 && uniqueHours >= 20) coverageBonus = 8;
  // No bonus for < 20 hours — that's normal for an active trader

  const finalScore = Math.min(100, cvScore + coverageBonus);

  const avgInterval = mean < 60000
    ? `${(mean / 1000).toFixed(1)}s`
    : mean < 3600000
      ? `${(mean / 60000).toFixed(1)}min`
      : `${(mean / 3600000).toFixed(1)}hr`;

  return {
    score: finalScore,
    detail: `Active ${uniqueHours}/24 hrs over ${uniqueDays} day(s), avg interval: ${avgInterval}, ${subMinutePct.toFixed(0)}% within 1 min`,
  };
}

function calcSizeUniformity(trades) {
  const sizes = trades.map((t) => parseFloat(t.size)).filter((s) => s > 0);
  if (sizes.length < 3) return { score: 0, detail: "Need more trades with size data" };

  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const stddev = Math.sqrt(sizes.reduce((sum, s) => sum + (s - mean) ** 2, 0) / sizes.length);
  const cv = stddev / (mean || 1);

  const sizeMap = {};
  sizes.forEach((s) => {
    const rounded = Math.round(s * 100) / 100;
    sizeMap[rounded] = (sizeMap[rounded] || 0) + 1;
  });
  const maxRepeats = Math.max(...Object.values(sizeMap));
  const repeatPct = (maxRepeats / sizes.length) * 100;

  let score;
  if (cv < 0.03) score = 98;     // nearly identical sizes = very bot-like
  else if (cv < 0.1) score = 85;
  else if (cv < 0.25) score = 60;
  else if (cv < 0.5) score = 35;
  else score = 15;

  if (repeatPct > 70) score = Math.min(100, score + 10); // very high repeat = bot
  else if (repeatPct > 40) score = Math.min(100, score + 5);

  const avgDisplay = mean >= 1000 ? `$${(mean / 1000).toFixed(1)}K` : `$${mean.toFixed(0)}`;

  return {
    score,
    detail: `Size CV: ${cv.toFixed(2)}, avg: ${avgDisplay}, ${repeatPct.toFixed(0)}% identical sizes`,
  };
}

function calcMarketDiversity(trades) {
  const uniqueMarkets = new Set(trades.map((t) => t.title || t.conditionId || t.market)).size;
  const timestamps = trades.map((t) => getTimestamp(t)).filter(Boolean).sort();

  const days = timestamps.length >= 2
    ? (timestamps[timestamps.length - 1] - timestamps[0]) / 86400000
    : 1;

  const marketsPerDay = uniqueMarkets / Math.max(days, 1);

  // Higher thresholds — active humans follow multiple markets
  let score;
  if (marketsPerDay > 20) score = 90;
  else if (marketsPerDay > 10) score = 70;
  else if (marketsPerDay > 5) score = 45;
  else if (marketsPerDay > 2) score = 25;
  else score = 10;

  return {
    score,
    detail: `${uniqueMarkets} markets over ${days.toFixed(1)} days (${marketsPerDay.toFixed(1)}/day)`,
  };
}

function calcHoldingDuration(trades) {
  const byMarket = {};
  trades.forEach((t) => {
    const key = t.title || t.conditionId || t.market || "unknown";
    if (!byMarket[key]) byMarket[key] = [];
    byMarket[key].push(t);
  });

  const holdTimes = [];
  Object.values(byMarket).forEach((marketTrades) => {
    const sorted = [...marketTrades].sort((a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0));
    let lastBuy = null;
    sorted.forEach((t) => {
      const side = (t.side || "").toUpperCase();
      const time = getTimestamp(t);
      if (side === "BUY" || side === "B") {
        lastBuy = time;
      } else if ((side === "SELL" || side === "S") && lastBuy) {
        holdTimes.push(time - lastBuy);
        lastBuy = null;
      }
    });
  });

  if (holdTimes.length === 0) {
    const intervals = [];
    Object.values(byMarket).forEach((marketTrades) => {
      if (marketTrades.length < 2) return;
      const times = marketTrades.map((t) => getTimestamp(t)).filter(Boolean).sort();
      for (let i = 1; i < times.length; i++) intervals.push(times[i] - times[i - 1]);
    });

    if (intervals.length === 0) return { score: 50, detail: "Cannot determine hold times" };

    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const avgHours = avg / 3600000;

    let score;
    if (avgHours < 0.05) score = 95;      // < 3 min re-entry = very bot-like
    else if (avgHours < 0.5) score = 70;
    else if (avgHours < 4) score = 45;
    else if (avgHours < 24) score = 25;
    else score = 10;

    const display = avgHours < 1 ? `${(avgHours * 60).toFixed(0)}min` : `${avgHours.toFixed(1)}hr`;
    return { score, detail: `Avg market re-entry: ${display}` };
  }

  const avgHold = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length / 3600000;

  let score;
  if (avgHold < 0.05) score = 95;         // < 3 min hold = clearly automated
  else if (avgHold < 0.5) score = 75;
  else if (avgHold < 4) score = 45;
  else if (avgHold < 24) score = 25;
  else score = 10;

  const display = avgHold < 1 ? `${(avgHold * 60).toFixed(0)}min` : `${avgHold.toFixed(1)}hr`;
  return { score, detail: `Avg hold: ${display} across ${holdTimes.length} positions` };
}
