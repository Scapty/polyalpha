/**
 * AI Agent Tracker — analysis engine
 *
 * Analyses trade data for a set of traders and computes:
 *  - Bot score + classification (via walletMetrics + fallbackClassification)
 *  - ROI % (PnL / Volume from leaderboard — instant, no extra API calls)
 *  - Trades/day, active hours/day
 *  - Category distribution
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

  // ── ROI % (from leaderboard data — instant) ─────────────────────────────
  const pnl = leaderboardEntry.pnl != null ? parseFloat(leaderboardEntry.pnl) || null : null;
  const volume = typeof leaderboardEntry.vol === "number" ? leaderboardEntry.vol : null;
  const roi = (pnl !== null && volume && volume > 0) ? (pnl / volume) : null;

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
    activeHoursPerDay: Math.round(activeHoursPerDay * 10) / 10,
    roi,
    categoryDist,
    primaryCategory,
    pnl,
    volume,
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

  function groupStats(group) {
    const withRoi = group.filter((t) => t.roi !== null);
    const totalPnl = sum(group.map((t) => t.pnl));
    const totalVol = sum(group.map((t) => t.volume));
    return {
      count: group.length,
      avgRoi: mean(withRoi.map((t) => t.roi)),
      totalPnl,
      totalVolume: totalVol,
      avgTradesPerDay: mean(group.map((t) => t.tradesPerDay)),
      avgActiveHours: mean(group.map((t) => t.activeHoursPerDay)),
    };
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

// ── localStorage cache ────────────────────────────────────────────────────────

const CACHE_KEY = "polyalpha_agent_tracker_v4"; // bumped — ROI replaces win rate
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

export function fmtPct(rate) {
  if (rate === null || rate === undefined) return "N/A";
  return `${Math.round(rate * 100)}%`;
}

export function fmtRoi(roi) {
  if (roi === null || roi === undefined) return "N/A";
  const pct = roi * 100;
  const sign = pct >= 0 ? "+" : "";
  if (Math.abs(pct) >= 1000) return `${sign}${Math.round(pct / 100) * 100}%`;
  if (Math.abs(pct) >= 100) return `${sign}${Math.round(pct)}%`;
  return `${sign}${pct.toFixed(1)}%`;
}
