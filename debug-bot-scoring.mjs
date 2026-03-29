/**
 * Bot Scoring Debug Script
 * Run: node debug-bot-scoring.mjs
 * Hits Polymarket Data API directly and runs the LIVE botScoring.js algorithm.
 */

const WALLETS = [
  { name: "Polybotalpha", address: "0x492442eab586f242b53bda933fd5de859c8a3782" },
  { name: "kch123",       address: "0x6a72f61820b26b1fe4d956e17b6dc2a1ea3033ee" },
  { name: "beachboy4",    address: "0xc2e7800b5af46e6093872b177b7a5e7f0563be51" },
  { name: "FeatherLeather",address: "0xd25c72ac0928385610611c8148803dc717334d20" },
  { name: "DrPufferfish", address: "0xdb27bf2ac5d428a9c63dbc914611036855a6c56e" },
];

// ── API Fetchers ───────────────────────────────────────────────────────────────

async function fetchTrades(address, maxPages = 3) {
  const PAGE = 1000;
  const all = [];
  const seen = new Set();
  for (let page = 0; page < maxPages; page++) {
    const offset = page * PAGE;
    const url = `https://data-api.polymarket.com/trades?user=${address}&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) { console.error(`  Trades HTTP ${res.status} at offset ${offset}`); break; }
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

// ── Timestamp helpers ─────────────────────────────────────────────────────────

function getTimestampMs(t) {
  // Raw trade object (not normalized)
  if (t.match_time) return new Date(t.match_time).getTime();
  if (typeof t.timestamp === "number")
    return t.timestamp > 1e12 ? t.timestamp : t.timestamp * 1000;
  if (t.created_at) return new Date(t.created_at).getTime();
  return null;
}

// ── Raw field inspection ───────────────────────────────────────────────────────

function inspectFirstTrade(trades) {
  if (!trades.length) return { error: "no trades" };
  const t = trades[0];
  const raw = t.timestamp ?? t.match_time ?? t.created_at;
  return {
    allKeys: Object.keys(t).sort(),
    timestampField: t.timestamp !== undefined ? "timestamp" : t.match_time !== undefined ? "match_time" : t.created_at !== undefined ? "created_at" : "NONE FOUND",
    rawTimestampValue: raw,
    rawType: typeof raw,
    asDateDirect: new Date(raw).toISOString(),
    asDateSeconds: typeof raw === "number" ? new Date(raw * 1000).toISOString() : "N/A",
    side: t.side,
    size: t.size,
    price: t.price,
    title: (t.title || "").slice(0, 60),
  };
}

// ── Scoring Factors (mirrors botScoring.js exactly) ───────────────────────────

function calcTradeFrequency(trades, spanDays) {
  const tradesPerDay = trades.length / Math.max(spanDays, 1);
  let score;
  if (tradesPerDay >= 200)      score = 95;
  else if (tradesPerDay >= 100) score = 85;
  else if (tradesPerDay >= 50)  score = 75;
  else if (tradesPerDay >= 20)  score = 55;
  else if (tradesPerDay >= 5)   score = 30;
  else                          score = 10;
  return { score, tradesPerDay, detail: `${tradesPerDay.toFixed(1)} trades/day over ${spanDays.toFixed(1)} days` };
}

function calcTimingPattern(timestamps, spanDays) {
  if (timestamps.length < 3) return { score: 0, activeHoursPerDay: 0, tradesPerActiveHour: 0, detail: "Not enough trades" };
  const dayHourSlots = new Set(timestamps.map(t => {
    const d = new Date(t);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
  }));
  const uniqueDays = new Set(timestamps.map(t => {
    const d = new Date(t);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  }));
  const activeHoursPerDay = Math.min(24, dayHourSlots.size / Math.max(uniqueDays.size, 1));

  // Signal 1: 24/7 coverage
  let hourScore;
  if (activeHoursPerDay >= 22)      hourScore = 98;
  else if (activeHoursPerDay >= 18) hourScore = 85;
  else if (activeHoursPerDay >= 14) hourScore = 60;
  else if (activeHoursPerDay >= 10) hourScore = 35;
  else                               hourScore = 15;

  // Signal 2: trade intensity within active windows
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
      timestamps
        .filter(t => { const h = new Date(t).getUTCHours(); return h >= 2 && h < 6; })
        .map(t => { const d = new Date(t); return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`; })
    );
    const nightFrac = nightDays.size / uniqueDays.size;
    if (nightFrac > 0.5) score = Math.min(100, score + 15);
    else if (nightFrac > 0.3) score = Math.min(100, score + 8);
  }
  return {
    score, activeHoursPerDay, tradesPerActiveHour,
    hourScore, intensityScore,
    totalDayHourSlots: dayHourSlots.size,
    uniqueDaysCount: uniqueDays.size,
    detail: `${activeHoursPerDay.toFixed(1)}/24 active hrs/day · ${tradesPerActiveHour.toFixed(1)} trades/active-hr`,
  };
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
    const sorted = mTrades.slice().sort((a, b) => (getTimestampMs(a) || 0) - (getTimestampMs(b) || 0));
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
  if (total < 5) return { score: 50, rawWinRate: null, detail: "Not enough resolved pairs" };
  const winRate = wins / total;
  let score;
  if (winRate >= 0.95)      score = 95;
  else if (winRate >= 0.85) score = 80;
  else if (winRate >= 0.75) score = 60;
  else if (winRate >= 0.60) score = 35;
  else                       score = 15;
  return { score, rawWinRate: winRate, detail: `${Math.round(winRate * 100)}% win rate (${wins}W / ${total - wins}L)` };
}

function calcSizeUniformity(trades) {
  const sizes = trades.map(t => parseFloat(t.size)).filter(s => s > 0);
  if (sizes.length < 3) return { score: 0, cv: null, detail: "Not enough size data" };
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const stddev = Math.sqrt(sizes.reduce((s, v) => s + (v - mean) ** 2, 0) / sizes.length);
  const cv = stddev / (mean || 1);
  let score;
  if (cv < 0.10)      score = 95;
  else if (cv < 0.20) score = 80;
  else if (cv < 0.35) score = 55;
  else if (cv < 0.50) score = 30;
  else                 score = 10;
  return { score, cv, detail: `CV=${cv.toFixed(3)}, mean=$${mean.toFixed(2)}, stddev=$${stddev.toFixed(2)}` };
}

function calcHoldingDuration(trades) {
  const byMarket = {};
  for (const t of trades) {
    const key = t.conditionId || t.title || "?";
    if (!byMarket[key]) byMarket[key] = [];
    byMarket[key].push(t);
  }
  const holdTimes = [];
  for (const mTrades of Object.values(byMarket)) {
    const sorted = mTrades.slice().sort((a, b) => (getTimestampMs(a) || 0) - (getTimestampMs(b) || 0));
    let lastBuyTs = null;
    for (const t of sorted) {
      const side = (t.side || "").toUpperCase();
      const ts = getTimestampMs(t);
      if (side === "BUY" || side === "B") { lastBuyTs = ts; }
      else if ((side === "SELL" || side === "S") && lastBuyTs && ts) {
        const holdMin = (ts - lastBuyTs) / 60_000;
        if (holdMin >= 0) holdTimes.push(holdMin);
        lastBuyTs = null;
      }
    }
  }
  if (!holdTimes.length) return { score: 50, detail: "No resolved buy→sell pairs" };
  const avgHoldMin = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;
  let score;
  if (avgHoldMin < 5)         score = 95;
  else if (avgHoldMin < 30)   score = 80;
  else if (avgHoldMin < 120)  score = 55;
  else if (avgHoldMin < 1440) score = 30;
  else                         score = 10;
  const display = avgHoldMin < 60 ? `${Math.round(avgHoldMin)}min` : avgHoldMin < 1440 ? `${(avgHoldMin / 60).toFixed(1)}hr` : `${(avgHoldMin / 1440).toFixed(1)}d`;
  return { score, detail: `avg hold ${display} (${holdTimes.length} pairs)` };
}

function calcMarketFocus(trades) {
  const cryptoRe = /bitcoin|btc|eth|ethereum|solana|sol|crypto|defi|token|nft|\$\d+k|price above|price below|up or down|pump|dump/i;
  const sportsRe = /nba|nfl|nhl|mlb|premier league|la liga|bundesliga|serie a|champions league|will .+ win|spread:|total:|moneyline|over\/under|\bo\/u\b|vs\.|game \d|\bseries\b|playoff|championship game|super bowl|world cup/i;
  const humanRe = /election|president|trump|harris|congress|senate|supreme|celebrity|oscar|movie|grammy|taylor|kanye/i;
  let cryptoCount = 0, sportsCount = 0, humanCount = 0;
  for (const t of trades) {
    const q = (t.title || t.market || t.question || "").toLowerCase();
    if (cryptoRe.test(q)) cryptoCount++;
    else if (sportsRe.test(q)) sportsCount++;
    else if (humanRe.test(q)) humanCount++;
  }
  const total = trades.length;
  const cryptoPct = cryptoCount / total;
  const sportsPct = sportsCount / total;
  const humanPct = humanCount / total;
  let score;
  if (cryptoPct > 0.80)      score = 85;
  else if (cryptoPct > 0.60) score = 65;
  else if (humanPct > 0.60)  score = 15;
  else if (sportsPct > 0.60) score = 50;
  else                        score = 35;
  return { score, detail: `${Math.round(cryptoPct * 100)}% crypto, ${Math.round(sportsPct * 100)}% sports, ${Math.round(humanPct * 100)}% politics` };
}

// ── Main analysis ──────────────────────────────────────────────────────────────

async function analyzeWallet(name, address) {
  const lines = [];
  const log = (...args) => { const s = args.join(" "); console.log(s); lines.push(s); };

  log(`\n${"=".repeat(70)}`);
  log(`WALLET: ${name} — ${address}`);
  log("=".repeat(70));

  // 1. Fetch trades
  log("\n── 1. FETCHING TRADES ────────────────────────────────────────────────");
  const raw = await fetchTrades(address, 3);
  log(`  Total fetched: ${raw.length} trades`);

  if (raw.length === 0) {
    log("  ERROR: No trades returned. Check address or API.");
    return lines.join("\n");
  }

  // 2. Inspect raw structure
  log("\n── 2. RAW TRADE STRUCTURE (first object) ─────────────────────────────");
  const inspection = inspectFirstTrade(raw);
  log("  Keys:", inspection.allKeys.join(", "));
  log("  Timestamp field:", inspection.timestampField);
  log("  Raw timestamp value:", inspection.rawTimestampValue, "(type:", inspection.rawType + ")");
  log("  As date (direct):", inspection.asDateDirect);
  log("  As date (*1000):", inspection.asDateSeconds);
  log("  Side:", inspection.side, "| Size:", inspection.size, "| Price:", inspection.price);
  log("  Title:", inspection.title);

  // 3. Full first trade JSON
  log("\n── 3. FULL FIRST TRADE OBJECT ────────────────────────────────────────");
  log(JSON.stringify(raw[0], null, 2));

  // 4. Timestamp analysis
  log("\n── 4. TIMESTAMP ANALYSIS ─────────────────────────────────────────────");
  const tsMs = raw.map(getTimestampMs).filter(Boolean).sort((a, b) => a - b);
  log(`  Valid timestamps: ${tsMs.length} / ${raw.length}`);

  if (tsMs.length > 0) {
    const first = tsMs[0];
    const last = tsMs[tsMs.length - 1];
    const spanHours = (last - first) / 3_600_000;
    const spanDays = spanHours / 24;
    log(`  Earliest trade: ${new Date(first).toISOString()} (${first})`);
    log(`  Latest trade:   ${new Date(last).toISOString()} (${last})`);
    log(`  Span: ${spanDays.toFixed(2)} days (${spanHours.toFixed(1)} hours)`);

    const tradesPerDay = raw.length / Math.max(spanDays, 1);
    const tradesPerHour = raw.length / Math.max(spanHours, 1);
    log(`  Trades per day: ${tradesPerDay.toFixed(1)}`);
    log(`  Trades per hour: ${tradesPerHour.toFixed(1)}`);

    // Hour distribution
    const hourCounts = {};
    for (let h = 0; h < 24; h++) hourCounts[h] = 0;
    for (const t of tsMs) { const h = new Date(t).getUTCHours(); hourCounts[h]++; }
    const activeHours = Object.values(hourCounts).filter(c => c > 0).length;
    log(`  Active UTC hours (across all data): ${activeHours}/24`);
    log(`  Hour distribution: ${Object.entries(hourCounts).filter(([,v]) => v > 0).map(([h,c]) => `${h.padStart(2,"0")}h=${c}`).join(", ")}`);

    // Sample timestamps
    log(`  First 5 timestamps: ${tsMs.slice(0, 5).map(t => new Date(t).toISOString()).join(", ")}`);
    log(`  Last 5 timestamps:  ${tsMs.slice(-5).map(t => new Date(t).toISOString()).join(", ")}`);
  }

  // 5. Factor-by-factor scoring
  log("\n── 5. FACTOR SCORES ──────────────────────────────────────────────────");
  const tsMs2 = raw.map(getTimestampMs).filter(Boolean).sort((a, b) => a - b);
  const spanHours = tsMs2.length >= 2 ? (tsMs2[tsMs2.length - 1] - tsMs2[0]) / 3_600_000 : 0;
  const spanDays = Math.max(spanHours / 24, 1);

  const f1 = calcTradeFrequency(raw, spanDays);
  const f2 = calcTimingPattern(tsMs2, spanDays);
  const f3 = calcWinRate(raw);
  const f4 = calcSizeUniformity(raw);
  const f5 = calcHoldingDuration(raw);
  const f6 = calcMarketFocus(raw);

  const factors = [
    { name: "Trade Frequency (15%)", weight: 0.15, ...f1 },
    { name: "Timing Pattern (30%)",  weight: 0.30, ...f2 },
    { name: "Win Rate (15%)",        weight: 0.15, ...f3 },
    { name: "Size Uniformity (15%)", weight: 0.15, ...f4 },
    { name: "Holding Duration (15%)",weight: 0.15, ...f5 },
    { name: "Market Focus (10%)",    weight: 0.10, ...f6 },
  ];

  for (const f of factors) {
    const contribution = (f.score * f.weight).toFixed(1);
    log(`  ${f.name.padEnd(28)} score=${String(f.score).padStart(3)}  contrib=${contribution.padStart(4)}  | ${f.detail}`);
  }

  let weighted = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));
  log(`\n  Weighted average: ${weighted}`);

  // Override rules
  const overrides = [];
  if (f2.activeHoursPerDay >= 22) { const prev = weighted; weighted = Math.max(weighted, 85); overrides.push(`R1: activeHoursPerDay=${f2.activeHoursPerDay?.toFixed(1)} ≥ 22 → score↑ to max(${prev},85)=${weighted}`); }
  if ((f3.rawWinRate ?? 0) >= 0.95 && f1.tradesPerDay >= 100) { const prev = weighted; weighted = Math.max(weighted, 80); overrides.push(`R2: winRate=${f3.rawWinRate?.toFixed(2)} + tpd=${f1.tradesPerDay.toFixed(0)} → score↑ to ${weighted}`); }
  if ((f4.cv ?? 1) < 0.10 && f1.tradesPerDay >= 50) { const prev = weighted; weighted = Math.max(weighted, 78); overrides.push(`R3: cv=${f4.cv?.toFixed(3)} + tpd=${f1.tradesPerDay.toFixed(0)} → score↑ to ${weighted}`); }
  if (f2.score >= 85 && f1.score >= 75) { const prev = weighted; weighted = Math.max(weighted, 75); overrides.push(`R4: timingScore=${f2.score} + freqScore=${f1.score} → score↑ to ${weighted}`); }
  if ((f2.tradesPerActiveHour ?? 0) >= 10 && f1.tradesPerDay >= 20) { const prev = weighted; weighted = Math.max(weighted, 72); overrides.push(`R5: tradesPerActiveHour=${f2.tradesPerActiveHour?.toFixed(1)} ≥ 10 + tpd=${f1.tradesPerDay.toFixed(0)} → score↑ to max(${prev},72)=${weighted}`); }

  weighted = Math.min(100, Math.max(0, weighted));
  if (overrides.length) {
    log("\n  Override rules triggered:");
    for (const o of overrides) log(`    ✓ ${o}`);
  } else {
    log("  No override rules triggered.");
  }

  const classification = weighted >= 65 ? "Likely Bot" : weighted >= 40 ? "Uncertain" : "Likely Human";
  log(`\n  FINAL SCORE: ${weighted} → ${classification}`);

  // 6. Diagnosis
  log("\n── 6. DIAGNOSIS ──────────────────────────────────────────────────────");
  if (f2.activeHoursPerDay < 10) {
    const days = f2.uniqueDaysCount ?? "?";
    const slots = f2.totalDayHourSlots ?? "?";
    log(`  ⚠ LOW timing score (${f2.score}): only ${f2.activeHoursPerDay?.toFixed(1)} active hrs/day`);
    log(`    dayHourSlots=${slots}, uniqueDays=${days}`);
    log(`    If uniqueDays=1, ALL trades happened in 1 calendar day → normal to have <24 hr slots`);
    log(`    If slots is very low, check whether timestamps are valid (year/month correct?)`);
  }
  if (f1.tradesPerDay < 5) {
    log(`  ⚠ LOW frequency score (${f1.score}): only ${f1.tradesPerDay.toFixed(1)} trades/day`);
    log(`    This likely means the API is returning trades spread over a very long time span`);
    log(`    OR the address has genuinely low activity`);
  }
  if (tsMs2.length > 0 && new Date(tsMs2[tsMs2.length - 1]).getFullYear() > 2030) {
    log(`  🔴 TIMESTAMP BUG: latest timestamp = year ${new Date(tsMs2[tsMs2.length - 1]).getFullYear()}`);
    log(`     This means timestamps are being multiplied by 1000 twice (seconds treated as ms)`);
  }

  return lines.join("\n");
}

// ── Entry point ────────────────────────────────────────────────────────────────

const { writeFileSync } = await import("fs");

const allResults = [];
allResults.push("# Bot Scoring Debug Results");
allResults.push(`Generated: ${new Date().toISOString()}\n`);

for (const { name, address } of WALLETS) {
  const result = await analyzeWallet(name, address);
  allResults.push(result);
  await new Promise(r => setTimeout(r, 1000)); // rate limit between wallets
}

const output = allResults.join("\n");
writeFileSync("DEBUG_RESULTS.md", output);
console.log("\n\n✅ Results written to DEBUG_RESULTS.md");
