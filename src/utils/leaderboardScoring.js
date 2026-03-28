import { fetchLeaderboard, fetchWalletTrades } from "./api";
import { calculateBotScore } from "./botScoring";
import { supabase } from "./supabase";

/**
 * Fetch cached leaderboard data from Supabase.
 * Returns { traders: [...], lastUpdated, error }
 */
export async function fetchCachedLeaderboard() {
  if (!supabase) return { traders: [], lastUpdated: null, error: "Supabase not configured" };

  try {
    const { data, error } = await supabase
      .from("leaderboard_cache")
      .select("*")
      .order("rank", { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return { traders: [], lastUpdated: null, error: null };

    const lastUpdated = data.reduce((latest, row) => {
      const d = new Date(row.last_updated);
      return d > latest ? d : latest;
    }, new Date(0));

    return { traders: data, lastUpdated, error: null };
  } catch (err) {
    console.error("Failed to fetch cached leaderboard:", err);
    return { traders: [], lastUpdated: null, error: err.message };
  }
}

/**
 * Refresh the leaderboard cache: fetch top traders, score each, upsert to Supabase.
 * @param {function} onProgress - callback(current, total, traderName)
 * @returns {{ traders: [...], errors: number }}
 */
export async function refreshLeaderboardCache(onProgress) {
  // 1. Fetch leaderboard
  const { traders: rawTraders } = await fetchLeaderboard(20);
  if (!rawTraders || rawTraders.length === 0) {
    throw new Error("Could not fetch leaderboard data from Polymarket");
  }

  const results = [];
  let errors = 0;

  for (let i = 0; i < rawTraders.length; i++) {
    const trader = rawTraders[i];
    const address = trader.proxyWallet || trader.address || trader.userAddress;
    const displayName = trader.userName || trader.name || `Trader ${i + 1}`;

    if (onProgress) onProgress(i + 1, rawTraders.length, displayName);

    try {
      // 2. Fetch trades
      const { trades } = await fetchWalletTrades(address, 500);

      // 3. Score
      const scoring = calculateBotScore(trades);

      // Compute win rate from trades
      const winRate = computeWinRate(trades);
      const tradesPerDay = scoring.stats.timeSpanDays > 0
        ? (scoring.tradeCount / parseFloat(scoring.stats.timeSpanDays)).toFixed(1)
        : 0;

      const row = {
        wallet_address: address.toLowerCase(),
        display_name: displayName,
        rank: trader.rank || i + 1,
        pnl: trader.pnl || 0,
        volume: trader.vol || trader.volume || 0,
        trade_count: scoring.tradeCount,
        bot_score: scoring.score,
        classification: scoring.classification,
        factors_json: scoring.factors,
        win_rate: winRate,
        trades_per_day: parseFloat(tradesPerDay) || 0,
        last_updated: new Date().toISOString(),
      };

      // 4. Upsert to Supabase
      if (supabase) {
        const { error } = await supabase
          .from("leaderboard_cache")
          .upsert(row, { onConflict: "wallet_address" });
        if (error) console.error(`Upsert error for ${displayName}:`, error);
      }

      results.push(row);
    } catch (err) {
      console.error(`Failed to score ${displayName} (${address}):`, err);
      errors++;
    }

    // Small delay to avoid hammering the API
    if (i < rawTraders.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return { traders: results, errors };
}

/**
 * Compute aggregate stats from scored leaderboard data.
 */
export function computeLeaderboardStats(traders) {
  if (!traders || traders.length === 0) {
    return { botCount: 0, totalCount: 0, botPnlShare: 0, botAvgWinRate: 0, humanAvgWinRate: 0, botAvgTradesPerDay: 0, humanAvgTradesPerDay: 0 };
  }

  const bots = traders.filter((t) => t.classification === "Likely Bot");
  const humans = traders.filter((t) => t.classification === "Likely Human");
  const totalPnl = traders.reduce((s, t) => s + Math.abs(parseFloat(t.pnl) || 0), 0);
  const botPnl = bots.reduce((s, t) => s + Math.abs(parseFloat(t.pnl) || 0), 0);

  const avg = (arr, key) => {
    const vals = arr.map((t) => parseFloat(t[key]) || 0);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  return {
    botCount: bots.length,
    totalCount: traders.length,
    uncertainCount: traders.filter((t) => t.classification === "Uncertain").length,
    humanCount: humans.length,
    botPnlShare: totalPnl > 0 ? ((botPnl / totalPnl) * 100).toFixed(1) : 0,
    botAvgWinRate: avg(bots, "win_rate").toFixed(1),
    humanAvgWinRate: avg(humans, "win_rate").toFixed(1),
    botAvgTradesPerDay: avg(bots, "trades_per_day").toFixed(1),
    humanAvgTradesPerDay: avg(humans, "trades_per_day").toFixed(1),
    botAvgScore: avg(bots, "bot_score").toFixed(0),
    humanAvgScore: avg(humans, "bot_score").toFixed(0),
  };
}

// Simple win rate: trades where outcome price moved in trader's favor
function computeWinRate(trades) {
  if (!trades || trades.length === 0) return 0;
  const buys = trades.filter((t) => t.side === "BUY" || t.side === "buy");
  const sells = trades.filter((t) => t.side === "SELL" || t.side === "sell");
  // Heuristic: buy below 0.5 or sell above 0.5 = likely profitable
  let wins = 0;
  for (const t of trades) {
    const price = parseFloat(t.price);
    if (isNaN(price)) continue;
    const isBuy = (t.side || "").toUpperCase() === "BUY";
    if ((isBuy && price < 0.5) || (!isBuy && price > 0.5)) {
      wins++;
    }
  }
  return trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : 0;
}
