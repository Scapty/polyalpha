/**
 * 6-Factor Bot Scoring Algorithm v2
 * Decisive classification — minimizes "Uncertain" outcomes.
 *
 * KEY CHANGES from v1:
 * - Trade Frequency is now the dominant signal (weight 0.30)
 * - Tighter classification bands: ≥65 Bot, ≤30 Human (narrow Uncertain zone)
 * - Multiple override rules to force decisive classification
 * - Sub-minute trade intervals are a strong bot signal
 * - 24h trading activity is a strong bot signal
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
    { name: "Trade Frequency", weight: 0.30, score: f1.score, detail: f1.detail, icon: "\u26A1" },
    { name: "Timing Precision", weight: 0.20, score: f3.score, detail: f3.detail, icon: "\u23F1\uFE0F" },
    { name: "Size Uniformity", weight: 0.15, score: f4.score, detail: f4.detail, icon: "\uD83D\uDCCF" },
    { name: "Win Rate Consistency", weight: 0.10, score: f2.score, detail: f2.detail, icon: "\uD83C\uDFAF" },
    { name: "Market Diversity", weight: 0.10, score: f5.score, detail: f5.detail, icon: "\uD83C\uDF10" },
    { name: "Holding Duration", weight: 0.15, score: f6.score, detail: f6.detail, icon: "\u23F3" },
  ];

  const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  let score = Math.round(weightedScore);

  // === OVERRIDE RULES — force decisive classification ===

  // Rule 1: If ANY factor scores 95+ → at least "Likely Bot"
  const anyExtreme = factors.some((f) => f.score >= 95);
  if (anyExtreme) score = Math.max(score, 65);

  // Rule 2: If trade frequency AND timing precision are both high → definitely bot
  if (f1.score >= 70 && f3.score >= 70) score = Math.max(score, 75);

  // Rule 3: If 3+ factors score above 60 → likely bot
  const highFactors = factors.filter((f) => f.score >= 60).length;
  if (highFactors >= 3) score = Math.max(score, 65);

  // Rule 4: If trade frequency is very low AND no extreme factors → likely human
  if (f1.score <= 20 && !anyExtreme && highFactors <= 1) score = Math.min(score, 30);

  // Rule 5: Sub-minute trading is a dead giveaway
  if (f1.subMinuteRatio && f1.subMinuteRatio > 0.5) score = Math.max(score, 80);

  // CLASSIFICATION — narrow Uncertain band (31-64)
  const classification = score >= 65 ? "Likely Bot" : score <= 30 ? "Likely Human" : "Uncertain";

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
    { name: "Trade Frequency", weight: 0.30, score, detail: "Not enough data", icon: "\u26A1" },
    { name: "Timing Precision", weight: 0.20, score, detail: "Not enough data", icon: "\u23F1\uFE0F" },
    { name: "Size Uniformity", weight: 0.15, score, detail: "Not enough data", icon: "\uD83D\uDCCF" },
    { name: "Win Rate Consistency", weight: 0.10, score, detail: "Not enough data", icon: "\uD83C\uDFAF" },
    { name: "Market Diversity", weight: 0.10, score, detail: "Not enough data", icon: "\uD83C\uDF10" },
    { name: "Holding Duration", weight: 0.15, score, detail: "Not enough data", icon: "\u23F3" },
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

  // Median interval (more robust than mean)
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
  const medianMinutes = medianInterval / 60000;

  // Group by hour for clustering
  const hourBuckets = {};
  timestamps.forEach((ts) => {
    const hourKey = Math.floor(ts / 3600000);
    hourBuckets[hourKey] = (hourBuckets[hourKey] || 0) + 1;
  });
  const maxInOneHour = Math.max(...Object.values(hourBuckets));

  // SCORING: aggressive thresholds based on trades per day
  let score;
  if (tradesPerDay >= 100) score = 98;
  else if (tradesPerDay >= 50) score = 90;
  else if (tradesPerDay >= 20) score = 75;
  else if (tradesPerDay >= 10) score = 60;
  else if (tradesPerDay >= 5) score = 40;
  else if (tradesPerDay >= 2) score = 25;
  else score = 10;

  // Bonus: sub-minute trading
  if (subMinuteRatio > 0.7) score = Math.min(100, score + 15);
  else if (subMinuteRatio > 0.3) score = Math.min(100, score + 8);

  // Bonus: extreme clustering
  if (maxInOneHour > 30) score = Math.min(100, score + 10);

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
  if (cv < 0.05) score = 95;
  else if (cv < 0.15) score = 75;
  else if (cv < 0.3) score = 55;
  else if (cv < 0.5) score = 35;
  else score = 15;

  return { score, detail: `Price consistency CV: ${cv.toFixed(3)} (fallback method)` };
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
  else if (stddevPct < 10) score = 65;
  else if (stddevPct < 20) score = 45;
  else if (stddevPct < 35) score = 30;
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

  const subMinute = intervals.filter((iv) => iv < 60000).length;
  const subMinutePct = (subMinute / intervals.length) * 100;

  let cvScore;
  if (cv < 0.2) cvScore = 95;
  else if (cv < 0.5) cvScore = 75;
  else if (cv < 1.0) cvScore = 50;
  else if (cv < 2.0) cvScore = 30;
  else cvScore = 10;

  if (subMinutePct > 50) cvScore = Math.min(100, cvScore + 20);
  else if (subMinutePct > 20) cvScore = Math.min(100, cvScore + 10);

  // 24-hour coverage
  const uniqueHours = new Set(timestamps.map((ts) => new Date(ts).getUTCHours())).size;
  const uniqueDays = new Set(timestamps.map((ts) => {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  })).size;

  let coverageScore = 0;
  if (uniqueDays >= 2) {
    if (uniqueHours >= 22) coverageScore = 98;
    else if (uniqueHours >= 20) coverageScore = 92;
    else if (uniqueHours >= 18) coverageScore = 80;
    else if (uniqueHours >= 16) coverageScore = 60;
    else if (uniqueHours >= 12) coverageScore = 35;
    else coverageScore = 10;
  }

  const finalScore = Math.min(100, Math.max(cvScore, coverageScore));

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
  if (cv < 0.05) score = 98;
  else if (cv < 0.15) score = 90;
  else if (cv < 0.3) score = 70;
  else if (cv < 0.5) score = 45;
  else score = 20;

  if (repeatPct > 50) score = Math.min(100, score + 10);

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

  let score;
  if (marketsPerDay > 10) score = 90;
  else if (marketsPerDay > 5) score = 70;
  else if (marketsPerDay > 2) score = 50;
  else if (marketsPerDay > 1) score = 35;
  else score = 15;

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
    if (avgHours < 0.1) score = 95;
    else if (avgHours < 1) score = 75;
    else if (avgHours < 6) score = 55;
    else if (avgHours < 24) score = 35;
    else score = 15;

    const display = avgHours < 1 ? `${(avgHours * 60).toFixed(0)}min` : `${avgHours.toFixed(1)}hr`;
    return { score, detail: `Avg market re-entry: ${display}` };
  }

  const avgHold = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length / 3600000;

  let score;
  if (avgHold < 0.1) score = 95;
  else if (avgHold < 1) score = 80;
  else if (avgHold < 6) score = 55;
  else if (avgHold < 24) score = 35;
  else score = 10;

  const display = avgHold < 1 ? `${(avgHold * 60).toFixed(0)}min` : `${avgHold.toFixed(1)}hr`;
  return { score, detail: `Avg hold: ${display} across ${holdTimes.length} positions` };
}
