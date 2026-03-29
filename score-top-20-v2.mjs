/**
 * Top-20 Bot Scoring — New Architecture (eliminatory + weighted)
 * Run: node score-top-20-v2.mjs
 */

import fs from "fs";

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchLeaderboard(limit = 20) {
  const url = `https://data-api.polymarket.com/v1/leaderboard?limit=${limit}&timePeriod=ALL&orderBy=PNL`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Leaderboard HTTP ${res.status}`);
  return res.json();
}

async function fetchTrades(address) {
  const all = [];
  const seen = new Set();
  for (let page = 0; page < 3; page++) {
    const url = `https://data-api.polymarket.com/trades?user=${address}&limit=1000&offset=${page * 1000}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.data || data.trades || []);
    if (rows.length === 0) break;
    for (const t of rows) {
      const id = t.id || t.transactionHash || JSON.stringify(t);
      if (!seen.has(id)) { seen.add(id); all.push(t); }
    }
    if (rows.length < 1000) break;
  }
  return all;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function getCategory(t) {
  const text = ((t.title || "") + " " + (t.slug || "") + " " + (t.eventSlug || "")).toLowerCase();
  const sportsSlugs = /^(nba|nhl|nfl|mlb|mls|epl|ucl|bund|laliga|f1|ufc|afc|nfc|tennis|golf)-/;
  if (sportsSlugs.test(t.slug || "")) return "Sports";
  if (/btc|eth|bitcoin|ethereum|crypto|sol|doge|base|coinbase/.test(text)) return "Crypto";
  if (/trump|biden|harris|election|president|congress|senate|democrat|republican|vote|ballot|govern|politic/.test(text)) return "Politics";
  if (/gdp|inflation|fed |rate cut|recession|cpi|unemployment|economy|economic/.test(text)) return "Economics";
  if (/nba|nfl|nhl|mlb|soccer|football|basketball|tennis|golf|ufc|mma|sport|championship|league|vs\.|game \d/.test(text)) return "Sports";
  if (/oscar|grammy|emmy|super bowl|world cup|eurovision|box office|celebrity|kardashian/.test(text)) return "Pop Culture";
  return "Other";
}

function computeMetrics(trades) {
  const timestamps = trades
    .map((a) => {
      let ts = a.timestamp;
      if (typeof ts === "number" && ts < 10_000_000_000) ts = ts * 1000;
      else if (typeof ts === "string") ts = new Date(ts).getTime();
      return ts;
    })
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);

  if (timestamps.length < 5) return { insufficient: true, tradeCount: trades.length };

  // Burst detection
  const minuteBuckets = {};
  timestamps.forEach((t) => {
    const m = Math.floor(t / 60000);
    minuteBuckets[m] = (minuteBuckets[m] || 0) + 1;
  });
  const maxTradesInOneMinute = Math.max(...Object.values(minuteBuckets), 0);

  // Intervals
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push((timestamps[i] - timestamps[i - 1]) / 1000);
  }
  const sorted = intervals.slice().sort((a, b) => a - b);
  const medianIntervalSec = Math.round(sorted[Math.floor(sorted.length / 2)]);
  const avgIntervalSec = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
  const fastest10 = sorted.slice(0, Math.ceil(sorted.length * 0.1));
  const avgFastestBurstSec = Math.round(fastest10.reduce((a, b) => a + b, 0) / fastest10.length);

  // Activity
  const hours = timestamps.map((t) => new Date(t).getUTCHours());
  const hourCounts = {};
  hours.forEach((h) => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
  const nightTradeCount = hours.filter((h) => h >= 2 && h <= 6).length;
  const nightTradePct = Math.round((nightTradeCount / hours.length) * 100);

  const totalDaySpan = (timestamps[timestamps.length - 1] - timestamps[0]) / 86_400_000;
  const tradesPerDay = Math.round((trades.length / Math.max(totalDaySpan, 1)) * 10) / 10;

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
  const maxHoursInOneDay = Math.max(...hoursPerDay);
  const daysWithOver12hActivity = Math.round((hoursPerDay.filter((h) => h >= 12).length / activeDays.length) * 100);
  const activeDaysPct = Math.round((activeDays.length / Math.max(totalDaySpan, 1)) * 100);

  // Size CV
  const tradeValues = trades.map((a) => parseFloat(a.size || 0) * parseFloat(a.price || 0)).filter((v) => v > 0);
  let sizeCV = null;
  if (tradeValues.length >= 5) {
    const mean = tradeValues.reduce((a, b) => a + b, 0) / tradeValues.length;
    const std = Math.sqrt(tradeValues.reduce((s, v) => s + (v - mean) ** 2, 0) / tradeValues.length);
    sizeCV = mean > 0 ? Math.round((std / mean) * 100) / 100 : null;
  }

  const uniqueMarkets = [...new Set(trades.map((a) => a.conditionId || a.slug || a.title))];
  const buys = trades.filter((a) => (a.side || "").toUpperCase() === "BUY").length;
  const sells = trades.filter((a) => (a.side || "").toUpperCase() === "SELL").length;

  const catCounts = {};
  trades.forEach((a) => { const c = getCategory(a); catCounts[c] = (catCounts[c] || 0) + 1; });
  const categories = {};
  Object.entries(catCounts).forEach(([k, v]) => { categories[k] = Math.round((v / trades.length) * 100); });

  return {
    insufficient: false,
    tradeCount: trades.length,
    apiCapReached: trades.length >= 2900,
    maxTradesInOneMinute,
    medianIntervalSec,
    avgIntervalSec,
    avgFastestBurstSec,
    avgHoursPerDay,
    maxHoursInOneDay,
    daysWithOver12hActivity,
    totalActiveDays: activeDays.length,
    nightTradePct,
    tradesPerDay,
    totalDaySpan: Math.round(totalDaySpan),
    activeDaysPct,
    uniqueMarkets: uniqueMarkets.length,
    tradesPerMarket: Math.round(trades.length / uniqueMarkets.length),
    sizeCV,
    buyCount: buys,
    sellCount: sells,
    categories,
  };
}

// ── Eliminatory Rules ─────────────────────────────────────────────────────────

function checkEliminatoryRules(m) {
  if (m.medianIntervalSec < 30 && m.tradeCount >= 100) {
    return { eliminated: true, score: 92, classification: "Likely Bot",
      rule: `E1: Median interval ${m.medianIntervalSec}s across ${m.tradeCount} trades` };
  }
  if (m.apiCapReached) {
    return { eliminated: true, score: 85, classification: "Likely Bot",
      rule: "E2: API cap reached (3000+ trades)" };
  }
  if (m.maxTradesInOneMinute >= 10) {
    return { eliminated: true, score: 90, classification: "Likely Bot",
      rule: `E3: ${m.maxTradesInOneMinute} trades in one minute` };
  }
  if (m.tradesPerDay >= 200 && m.totalDaySpan >= 3) {
    return { eliminated: true, score: 90, classification: "Likely Bot",
      rule: `E4: ${m.tradesPerDay} trades/day over ${m.totalDaySpan} days` };
  }
  return { eliminated: false };
}

// ── Weighted Score ────────────────────────────────────────────────────────────

function computeWeightedScore(m) {
  const median = m.medianIntervalSec;
  let speedScore = median < 30 ? 95 : median < 60 ? 80 : median < 120 ? 60 : median < 300 ? 40 : median < 600 ? 20 : 5;

  const hpd = m.avgHoursPerDay;
  let activityScore = hpd >= 16 ? 95 : hpd >= 12 ? 80 : (hpd >= 8 && m.daysWithOver12hActivity >= 30) ? 65 : hpd >= 6 ? 45 : hpd >= 3 ? 25 : 10;

  const tpd = m.tradesPerDay;
  let volumeScore = tpd >= 100 ? 95 : tpd >= 50 ? 80 : tpd >= 25 ? 65 : tpd >= 10 ? 40 : tpd >= 3 ? 20 : 5;

  let sizeScore = 50;
  if (m.sizeCV !== null) {
    const cv = m.sizeCV;
    sizeScore = cv < 0.1 ? 95 : cv < 0.25 ? 75 : cv < 0.5 ? 50 : cv < 1.0 ? 30 : cv < 2.0 ? 15 : 5;
  }

  let behaviorScore = 50;
  if (m.sellCount === 0 && tpd >= 20) behaviorScore += 15;
  if (m.tradesPerMarket > 50 && median < 120) behaviorScore += 15;
  if ((m.categories?.Crypto || 0) > 70 || (m.categories?.Sports || 0) > 70) behaviorScore += 10;
  if (((m.categories?.Politics || 0) > 50 || (m.categories?.["Pop Culture"] || 0) > 50) && tpd < 15) behaviorScore -= 20;
  behaviorScore = Math.max(0, Math.min(100, behaviorScore));

  const score = Math.round(speedScore * 0.30 + activityScore * 0.25 + volumeScore * 0.20 + sizeScore * 0.15 + behaviorScore * 0.10);
  const classification = score >= 65 ? "Likely Bot" : score >= 40 ? "Uncertain" : "Likely Human";

  return {
    score, classification,
    factors: {
      speed:          { score: speedScore,    weight: 30, value: `${median}s median` },
      activity:       { score: activityScore, weight: 25, value: `${hpd}h/day avg` },
      volume:         { score: volumeScore,   weight: 20, value: `${tpd} trades/day` },
      sizeUniformity: { score: sizeScore,     weight: 15, value: `CV ${m.sizeCV ?? "N/A"}` },
      behavior:       { score: behaviorScore, weight: 10, value: "pattern analysis" },
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const board = await fetchLeaderboard(20);
const traders = Array.isArray(board) ? board : (board.data || board.leaderboard || []);
console.log(`\nFetched ${traders.length} traders from leaderboard\n`);

const lines = ["# SCORING_RESULTS_FINAL.md\n", `Generated: ${new Date().toISOString()}\n`, `Top ${traders.length} traders — new eliminatory + weighted algo\n\n---\n`];

for (let i = 0; i < traders.length; i++) {
  const t = traders[i];
  const address = t.proxyWallet || t.address || t.userAddress;
  const name = t.userName || t.name || `Trader ${i + 1}`;

  process.stdout.write(`[${i + 1}/${traders.length}] ${name} (${address.slice(0, 8)}…) `);

  let trades;
  try {
    trades = await fetchTrades(address);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
    lines.push(`## ${i + 1}. ${name}\nERROR: ${e.message}\n\n`);
    continue;
  }

  const m = computeMetrics(trades);
  if (m.insufficient) {
    console.log(`insufficient data (${m.tradeCount} trades)`);
    lines.push(`## ${i + 1}. ${name} (${address})\nInsufficient data: ${m.tradeCount} trades\n\n`);
    continue;
  }

  const elim = checkEliminatoryRules(m);
  let score, classification, eliminated, elimRule, factors;

  if (elim.eliminated) {
    score = elim.score;
    classification = elim.classification;
    eliminated = true;
    elimRule = elim.rule;
    factors = null;
  } else {
    const r = computeWeightedScore(m);
    score = r.score;
    classification = r.classification;
    eliminated = false;
    elimRule = null;
    factors = r.factors;
  }

  console.log(`→ ${classification} (${score}) ${eliminated ? `[${elimRule}]` : ""}`);

  // Debug log for key wallets
  if (name.toLowerCase().includes("theo") || address.toLowerCase().includes("theo")) {
    console.log("  === THEO DEBUG ===");
    console.log(`  medianIntervalSec: ${m.medianIntervalSec} (< 30? ${m.medianIntervalSec < 30})`);
    console.log(`  tradeCount: ${m.tradeCount}`);
    console.log(`  E1 triggers? ${m.medianIntervalSec < 30 && m.tradeCount >= 100}`);
    console.log(`  avgHoursPerDay: ${m.avgHoursPerDay}, tradesPerDay: ${m.tradesPerDay}, sizeCV: ${m.sizeCV}`);
    if (factors) {
      Object.entries(factors).forEach(([k, v]) => console.log(`  ${k}: ${v.score}/100 (${v.value})`));
    }
  }

  let block = `## ${i + 1}. ${name} (${address})\n`;
  block += `**Score: ${score} — ${classification}**\n\n`;
  if (eliminated) {
    block += `Eliminated by: ${elimRule}\n\n`;
  } else {
    block += `| Factor | Score | Weight | Value |\n|--------|-------|--------|-------|\n`;
    Object.entries(factors).forEach(([k, v]) => {
      block += `| ${k} | ${v.score}/100 | ${v.weight}% | ${v.value} |\n`;
    });
    block += "\n";
  }
  block += `| Metric | Value |\n|--------|-------|\n`;
  block += `| Trades | ${m.apiCapReached ? m.tradeCount + "+" : m.tradeCount} |\n`;
  block += `| Median interval | ${m.medianIntervalSec}s |\n`;
  block += `| Avg hrs/day | ${m.avgHoursPerDay} |\n`;
  block += `| Trades/day | ${m.tradesPerDay} |\n`;
  block += `| Size CV | ${m.sizeCV ?? "N/A"} |\n`;
  block += `| Max burst/min | ${m.maxTradesInOneMinute} |\n`;
  block += `| Night trading | ${m.nightTradePct}% |\n`;
  block += `| Unique markets | ${m.uniqueMarkets} |\n`;
  block += `| Categories | ${Object.entries(m.categories).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}%`).join(", ")} |\n`;
  block += "\n---\n";

  lines.push(block);

  if (i < traders.length - 1) await new Promise(r => setTimeout(r, 300));
}

fs.writeFileSync("SCORING_RESULTS_FINAL.md", lines.join("\n"));
console.log("\nSaved: SCORING_RESULTS_FINAL.md");
