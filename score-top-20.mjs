/**
 * Top-20 Bot Scoring Test — v5 Algorithm
 * Run: node score-top-20.mjs
 * Fetches top 20 Polymarket traders by weekly PnL, scores each with v5 algo.
 */

import fs from "fs";

// ── API ──────────────────────────────────────────────────────────────────────

async function fetchLeaderboard(limit = 20) {
  const url = `https://data-api.polymarket.com/v1/leaderboard?limit=${limit}&timePeriod=ALL&orderBy=PNL`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Leaderboard HTTP ${res.status}`);
  return res.json();
}

async function fetchTrades(address) {
  const PAGE = 1000;
  const all = [];
  const seen = new Set();
  for (let page = 0; page < 3; page++) {
    const offset = page * PAGE;
    const url = `https://data-api.polymarket.com/trades?user=${address}&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) { console.warn(`  Trades HTTP ${res.status}`); break; }
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.data || data.trades || []);
    if (rows.length === 0) break;
    for (const t of rows) {
      const key = t.transactionHash || `${t.conditionId}:${t.timestamp}:${t.price}`;
      if (!seen.has(key)) { seen.add(key); all.push(t); }
    }
    if (rows.length < PAGE) break;
    await new Promise(r => setTimeout(r, 300));
  }
  return all;
}

// ── v5 Scoring Algorithm ─────────────────────────────────────────────────────

function getTs(t) {
  if (t.match_time) return new Date(t.match_time).getTime();
  if (typeof t.timestamp === "number") return t.timestamp > 1e12 ? t.timestamp : t.timestamp * 1000;
  if (t.created_at) return new Date(t.created_at).getTime();
  return null;
}

function getCategory(t) {
  const slug = (t.slug || t.eventSlug || "").toLowerCase();
  if (/^(nba|nhl|nfl|mlb|mls|epl|ucl|bund|laliga|lal|liga|seri|copa|ncaa|f1|ufc|afc|nfc|tennis|golf)-/.test(slug)) return "Sports";
  const q = (t.title || t.question || "").toLowerCase();
  if (q.match(/\bvs\.\s|\bo\/u\s\d|\bspread:\s|\btotal:\s|\bmoneyline\b|\bover\/under\b|\bwill .+ win on \d{4}/)) return "Sports";
  if (q.match(/bitcoin|btc|ethereum|eth|solana|sol|crypto|defi|nft|token|\$\d+k|price above|price below/)) return "Crypto";
  if (q.match(/trump|biden|harris|election|president|congress|senate|republican|democrat|primary|ballot|vote/)) return "Politics";
  if (q.match(/nba|nfl|nhl|mlb|mls|fifa|premier league|la liga|bundesliga|serie a|olympic|super bowl|world cup|championship|playoffs|ncaa|march madness|tennis|golf|f1|ufc|boxing/)) return "Sports";
  return "Other";
}

function calcTradeFrequency(trades, spanDays) {
  const tpd = trades.length / Math.max(spanDays, 1);
  let score;
  if (tpd >= 200) score = 95;
  else if (tpd >= 100) score = 85;
  else if (tpd >= 50)  score = 75;
  else if (tpd >= 20)  score = 55;
  else if (tpd >= 5)   score = 30;
  else score = 10;
  return { score, tradesPerDay: tpd, detail: `${tpd.toFixed(1)} trades/day` };
}

function calcTimingPattern(timestamps, spanDays) {
  if (timestamps.length < 3) return { score: 0, activeHoursPerDay: 0, tradesPerActiveHour: 0, detail: "n/a" };
  const dayHourSlots = new Set(timestamps.map(t => {
    const d = new Date(t);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
  }));
  const uniqueDays = new Set(timestamps.map(t => {
    const d = new Date(t);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  }));
  const activeHoursPerDay = Math.min(24, dayHourSlots.size / Math.max(uniqueDays.size, 1));

  let hourScore;
  if (activeHoursPerDay >= 22)      hourScore = 98;
  else if (activeHoursPerDay >= 18) hourScore = 85;
  else if (activeHoursPerDay >= 14) hourScore = 60;
  else if (activeHoursPerDay >= 10) hourScore = 35;
  else                               hourScore = 15;

  const tradesPerDay = timestamps.length / Math.max(spanDays, 1);
  const tradesPerActiveHour = tradesPerDay / Math.max(activeHoursPerDay, 1);
  let intensityScore;
  if (tradesPerActiveHour >= 20)      intensityScore = 95;
  else if (tradesPerActiveHour >= 10) intensityScore = 80;
  else if (tradesPerActiveHour >= 5)  intensityScore = 60;
  else if (tradesPerActiveHour >= 2)  intensityScore = 35;
  else                                 intensityScore = 15;

  let score = Math.max(hourScore, intensityScore);
  if (uniqueDays.size >= 3) {
    const nightDays = new Set(
      timestamps.filter(t => { const h = new Date(t).getUTCHours(); return h >= 2 && h < 6; })
        .map(t => { const d = new Date(t); return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`; })
    );
    const nf = nightDays.size / uniqueDays.size;
    if (nf > 0.5) score = Math.min(100, score + 15);
    else if (nf > 0.3) score = Math.min(100, score + 8);
  }
  return { score, activeHoursPerDay, tradesPerActiveHour, detail: `${activeHoursPerDay.toFixed(1)}/24 hr/day · ${tradesPerActiveHour.toFixed(1)} t/hr` };
}

function calcIntervalRegularity(timestamps) {
  if (timestamps.length < 10) return { score: 50, cv: null, detail: "n/a" };
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) intervals.push(timestamps[i] - timestamps[i - 1]);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean === 0) return { score: 95, cv: 0, detail: "zero mean" };
  const stddev = Math.sqrt(intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length);
  const cv = stddev / mean;
  let score;
  if (cv < 0.3)      score = 95;
  else if (cv < 0.5) score = 75;
  else if (cv < 1.0) score = 45;
  else if (cv < 2.0) score = 25;
  else               score = 10;
  const avgSec = mean / 1000;
  const avgDisp = avgSec < 60 ? `${avgSec.toFixed(0)}s` : `${(avgSec/60).toFixed(1)}min`;
  return { score, cv, detail: `CV=${cv.toFixed(2)}, avg=${avgDisp}` };
}

function calcWinRate(trades) {
  const byMarket = {};
  for (const t of trades) {
    const key = t.conditionId || t.title || "?";
    if (!byMarket[key]) byMarket[key] = [];
    byMarket[key].push(t);
  }
  let wins = 0, total = 0;
  for (const mTrades of Object.values(byMarket)) {
    const sorted = mTrades.slice().sort((a, b) => (getTs(a) || 0) - (getTs(b) || 0));
    let lastBuy = null;
    for (const t of sorted) {
      const side = (t.side || "").toUpperCase();
      if (side === "BUY" || side === "B") { lastBuy = t; }
      else if ((side === "SELL" || side === "S") && lastBuy) {
        const bp = parseFloat(lastBuy.price) || 0;
        const sp = parseFloat(t.price) || 0;
        if (bp > 0 && sp > 0) { total++; if (sp > bp) wins++; }
        lastBuy = null;
      }
    }
  }
  if (total < 5) return { score: 50, rawWinRate: null, detail: "insufficient pairs" };
  const wr = wins / total;
  let score;
  if (wr >= 0.95)      score = 95;
  else if (wr >= 0.85) score = 80;
  else if (wr >= 0.75) score = 60;
  else if (wr >= 0.60) score = 35;
  else                  score = 15;
  return { score, rawWinRate: wr, detail: `${Math.round(wr * 100)}% (${total} pairs)` };
}

function calcSizeUniformity(trades) {
  const sizes = trades.map(t => parseFloat(t.size)).filter(s => s > 0);
  if (sizes.length < 3) return { score: 0, cv: null, detail: "n/a" };
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const stddev = Math.sqrt(sizes.reduce((s, v) => s + (v - mean) ** 2, 0) / sizes.length);
  const cv = stddev / (mean || 1);
  let score;
  if (cv < 0.10)      score = 95;
  else if (cv < 0.20) score = 80;
  else if (cv < 0.35) score = 55;
  else if (cv < 0.50) score = 30;
  else                 score = 10;
  return { score, cv, detail: `CV=${cv.toFixed(2)}` };
}

function calcMarketFocus(trades) {
  let crypto = 0, sports = 0, politics = 0;
  for (const t of trades) {
    const cat = getCategory(t);
    if (cat === "Crypto") crypto++;
    else if (cat === "Sports") sports++;
    else if (cat === "Politics") politics++;
  }
  const n = trades.length;
  const cp = crypto / n, sp = sports / n, pp = politics / n;
  let score;
  if (cp > 0.80)      score = 85;
  else if (cp > 0.60) score = 65;
  else if (pp > 0.60) score = 15;
  else if (sp > 0.60) score = 50;
  else                 score = 35;
  return { score, detail: `${Math.round(cp*100)}% crypto, ${Math.round(sp*100)}% sports, ${Math.round(pp*100)}% politics` };
}

function scoreWallet(trades) {
  if (!trades || trades.length < 20) {
    return { score: 0, classification: "Insufficient Data", eliminatedBy: null, factors: {} };
  }

  const timestamps = trades.map(getTs).filter(Boolean).sort((a, b) => a - b);
  const spanHours = timestamps.length >= 2
    ? (timestamps[timestamps.length - 1] - timestamps[0]) / 3_600_000
    : 0;
  const spanDays = Math.max(spanHours / 24, 1);

  // Eliminatory rules
  if (timestamps.length >= 100) {
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) intervals.push(timestamps[i] - timestamps[i - 1]);
    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    if (median < 120_000) {
      return { score: 92, classification: "Likely Bot", eliminatedBy: `Rule A: median interval ${(median/1000).toFixed(0)}s`, spanDays, tradesPerDay: (trades.length / spanDays).toFixed(1), tradeCount: trades.length, factors: {} };
    }
  }

  if (trades.length >= 2900) {
    return { score: 82, classification: "Likely Bot", eliminatedBy: "Rule B: API cap (3000+ trades)", spanDays, tradesPerDay: (trades.length / spanDays).toFixed(1), tradeCount: trades.length, factors: {} };
  }

  if (timestamps.length >= 10) {
    let maxW = 0, left = 0;
    for (let r = 0; r < timestamps.length; r++) {
      while (timestamps[r] - timestamps[left] > 60_000) left++;
      maxW = Math.max(maxW, r - left + 1);
    }
    if (maxW >= 10) {
      return { score: 90, classification: "Likely Bot", eliminatedBy: `Rule C: ${maxW} trades in 60s`, spanDays, tradesPerDay: (trades.length / spanDays).toFixed(1), tradeCount: trades.length, factors: {} };
    }
  }

  const f1 = calcTradeFrequency(trades, spanDays);
  const f2 = calcTimingPattern(timestamps, spanDays);
  const f3 = calcIntervalRegularity(timestamps);
  const f4 = calcWinRate(trades);
  const f5 = calcSizeUniformity(trades);
  const f6 = calcMarketFocus(trades);

  const weighted = [
    { name: "Timing",    w: 0.25, f: f2 },
    { name: "Frequency", w: 0.20, f: f1 },
    { name: "Interval",  w: 0.20, f: f3 },
    { name: "Size",      w: 0.15, f: f5 },
    { name: "Focus",     w: 0.10, f: f6 },
    { name: "WinRate",   w: 0.10, f: f4 },
  ];

  let score = Math.round(weighted.reduce((s, { w, f }) => s + f.score * w, 0));

  if (f2.activeHoursPerDay >= 22) score = Math.max(score, 85);
  if (f4.rawWinRate >= 0.95 && f1.tradesPerDay >= 100) score = Math.max(score, 80);
  if (f5.cv !== null && f5.cv < 0.10 && f1.tradesPerDay >= 50) score = Math.max(score, 78);
  if (f2.tradesPerActiveHour >= 10 && f1.tradesPerDay >= 20) score = Math.max(score, 72);

  score = Math.min(100, Math.max(0, score));

  const classification = score >= 60 ? "Likely Bot" : score >= 35 ? "Uncertain" : "Likely Human";

  return {
    score,
    classification,
    eliminatedBy: null,
    spanDays,
    tradesPerDay: f1.tradesPerDay.toFixed(1),
    tradeCount: trades.length,
    factors: {
      timing:    { score: f2.score, detail: f2.detail },
      frequency: { score: f1.score, detail: f1.detail },
      interval:  { score: f3.score, detail: f3.detail },
      size:      { score: f5.score, detail: f5.detail },
      focus:     { score: f6.score, detail: f6.detail },
      winrate:   { score: f4.score, detail: f4.detail },
    },
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching top 20 traders…");
  const leaderboard = await fetchLeaderboard(20);

  if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
    console.error("No leaderboard data returned:", leaderboard);
    return;
  }

  const traders = leaderboard.slice(0, 20);
  console.log(`Got ${traders.length} traders.\n`);

  const results = [];

  for (let i = 0; i < traders.length; i++) {
    const trader = traders[i];
    const addr = trader.proxyWallet || trader.address || trader.walletAddress;
    const name = trader.name || trader.pseudonym || trader.userName || addr?.slice(0, 10);
    const pnl = trader.pnl ?? trader.pnlTotal ?? null;

    if (!addr) {
      console.log(`[${i + 1}] Skipping (no address): ${JSON.stringify(trader).slice(0, 80)}`);
      continue;
    }

    console.log(`[${i + 1}/20] ${name} — fetching trades…`);
    const trades = await fetchTrades(addr);
    console.log(`  → ${trades.length} trades`);

    const result = scoreWallet(trades);
    results.push({ rank: i + 1, name, address: addr, pnl, ...result });

    const flag = result.eliminatedBy ? ` ← ${result.eliminatedBy}` : "";
    const factorStr = result.eliminatedBy ? "" : ` | timing:${result.factors.timing?.score} freq:${result.factors.frequency?.score} interval:${result.factors.interval?.score} size:${result.factors.size?.score}`;
    console.log(`  → Score: ${result.score} (${result.classification})${flag}${factorStr}`);

    await new Promise(r => setTimeout(r, 400));
  }

  // Write SCORING_RESULTS.md
  const botCount = results.filter(r => r.classification === "Likely Bot").length;
  const uncertainCount = results.filter(r => r.classification === "Uncertain").length;
  const humanCount = results.filter(r => r.classification === "Likely Human").length;

  const lines = [
    "# SCORING_RESULTS.md — Bot Scoring v5 Top-20 Test",
    "",
    `Run date: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## Summary",
    "",
    `| Classification | Count |`,
    `|---|---|`,
    `| Likely Bot | ${botCount} |`,
    `| Uncertain | ${uncertainCount} |`,
    `| Likely Human | ${humanCount} |`,
    `| Total | ${results.length} |`,
    "",
    "## Results",
    "",
    "| Rank | Name | Score | Class | Trades | T/Day | Span | Key Signal |",
    "|---|---|---|---|---|---|---|---|",
  ];

  for (const r of results) {
    const keySignal = r.eliminatedBy || (() => {
      if (!r.factors.timing) return "n/a";
      const scores = [
        `timing:${r.factors.timing.score}`,
        `freq:${r.factors.frequency.score}`,
        `interval:${r.factors.interval.score}`,
        `size:${r.factors.size.score}`,
        `focus:${r.factors.focus.score}`,
        `wr:${r.factors.winrate.score}`,
      ];
      return scores.join(", ");
    })();
    const pnlStr = r.pnl != null ? `$${Math.round(r.pnl).toLocaleString()}` : "—";
    lines.push(`| ${r.rank} | ${r.name} (${pnlStr}) | **${r.score}** | ${r.classification} | ${r.tradeCount} | ${r.tradesPerDay}/d | ${typeof r.spanDays === "number" ? r.spanDays.toFixed(0) : r.spanDays}d | ${keySignal} |`);
  }

  lines.push("", "## Factor Detail (non-eliminated wallets)", "");
  for (const r of results) {
    if (r.eliminatedBy) continue;
    lines.push(`### #${r.rank} ${r.name} — Score ${r.score} (${r.classification})`);
    lines.push(`- Timing: ${r.factors.timing?.score} — ${r.factors.timing?.detail}`);
    lines.push(`- Frequency: ${r.factors.frequency?.score} — ${r.factors.frequency?.detail}`);
    lines.push(`- Interval Regularity: ${r.factors.interval?.score} — ${r.factors.interval?.detail}`);
    lines.push(`- Size Uniformity: ${r.factors.size?.score} — ${r.factors.size?.detail}`);
    lines.push(`- Market Focus: ${r.factors.focus?.score} — ${r.factors.focus?.detail}`);
    lines.push(`- Win Rate: ${r.factors.winrate?.score} — ${r.factors.winrate?.detail}`);
    lines.push("");
  }

  fs.writeFileSync("SCORING_RESULTS.md", lines.join("\n"), "utf8");
  console.log(`\n✓ SCORING_RESULTS.md written`);
  console.log(`\nSummary: ${botCount} bots, ${uncertainCount} uncertain, ${humanCount} humans out of ${results.length} traders`);
}

main().catch(console.error);
