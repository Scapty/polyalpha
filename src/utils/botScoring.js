import { getMarketCategory } from "./api";

export function computeMetrics(activity, positions) {
  if (!activity || activity.length < 5) {
    return { insufficient: true, tradeCount: activity?.length || 0 };
  }

  const timestamps = activity
    .map(a => {
      const ts = a.timestamp;
      return typeof ts === 'number' && ts < 10000000000 ? ts * 1000 : ts;
    })
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b);

  const daySpan = Math.max((timestamps[timestamps.length - 1] - timestamps[0]) / 86400000, 0.1);

  // ── Order clustering: group fills within 30s on same market = 1 order ──
  let estimatedOrders = 0;
  let lastMarket = null;
  let lastTs = 0;
  const sorted = [...activity].sort((a, b) => {
    const tsA = typeof a.timestamp === 'number' && a.timestamp < 1e10 ? a.timestamp * 1000 : a.timestamp;
    const tsB = typeof b.timestamp === 'number' && b.timestamp < 1e10 ? b.timestamp * 1000 : b.timestamp;
    return tsA - tsB;
  });
  sorted.forEach(a => {
    const market = a.conditionId || a.slug;
    const ts = typeof a.timestamp === 'number' && a.timestamp < 1e10 ? a.timestamp * 1000 : a.timestamp;
    if (market !== lastMarket || (ts - lastTs) > 30000) {
      estimatedOrders++;
    }
    lastMarket = market;
    lastTs = ts;
  });
  const estimatedOrdersPerDay = Math.round((estimatedOrders / daySpan) * 10) / 10;

  // ── Size CV ──
  const sizes = activity
    .map(a => parseFloat(a.size || 0) * parseFloat(a.price || 1))
    .filter(v => v > 0);
  let sizeCV = null;
  if (sizes.length >= 5) {
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const std = Math.sqrt(sizes.reduce((s, v) => s + (v - mean) ** 2, 0) / sizes.length);
    sizeCV = mean > 0 ? Math.round((std / mean) * 100) / 100 : null;
  }

  // ── Both-sides trading ──
  const marketSides = {};
  activity.forEach(a => {
    const market = a.conditionId || a.slug || a.title;
    const outcome = (a.outcome || '').toLowerCase();
    if (!marketSides[market]) marketSides[market] = new Set();
    if (outcome) marketSides[market].add(outcome);
  });
  const marketsWithBothSides = Object.values(marketSides).filter(s => s.size >= 2).length;
  const totalUniqueMarkets = Object.keys(marketSides).length;
  const bothSidesPct = totalUniqueMarkets > 0 ? Math.round(marketsWithBothSides / totalUniqueMarkets * 100) : 0;

  // ── Sleep gap ──
  const hourCounts = new Array(24).fill(0);
  timestamps.forEach(t => hourCounts[new Date(t).getUTCHours()]++);
  const doubled = [...hourCounts, ...hourCounts];
  let maxGap = 0, curGap = 0;
  for (let i = 0; i < doubled.length; i++) {
    if (doubled[i] === 0) { curGap++; maxGap = Math.max(maxGap, curGap); }
    else curGap = 0;
  }
  maxGap = Math.min(maxGap, 24);

  const tradesByDate = {};
  timestamps.forEach(t => {
    const date = new Date(t).toISOString().slice(0, 10);
    const hour = new Date(t).getUTCHours();
    if (!tradesByDate[date]) tradesByDate[date] = new Set();
    tradesByDate[date].add(hour);
  });
  const activeDays = Object.keys(tradesByDate);
  const hoursPerDay = activeDays.map(d => tradesByDate[d].size);
  const avgHoursPerDay = hoursPerDay.length > 0
    ? Math.round((hoursPerDay.reduce((a, b) => a + b, 0) / hoursPerDay.length) * 10) / 10
    : 0;

  // ── Short-term crypto ──
  const stcPattern = /\d+.?min|up.or.down|up\/down|hourly/i;
  const stcCount = activity.filter(a => stcPattern.test(a.title || '') || stcPattern.test(a.slug || '')).length;
  const shortTermCryptoPct = Math.round(stcCount / activity.length * 100);

  // ── Categories ──
  const categories = {};
  activity.forEach(a => {
    const cat = getMarketCategory({ title: a.title, slug: a.slug, eventSlug: a.eventSlug });
    categories[cat] = (categories[cat] || 0) + 1;
  });
  const catPcts = {};
  Object.entries(categories).forEach(([k, v]) => {
    catPcts[k] = Math.round(v / activity.length * 100);
  });

  const buyCount = activity.filter(a => a.side === 'BUY').length;
  const sellCount = activity.filter(a => a.side === 'SELL').length;
  const sellRatio = Math.round(sellCount / activity.length * 100);

  return {
    insufficient: false,
    tradeCount: activity.length,
    apiCapReached: activity.length >= 2900,
    daySpan: Math.round(daySpan * 10) / 10,
    sizeCV,
    bothSidesPct,
    marketsWithBothSides,
    totalUniqueMarkets,
    maxSleepGapHours: maxGap,
    avgHoursPerDay,
    hourDistribution: Object.fromEntries(hourCounts.map((c, i) => [String(i), c]).filter(([, c]) => c > 0)),
    estimatedOrders,
    estimatedOrdersPerDay,
    shortTermCryptoPct,
    categories: catPcts,
    buyCount,
    sellCount,
    sellRatio,
  };
}

export function scoreWallet(metrics) {
  if (metrics.insufficient) {
    return { score: null, classification: "Insufficient Data", factors: {} };
  }

  // FACTOR 1: Order Volume / Trade Frequency (35%)
  let f1;
  const opd = metrics.estimatedOrdersPerDay;
  if (opd >= 200) f1 = 100;
  else if (opd >= 100) f1 = 95;
  else if (opd >= 50) f1 = 85;
  else if (opd >= 30) f1 = 70;
  else if (opd >= 15) f1 = 50;
  else if (opd >= 5) f1 = 25;
  else f1 = 5;

  // FACTOR 2: Trading Behavior (25%)
  let f2 = 30;
  if (metrics.bothSidesPct >= 70) f2 += 50;
  else if (metrics.bothSidesPct >= 40) f2 += 35;
  else if (metrics.bothSidesPct >= 20) f2 += 20;
  else if (metrics.bothSidesPct <= 5) f2 -= 15;
  if (metrics.shortTermCryptoPct >= 80) f2 += 30;
  else if (metrics.shortTermCryptoPct >= 50) f2 += 15;
  if ((metrics.categories?.Politics || 0) >= 80 && metrics.sellRatio < 5) f2 -= 25;
  f2 = Math.max(0, Math.min(100, f2));

  // FACTOR 3: Size Uniformity (25%)
  let f3;
  if (metrics.sizeCV === null) f3 = 50;
  else if (metrics.sizeCV < 0.05) f3 = 98;
  else if (metrics.sizeCV < 0.15) f3 = 85;
  else if (metrics.sizeCV < 0.3) f3 = 70;
  else if (metrics.sizeCV < 0.6) f3 = 50;
  else if (metrics.sizeCV < 1.0) f3 = 30;
  else if (metrics.sizeCV < 2.0) f3 = 15;
  else f3 = 5;

  // FACTOR 4: Activity Pattern (15%)
  let f4;
  const gap = metrics.maxSleepGapHours;
  const hpd = metrics.avgHoursPerDay;
  if (gap <= 1 && hpd >= 16) f4 = 95;
  else if (gap <= 2 && hpd >= 12) f4 = 80;
  else if (gap <= 3) f4 = 65;
  else if (gap <= 5) f4 = 45;
  else if (gap >= 6 && hpd <= 8) f4 = 15;
  else if (gap >= 8) f4 = 5;
  else f4 = 35;

  const factors = {
    orderVolume:     { score: f1, weight: 35, detail: `${metrics.estimatedOrdersPerDay} orders/day` },
    tradingBehavior: { score: f2, weight: 25, detail: `${metrics.bothSidesPct}% both-sides, ${metrics.shortTermCryptoPct}% ST crypto` },
    sizeUniformity:  { score: f3, weight: 25, detail: `CV ${metrics.sizeCV ?? 'N/A'}` },
    activityPattern: { score: f4, weight: 15, detail: `${metrics.maxSleepGapHours}h gap, ${metrics.avgHoursPerDay}h/day` },
  };

  const scores = [f1, f2, f3, f4];
  const maxScore = Math.max(...scores);
  const factorsAbove50 = scores.filter(s => s >= 50).length;
  const weightedScore = Math.round(f1 * 0.35 + f2 * 0.25 + f3 * 0.25 + f4 * 0.15);

  let classification, score;
  if (maxScore >= 80) {
    // One overwhelming signal is enough
    classification = "Bot";
    score = Math.max(weightedScore, 70);
  } else if (factorsAbove50 >= 3) {
    // Three or more moderate signals
    classification = "Bot";
    score = Math.max(weightedScore, 60);
  } else if (factorsAbove50 >= 2 && weightedScore >= 40) {
    // Two moderate signals AND weighted score confirms it
    classification = "Bot";
    score = weightedScore;
  } else {
    classification = "Human";
    score = Math.min(weightedScore, 45);
  }

  return { score, classification, factors };
}
