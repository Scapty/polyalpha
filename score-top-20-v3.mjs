/**
 * Top-20 Bot Scoring — New architecture (size CV + both-sides + sleep gap + order volume)
 * Run: node score-top-20-v3.mjs
 */

import fs from "fs";

async function fetchLeaderboard(limit = 20) {
  const res = await fetch(`https://data-api.polymarket.com/v1/leaderboard?limit=${limit}&timePeriod=ALL&orderBy=PNL`);
  if (!res.ok) throw new Error(`Leaderboard HTTP ${res.status}`);
  return res.json();
}

async function fetchTrades(address) {
  const all = [];
  const seen = new Set();
  for (let page = 0; page < 3; page++) {
    const res = await fetch(`https://data-api.polymarket.com/trades?user=${address}&limit=1000&offset=${page * 1000}`);
    if (!res.ok) break;
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.data || data.trades || []);
    if (!rows.length) break;
    for (const t of rows) {
      const id = t.id || t.transactionHash || (t.timestamp + t.conditionId);
      if (!seen.has(id)) { seen.add(id); all.push(t); }
    }
    if (rows.length < 1000) break;
  }
  return all;
}

function getCategory(t) {
  const text = ((t.title || "") + " " + (t.slug || "") + " " + (t.eventSlug || "")).toLowerCase();
  const sportsSlugs = /^(nba|nhl|nfl|mlb|mls|epl|ucl|bund|laliga|f1|ufc|afc|nfc|tennis|golf)-/;
  if (sportsSlugs.test(t.slug || "")) return "Sports";
  if (/btc|eth|bitcoin|ethereum|crypto|sol|doge|base|coinbase/.test(text)) return "Crypto";
  if (/trump|biden|harris|election|president|congress|senate|democrat|republican|vote|ballot|govern|politic/.test(text)) return "Politics";
  if (/gdp|inflation|fed |rate cut|recession|cpi|unemployment|economy|economic/.test(text)) return "Economics";
  if (/nba|nfl|nhl|mlb|soccer|football|basketball|tennis|golf|ufc|mma|sport|championship|league|vs\.|game \d/.test(text)) return "Sports";
  return "Other";
}

function computeMetrics(activity) {
  const timestamps = activity
    .map((a) => {
      const ts = a.timestamp;
      return typeof ts === "number" && ts < 10_000_000_000 ? ts * 1000 :
             typeof ts === "string" ? new Date(ts).getTime() : ts;
    })
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);

  if (timestamps.length < 5) return { insufficient: true, tradeCount: activity.length };

  const daySpan = Math.max((timestamps[timestamps.length - 1] - timestamps[0]) / 86_400_000, 1);

  // A: Size CV
  const tradeSizes = activity.map((a) => parseFloat(a.size || 0) * parseFloat(a.price || 1)).filter((v) => v > 0);
  let sizeCV = null, avgTradeSize = null;
  if (tradeSizes.length >= 5) {
    const mean = tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length;
    const std = Math.sqrt(tradeSizes.reduce((s, v) => s + (v - mean) ** 2, 0) / tradeSizes.length);
    sizeCV = mean > 0 ? Math.round((std / mean) * 100) / 100 : null;
    avgTradeSize = Math.round(mean);
  }

  // B: Both-sides (YES/NO on same market — must use outcome, NOT side BUY/SELL)
  const marketSides = {};
  activity.forEach((a) => {
    const market = a.conditionId || a.slug || a.title;
    const outcome = (a.outcome || "").toLowerCase().trim();
    if (!outcome) return;
    if (!marketSides[market]) marketSides[market] = new Set();
    marketSides[market].add(outcome);
  });
  const marketsWithBothSides = Object.values(marketSides).filter((s) => s.size >= 2).length;
  const totalUniqueMarkets = Object.keys(marketSides).length;
  const bothSidesPct = totalUniqueMarkets > 0 ? Math.round((marketsWithBothSides / totalUniqueMarkets) * 100) : 0;

  // C: Sleep gap
  const hourCounts = new Array(24).fill(0);
  timestamps.forEach((t) => { hourCounts[new Date(t).getUTCHours()]++; });
  const doubled = [...hourCounts, ...hourCounts];
  let maxGap = 0, curGap = 0;
  for (const c of doubled) { if (c === 0) { curGap++; maxGap = Math.max(maxGap, curGap); } else curGap = 0; }
  const maxSleepGapHours = Math.min(maxGap, 24);

  const tradesByDate = {};
  timestamps.forEach((t) => {
    const date = new Date(t).toISOString().slice(0, 10);
    const hour = new Date(t).getUTCHours();
    if (!tradesByDate[date]) tradesByDate[date] = new Set();
    tradesByDate[date].add(hour);
  });
  const activeDays = Object.keys(tradesByDate);
  const hoursPerDay = activeDays.map((d) => tradesByDate[d].size);
  const avgHoursPerDay = Math.round((hoursPerDay.reduce((a, b) => a + b, 0) / hoursPerDay.length) * 10) / 10;

  // D: Short-term crypto
  const shortTermCryptoPatterns = /\d+.?min|15-minute|5-minute|1-hour|up or down|up\/down|hourly/i;
  const shortTermCryptoPct = Math.round(activity.filter((a) =>
    shortTermCryptoPatterns.test(a.title || "") || shortTermCryptoPatterns.test(a.slug || "")).length / activity.length * 100);

  // E: Buy/sell
  const buyCount = activity.filter((a) => (a.side || "").toUpperCase() === "BUY").length;
  const sellCount = activity.filter((a) => (a.side || "").toUpperCase() === "SELL").length;
  const sellRatio = Math.round((sellCount / activity.length) * 100);

  // F: Order clustering
  const sorted = activity.map((a) => {
    let ts = a.timestamp;
    if (typeof ts === "number" && ts < 10_000_000_000) ts = ts * 1000;
    else if (typeof ts === "string") ts = new Date(ts).getTime();
    return { ...a, _ts: ts };
  }).sort((a, b) => a._ts - b._ts);

  let estimatedOrders = 0, lastMarket = null, lastTs = 0;
  for (const a of sorted) {
    const market = a.conditionId || a.slug;
    if (market !== lastMarket || a._ts - lastTs > 30000) estimatedOrders++;
    lastMarket = market; lastTs = a._ts;
  }
  const estimatedOrdersPerDay = Math.round((estimatedOrders / daySpan) * 10) / 10;

  // Categories
  const cats = {};
  activity.forEach((a) => { const c = getCategory(a); cats[c] = (cats[c] || 0) + 1; });
  const catPcts = {};
  Object.entries(cats).forEach(([k, v]) => { catPcts[k] = Math.round(v / activity.length * 100); });

  return {
    insufficient: false, tradeCount: activity.length, apiCapReached: activity.length >= 2900,
    daySpan: Math.round(daySpan), totalActiveDays: activeDays.length,
    sizeCV, avgTradeSize,
    bothSidesPct, marketsWithBothSides, totalUniqueMarkets,
    maxSleepGapHours, avgHoursPerDay,
    shortTermCryptoPct,
    buyCount, sellCount, sellRatio,
    estimatedOrders, estimatedOrdersPerDay,
    focusRatio: Math.round((estimatedOrders / Math.max(totalUniqueMarkets, 1)) * 10) / 10,
    categories: catPcts,
  };
}

function scoreWallet(m) {
  const opd = m.estimatedOrdersPerDay;
  let f1 = opd >= 200 ? 100 : opd >= 100 ? 95 : opd >= 50 ? 85 : opd >= 30 ? 70 : opd >= 15 ? 50 : opd >= 5 ? 25 : 5;

  let f2 = 30;
  if (m.bothSidesPct >= 70) f2 += 50;
  else if (m.bothSidesPct >= 40) f2 += 35;
  else if (m.bothSidesPct >= 20) f2 += 20;
  else if (m.bothSidesPct <= 5) f2 -= 15;
  if (m.shortTermCryptoPct >= 80) f2 += 30;
  else if (m.shortTermCryptoPct >= 50) f2 += 15;
  if ((m.categories?.Politics || 0) >= 80 && m.sellRatio < 5) f2 -= 25;
  f2 = Math.max(0, Math.min(100, f2));

  const cv = m.sizeCV;
  let f3 = cv === null ? 50 :
    cv < 0.05 ? 98 : cv < 0.15 ? 85 : cv < 0.3 ? 70 : cv < 0.6 ? 50 :
    cv < 1.0 ? 30 : cv < 2.0 ? 15 : 5;

  const gap = m.maxSleepGapHours, hpd = m.avgHoursPerDay;
  let f4 = (gap <= 1 && hpd >= 16) ? 95 : (gap <= 2 && hpd >= 12) ? 80 :
    gap <= 3 ? 65 : gap <= 5 ? 45 : (gap >= 6 && hpd <= 8) ? 15 : gap >= 8 ? 5 : 35;

  const scores = [f1, f2, f3, f4];
  const maxScore = Math.max(...scores);
  const factorsAbove50 = scores.filter(s => s >= 50).length;
  const weightedScore = Math.round(f1 * 0.35 + f2 * 0.25 + f3 * 0.25 + f4 * 0.15);

  let classification, score;
  if (maxScore >= 80) { classification = "Bot"; score = Math.max(weightedScore, 70); }
  else if (factorsAbove50 >= 3) { classification = "Bot"; score = Math.max(weightedScore, 60); }
  else if (factorsAbove50 >= 2 && weightedScore >= 40) { classification = "Bot"; score = weightedScore; }
  else { classification = "Human"; score = Math.min(weightedScore, 45); }

  return { score, classification,
    factors: { f1, f2, f3, f4, maxScore, factorsAbove50, weightedScore }
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const board = await fetchLeaderboard(20);
const traders = Array.isArray(board) ? board : (board.data || board.leaderboard || []);
console.log(`\nFetched ${traders.length} traders\n`);

const results = [];

for (let i = 0; i < traders.length; i++) {
  const t = traders[i];
  const address = t.proxyWallet || t.address || t.userAddress;
  const name = t.userName || t.name || `Trader ${i + 1}`;

  process.stdout.write(`[${i + 1}/${traders.length}] ${name} (${address.slice(0, 8)}…) `);

  let trades;
  try { trades = await fetchTrades(address); }
  catch (e) { console.log(`ERROR`); results.push({ rank: i+1, name, address, error: true }); continue; }

  const m = computeMetrics(trades);
  if (m.insufficient) {
    console.log(`insufficient (${m.tradeCount} trades)`);
    results.push({ rank: i+1, name, address, insufficient: true, tradeCount: m.tradeCount });
    continue;
  }

  const r = scoreWallet(m);
  const { score, classification, factors } = r;

  console.log(`→ ${classification} (${score}) [f1=${factors.f1} f2=${factors.f2} f3=${factors.f3} f4=${factors.f4} max=${factors.maxScore} above50=${factors.factorsAbove50}]`);
  results.push({ rank: i+1, name, address, score, classification, factors, m });

  if (i < traders.length - 1) await new Promise((r) => setTimeout(r, 300));
}

// ── Build report ──────────────────────────────────────────────────────────────

const bots = results.filter(r => r.classification === "Bot");
const humans = results.filter(r => r.classification === "Human");

const lines = [
  `# SCORING_RESULTS_FINAL.md`,
  ``,
  `Generated: ${new Date().toISOString()}`,
  `Algorithm: Trade Frequency (35%) + Trading Behavior (25%) + Size Uniformity (25%) + Activity Pattern (15%)`,
  ``,
  `---`,
  ``,
  `## Summary`,
  `Total: ${traders.length} traders`,
  `Bots: ${bots.length}`,
  `Humans: ${humans.length}`,
  ``,
  `Bot list: ${bots.map(r => r.name).join(", ") || "none"}`,
  `Human list: ${humans.map(r => r.name).join(", ") || "none"}`,
  ``,
  `---`,
  ``,
];

for (const res of results) {
  if (res.error) {
    lines.push(`## ${res.rank}. ${res.name} (${res.address})`, `ERROR fetching trades`, ``, `---`, ``);
    continue;
  }
  if (res.insufficient) {
    lines.push(`## ${res.rank}. ${res.name} (${res.address})`, `Insufficient data: ${res.tradeCount} fills`, ``, `---`, ``);
    continue;
  }
  const { name, address, rank, score, classification, factors, m } = res;
  const catStr = Object.entries(m.categories).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}%`).join(", ");
  lines.push(
    `## ${rank}. ${name} (${address})`,
    `Classification: **${classification}**`,
    `Score: **${score}/100**`,
    ``,
    `| Factor | Score | Detail |`,
    `|--------|-------|--------|`,
    `| Trade Frequency (35%) | ${factors.f1}/100 | ${m.estimatedOrdersPerDay} orders/day |`,
    `| Trading Behavior (25%) | ${factors.f2}/100 | ${m.bothSidesPct}% both-sides, ${m.shortTermCryptoPct}% ST crypto |`,
    `| Size Uniformity (25%) | ${factors.f3}/100 | CV ${m.sizeCV ?? "N/A"} |`,
    `| Activity Pattern (15%) | ${factors.f4}/100 | ${m.maxSleepGapHours}h gap, ${m.avgHoursPerDay}h/day |`,
    ``,
    `Key metrics:`,
    `- Trade fills: ${m.apiCapReached ? m.tradeCount + "+" : m.tradeCount} (estimated orders: ${m.estimatedOrders})`,
    `- Unique markets: ${m.totalUniqueMarkets}`,
    `- Both-sides: ${m.bothSidesPct}%`,
    `- Size CV: ${m.sizeCV ?? "N/A"}`,
    `- Sleep gap: ${m.maxSleepGapHours}h`,
    `- Avg hours/day: ${m.avgHoursPerDay}`,
    `- Categories: ${catStr}`,
    `- Sell ratio: ${m.sellRatio}%`,
    ``,
    `---`,
    ``,
  );
}

fs.writeFileSync("SCORING_RESULTS_FINAL.md", lines.join("\n"));
console.log("\nSaved: SCORING_RESULTS_FINAL.md");
