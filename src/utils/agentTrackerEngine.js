/**
 * AI Agent Tracker — analysis engine
 *
 * Analyses trade data for a set of traders and computes:
 *  - Bot score + classification (via walletMetrics + fallbackClassification)
 *  - Win rate overall and by market category
 *  - Trades/day, avg hold time, active hours/day
 *  - Category distribution
 *
 * All metrics are computed from on-chain trade data only.
 * PnL comes from the leaderboard API (all-time).
 */

import { computeWalletMetrics } from "./walletMetrics";
import { fallbackClassification } from "./traderClassifier";
import { getMarketCategory } from "./api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts(trade) {
  if (trade.match_time) return new Date(trade.match_time).getTime();
  if (typeof trade.timestamp === "number")
    return trade.timestamp > 1e12 ? trade.timestamp : trade.timestamp * 1000;
  return null;
}

function mean(arr) {
  const valid = (arr || []).filter((v) => v !== null && v !== undefined && isFinite(v));
  return valid.length === 0 ? null : valid.reduce((a, b) => a + b, 0) / valid.length;
}

function sum(arr) {
  return (arr || []).filter((v) => v !== null && isFinite(v)).reduce((a, b) => a + b, 0);
}

const CATEGORIES = ["Crypto", "Politics", "Economics", "Sports", "Pop Culture", "Science", "Other"];

// ── Per-trader analysis ───────────────────────────────────────────────────────

/**
 * Analyses a single trader's trade history.
 * @param {string}  address          Wallet address
 * @param {Array}   trades           Normalized trades from fetchWalletTrades
 * @param {Object}  leaderboardEntry { userName, pnl, vol, rank, profileImage, proxyWallet }
 * @returns {Object|null}
 */
export function analyzeTrader(address, trades, leaderboardEntry = {}) {
  if (!trades || trades.length < 5) return null;

  // ── Bot scoring (algo only — no AI for batch processing) ─────────────────
  const walletMetrics = computeWalletMetrics(trades, []);
  const bot = fallbackClassification(walletMetrics);

  // ── Time span ────────────────────────────────────────────────────────────
  const timestamps = trades.map(ts).filter(Boolean).sort((a, b) => a - b);
  const spanMs = timestamps.length >= 2 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
  const spanDays = Math.max(spanMs / 86400000, 0.5);
  const tradesPerDay = trades.length / spanDays;

  // ── Active hours / day ───────────────────────────────────────────────────
  const dayHourSlots = new Set(
    timestamps.map((t) => {
      const d = new Date(t);
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
    })
  );
  const uniqueDays = new Set(
    timestamps.map((t) => {
      const d = new Date(t);
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    })
  ).size;
  const activeHoursPerDay = Math.min(24, dayHourSlots.size / Math.max(uniqueDays, 1));

  // ── Build buy/sell pairs per market ──────────────────────────────────────
  const byMarket = {};
  for (const t of trades) {
    const key = t.conditionId || t.title || t.market || "?";
    if (!byMarket[key]) byMarket[key] = [];
    byMarket[key].push(t);
  }

  const pairs = []; // { buyTs, sellTs, buyPrice, sellPrice, category, holdMin, isWin }
  for (const mTrades of Object.values(byMarket)) {
    const sorted = mTrades.slice().sort((a, b) => (ts(a) || 0) - (ts(b) || 0));
    let lastBuy = null;
    for (const t of sorted) {
      const side = (t.side || "").toUpperCase();
      if (side === "BUY" || side === "B") {
        lastBuy = t;
      } else if ((side === "SELL" || side === "S") && lastBuy) {
        const buyTs = ts(lastBuy) || 0;
        const sellTs = ts(t) || 0;
        const buyPrice = parseFloat(lastBuy.price) || 0;
        const sellPrice = parseFloat(t.price) || 0;
        if (buyPrice > 0 && sellPrice > 0) {
          pairs.push({
            buyTs,
            sellTs,
            buyPrice,
            sellPrice,
            category: getMarketCategory(lastBuy),
            holdMin: buyTs && sellTs ? (sellTs - buyTs) / 60000 : null,
            isWin: sellPrice > buyPrice,
          });
        }
        lastBuy = null;
      }
    }
  }

  // ── Win rate overall ──────────────────────────────────────────────────────
  const winRate = pairs.length >= 3
    ? pairs.filter((p) => p.isWin).length / pairs.length
    : null;

  // ── Win rate by category ──────────────────────────────────────────────────
  const winRateByCategory = {};
  for (const cat of CATEGORIES) {
    const catPairs = pairs.filter((p) => p.category === cat);
    if (catPairs.length >= 2) {
      winRateByCategory[cat] = catPairs.filter((p) => p.isWin).length / catPairs.length;
    }
  }

  // ── Hold time ────────────────────────────────────────────────────────────
  const holdTimes = pairs.map((p) => p.holdMin).filter((h) => h !== null && h >= 0);
  const avgHoldMinutes = holdTimes.length > 0 ? mean(holdTimes) : null;

  // ── Category distribution (% of trades) ─────────────────────────────────
  const catCounts = {};
  for (const t of trades) {
    const c = getMarketCategory(t);
    catCounts[c] = (catCounts[c] || 0) + 1;
  }
  const categoryDist = {};
  for (const [c, count] of Object.entries(catCounts)) {
    categoryDist[c] = count / trades.length;
  }
  const primaryCategory =
    Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Other";

  return {
    address,
    userName: leaderboardEntry.userName || null,
    rank: leaderboardEntry.rank || null,
    profileImage: leaderboardEntry.profileImage || "",
    botScore: bot.score,
    classification: bot.classification,
    tradeCount: trades.length,
    tradesPerDay: Math.round(tradesPerDay * 10) / 10,
    avgHoldMinutes,
    activeHoursPerDay: Math.round(activeHoursPerDay * 10) / 10,
    winRate,
    winRateByCategory,
    categoryDist,
    primaryCategory,
    pnl: leaderboardEntry.pnl != null ? parseFloat(leaderboardEntry.pnl) || null : null,
    volume: typeof leaderboardEntry.vol === "number" ? leaderboardEntry.vol : null,
    pairCount: pairs.length,
    spanDays: Math.round(spanDays),
  };
}

// ── Aggregate bots vs humans ──────────────────────────────────────────────────

/**
 * @param {Array}  traders        Array of analyzeTrader() results
 * @param {string} categoryFilter "All" | "Crypto" | "Politics" | ...
 */
export function computeAggregates(traders, categoryFilter = "All") {
  if (!traders || traders.length === 0) return null;

  const bots = traders.filter((t) => t.classification === "Bot");
  const humans = traders.filter((t) => t.classification !== "Bot");

  function getWinRate(trader) {
    if (categoryFilter === "All") return trader.winRate;
    return trader.winRateByCategory?.[categoryFilter] ?? null;
  }

  function groupStats(group) {
    const withWinRate = group.filter((t) => getWinRate(t) !== null);
    const withHold = group.filter((t) => t.avgHoldMinutes !== null);
    const totalPnl = sum(group.map((t) => t.pnl));
    return {
      count: group.length,
      avgWinRate: mean(withWinRate.map(getWinRate)),
      totalPnl,
      avgTradesPerDay: mean(group.map((t) => t.tradesPerDay)),
      avgHoldMinutes: mean(withHold.map((t) => t.avgHoldMinutes)),
      avgActiveHours: mean(group.map((t) => t.activeHoursPerDay)),
      winRateByCategory: computeCategoryWinRates(group),
    };
  }

  function computeCategoryWinRates(group) {
    const result = {};
    for (const cat of CATEGORIES) {
      const rates = group
        .map((t) => t.winRateByCategory?.[cat])
        .filter((r) => r !== undefined && r !== null);
      if (rates.length >= 1) result[cat] = mean(rates);
    }
    return result;
  }

  const allPnl = sum(traders.map((t) => t.pnl));
  const botPnl = sum(bots.map((t) => t.pnl));

  return {
    total: traders.length,
    botCount: bots.length,
    humanCount: humans.length,
    botDominance: traders.length > 0 ? bots.length / traders.length : 0,
    bots: groupStats(bots),
    humans: groupStats(humans),
    totalPnl: allPnl,
    botPnlShare: allPnl > 0 ? botPnl / allPnl : null,
  };
}

// ── Category chart data ───────────────────────────────────────────────────────

/**
 * Returns data array for Recharts grouped bar chart.
 * Each entry: { category, bots: 0-100, humans: 0-100 }
 */
export function buildCategoryChartData(aggregates) {
  if (!aggregates) return [];
  const displayed = CATEGORIES.filter((cat) => {
    const b = aggregates.bots.winRateByCategory?.[cat];
    const h = aggregates.humans.winRateByCategory?.[cat];
    return b !== undefined || h !== undefined;
  });
  return displayed.map((cat) => {
    const b = aggregates.bots.winRateByCategory?.[cat];
    const h = aggregates.humans.winRateByCategory?.[cat];
    return {
      category: cat === "Pop Culture" ? "Pop" : cat,
      bots: b !== undefined ? Math.round(b * 100) : null,
      humans: h !== undefined ? Math.round(h * 100) : null,
    };
  });
}

// ── localStorage cache ────────────────────────────────────────────────────────

const CACHE_KEY = "polyalpha_agent_tracker_v1";
const CACHE_TTL = 30 * 60 * 1000; // 30 min

export function loadTrackerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { traders, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return { traders, timestamp };
  } catch {
    return null;
  }
}

export function saveTrackerCache(traders) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ traders, timestamp: Date.now() }));
  } catch {}
}

// ── Formatting helpers (used in the page) ────────────────────────────────────

export function fmtPnl(n) {
  if (n === null || n === undefined || isNaN(n)) return "N/A";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function fmtHold(minutes) {
  if (minutes === null || minutes === undefined) return "N/A";
  if (minutes < 60) return `${Math.round(minutes)}min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}hr`;
  return `${(minutes / 1440).toFixed(1)}d`;
}

export function fmtPct(rate) {
  if (rate === null || rate === undefined) return "N/A";
  return `${Math.round(rate * 100)}%`;
}
