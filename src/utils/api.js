import { mockMarkets } from "../data/mockMarkets";

// --- API Endpoints ---
// In dev: Vite proxy rewrites /api/* paths
// In prod (Vercel): serverless functions at /api/*
const MARKETS_API = "/api/markets";
const LEADERBOARD_API = "/api/leaderboard";

// Data API — has CORS Access-Control-Allow-Origin: * so we can call directly
// In dev we proxy anyway for consistency; in prod the serverless function handles it
const DATA_TRADES_API = "/api/data-trades";
const DATA_ACTIVITY_API = "/api/data-activity";

// --- Simple cache ---
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// --- Fetch with retry ---
async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// --- Markets ---
export async function fetchMarkets() {
  const cacheKey = "markets";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(
      `${MARKETS_API}?limit=100&active=true&closed=false&order=volume24hr&ascending=false`
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Empty response");
    const result = { markets: data, isLive: true };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn("Polymarket API unavailable, using demo data:", err.message);
    return { markets: mockMarkets, isLive: false };
  }
}

// --- Wallet Trades (Data API — works without auth!) ---
export async function fetchWalletTrades(address, limit = 500) {
  const cacheKey = `wallet-trades:${address}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(`${DATA_TRADES_API}?user=${address}&limit=${limit}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("No trades found");

    // Normalize trade data from Data API format for our bot scoring
    const trades = data.map((t) => ({
      // Keep original fields
      ...t,
      // Normalized fields for bot scoring compatibility
      match_time: t.timestamp ? new Date(t.timestamp * 1000).toISOString() : null,
      market: t.title || t.conditionId,
      asset_id: t.conditionId,
      side: t.side,
      size: t.size,
      price: t.price,
      status: "MATCHED",
      // Rich fields from Data API
      title: t.title,
      slug: t.slug,
      icon: t.icon,
      outcome: t.outcome,
      outcomeIndex: t.outcomeIndex,
      traderName: t.name,
      transactionHash: t.transactionHash,
    }));

    const result = { trades, isLive: true, error: null };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn("Data API: no trades for this address:", err.message);
    return {
      trades: [],
      isLive: false,
      error:
        "No trades found for this address. The wallet may not have traded on Polymarket, or the address may be incorrect.",
    };
  }
}

// --- Wallet Activity (redemptions, merges, etc.) ---
export async function fetchWalletActivity(address, limit = 100) {
  const cacheKey = `wallet-activity:${address}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(`${DATA_ACTIVITY_API}?user=${address}&limit=${limit}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("No activity found");
    const result = { activity: data, isLive: true };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn("Data API: no activity for this address:", err.message);
    return { activity: [], isLive: false };
  }
}

// --- Leaderboard ---
export async function fetchLeaderboard(limit = 20) {
  const cacheKey = `leaderboard:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(
      `${LEADERBOARD_API}?limit=${limit}&timePeriod=WEEK&orderBy=PNL`
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Empty leaderboard");
    const result = { traders: data, isLive: true };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn("Leaderboard API unavailable:", err.message);
    return { traders: [], isLive: false };
  }
}

// --- Trader Profile (from leaderboard by address) ---
export async function fetchTraderProfile(address) {
  const cacheKey = `profile:${address}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(`${LEADERBOARD_API}?user=${address}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("No profile found");
    const profile = data[0];
    const result = {
      profile: {
        rank: profile.rank,
        userName: profile.userName || "Anonymous",
        pnl: profile.pnl || 0,
        volume: profile.vol || 0,
        profileImage: profile.profileImage || "",
        wallet: profile.proxyWallet || address,
      },
      isLive: true,
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn("Trader profile not found:", err.message);
    return { profile: null, isLive: false };
  }
}

// --- Category detection ---
export function getMarketCategory(market) {
  if (market.category) return market.category;
  const q = (market.question || market.title || "").toLowerCase();
  if (q.match(/bitcoin|btc|ethereum|eth|crypto|defi|solana|token|nft/)) return "Crypto";
  if (q.match(/trump|biden|election|congress|senate|eu |regulation|law|government/)) return "Politics";
  if (q.match(/fed|rate|inflation|gdp|recession|unemployment|economy|tariff|gold/)) return "Economics";
  if (q.match(/ai |gpt|openai|apple|google|microsoft|tech|software|chip/)) return "Tech";
  if (q.match(/nba|nfl|fifa|olympic|sport|win|championship|league|cup/)) return "Sports";
  if (q.match(/celebrity|movie|oscar|grammy|music|entertainment|tv show|reality|influencer|tiktok|youtube|streamer/)) return "Pop Culture";
  if (q.match(/space|nasa|climate|vaccine|science|moon|mars/)) return "Science";
  return "Other";
}
