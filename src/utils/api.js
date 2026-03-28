// --- API Endpoints ---
// In dev: Vite proxy rewrites /api/* paths
// In prod (Vercel): serverless functions at /api/*
const MARKETS_API = "/api/markets";
const EVENTS_API = "/api/events";
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
    console.warn("Polymarket API unavailable:", err.message);
    return { markets: [], isLive: false };
  }
}

// --- All Markets (for arbitrage scanner — larger batch, shorter cache) ---
const SCANNER_CACHE_TTL = 30 * 1000; // 30 seconds

export async function fetchAllMarkets(limit = 500) {
  const cacheKey = `all-markets:${limit}`;
  const entry = cache.get(cacheKey);
  if (entry && Date.now() - entry.ts < SCANNER_CACHE_TTL) return entry.data;

  try {
    const res = await fetchWithRetry(
      `${MARKETS_API}?limit=${limit}&active=true&closed=false`
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Empty response");
    const result = { markets: data, isLive: true };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.warn("Polymarket API unavailable for scanner:", err.message);
    return { markets: [], isLive: false };
  }
}

// --- Search Polymarket markets by keywords (for Price Finder) ---
export async function searchPolymarketMarkets(keywords) {
  const { markets } = await fetchAllMarkets(1000);
  const kw = keywords.map((k) => k.toLowerCase());

  const scored = markets
    .map((m) => {
      const text = ((m.question || "") + " " + (m.groupItemTitle || "")).toLowerCase();
      const matches = kw.filter((k) => text.includes(k));
      return { market: m, score: matches.length, matchedKeywords: matches };
    })
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 30);
}

// --- Events (for arbitrage scanner — multi-outcome negRisk events) ---
export async function fetchEvents(limit = 100) {
  const cacheKey = `events:${limit}`;
  const entry = cache.get(cacheKey);
  if (entry && Date.now() - entry.ts < SCANNER_CACHE_TTL) return entry.data;

  try {
    const res = await fetchWithRetry(
      `${EVENTS_API}?limit=${limit}&active=true&closed=false`
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Empty response");
    const result = { events: data, isLive: true };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.warn("Events API unavailable for scanner:", err.message);
    return { events: [], isLive: false };
  }
}

// --- Kalshi Events (for cross-platform comparison) ---
const KALSHI_EVENTS_API = "/api/kalshi/events";
const KALSHI_MARKETS_API = "/api/kalshi/markets";
const KALSHI_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export async function fetchKalshiEvents(limit = 200) {
  const cacheKey = `kalshi-events:${limit}`;
  const entry = cache.get(cacheKey);
  if (entry && Date.now() - entry.ts < KALSHI_CACHE_TTL) return entry.data;

  try {
    const res = await fetchWithRetry(`${KALSHI_EVENTS_API}?limit=${limit}`);
    const data = await res.json();
    const events = data.events || [];
    const result = { events, isLive: true };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.warn("Kalshi Events API unavailable:", err.message);
    return { events: [], isLive: false };
  }
}

export async function fetchKalshiEventMarkets(eventTicker) {
  const cacheKey = `kalshi-markets:${eventTicker}`;
  const entry = cache.get(cacheKey);
  if (entry && Date.now() - entry.ts < KALSHI_CACHE_TTL) return entry.data;

  try {
    const res = await fetchWithRetry(`${KALSHI_MARKETS_API}?event_ticker=${eventTicker}&limit=50`);
    const data = await res.json();
    const markets = (data.markets || []).filter((m) => !m.mve_collection_ticker);
    cache.set(cacheKey, { data: markets, ts: Date.now() });
    return markets;
  } catch (err) {
    console.warn(`Kalshi markets for ${eventTicker}:`, err.message);
    return [];
  }
}

// --- Kalshi: fetch ALL events with pagination (rate-limit safe) ---
const KALSHI_EVENTS_CACHE_TTL = 5 * 60 * 1000; // 5 min — longer cache to avoid re-fetching

export async function fetchAllKalshiEvents() {
  const cacheKey = "kalshi-all-events";
  const entry = cache.get(cacheKey);
  if (entry && Date.now() - entry.ts < KALSHI_EVENTS_CACHE_TTL) return entry.data;

  try {
    const allEvents = [];
    let cursor = "";
    let pages = 0;
    const maxPages = 15;

    while (pages < maxPages) {
      const url = cursor
        ? `${KALSHI_EVENTS_API}?limit=200&cursor=${encodeURIComponent(cursor)}`
        : `${KALSHI_EVENTS_API}?limit=200`;
      const res = await fetchWithRetry(url);
      const data = await res.json();
      const events = data.events || [];
      allEvents.push(...events);
      cursor = data.cursor || "";
      pages++;
      if (!cursor || events.length < 200) break;
      // Rate limit: wait 500ms between pages
      if (cursor) await new Promise((r) => setTimeout(r, 500));
    }

    const result = { events: allEvents, isLive: true };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.warn("Kalshi full events fetch failed:", err.message);
    return { events: [], isLive: false };
  }
}

// --- Kalshi: search events by keywords (pre-filter before Claude) ---
export async function searchKalshiEvents(keywords) {
  const { events } = await fetchAllKalshiEvents();
  const kw = keywords.map((k) => k.toLowerCase());

  // Score each event by keyword matches in title
  // Require at least 2 keyword matches to reduce noise
  const scored = events
    .map((e) => {
      const title = (e.title || "").toLowerCase();
      const subtitle = (e.sub_title || "").toLowerCase();
      const text = title + " " + subtitle;
      const matches = kw.filter((k) => text.includes(k));
      return { event: e, score: matches.length, matchedKeywords: matches };
    })
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 30);
}

// --- Kalshi: fetch markets for matched events ---
export async function fetchKalshiMarketsForEvents(eventTickers) {
  const results = await Promise.all(
    eventTickers.map((ticker) => fetchKalshiEventMarkets(ticker))
  );
  return results.flat();
}

// --- Wallet Trades (Data API — works without auth!) ---
export async function fetchWalletTrades(address, limit = 1000) {
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

// --- Wallet Positions (open + recently resolved positions with real P&L) ---
export async function fetchWalletPositions(address) {
  const cacheKey = `wallet-positions:${address}`;
  // Short cache — positions change as prices move
  const entry = cache.get(cacheKey);
  if (entry && Date.now() - entry.ts < 60_000) return entry.data;

  try {
    const res = await fetchWithRetry(
      `/api/data-positions?user=${address}&limit=500&sizeThreshold=.01`
    );
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("No positions data");
    const result = { positions: data, isLive: true };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.warn("Positions API failed:", err.message);
    return { positions: [], isLive: false };
  }
}

// --- Market Resolutions (batch gamma fetch to determine win/loss for each trade) ---
// Returns Map<assetId, {settlementPrice: 0|1|null, closed: bool, question: str, endDate: str}>
export async function fetchMarketResolutions(trades) {
  if (!trades || trades.length === 0) return new Map();

  // One asset per unique conditionId (avoid fetching YES+NO token for same market)
  const seen = new Set();
  const toFetch = [];
  for (const t of trades) {
    const key = t.conditionId || t.asset;
    if (t.asset && key && !seen.has(key)) {
      seen.add(key);
      toFetch.push({ asset: t.asset, conditionId: t.conditionId });
    }
  }

  const BATCH = 15;
  const resolutionMap = new Map();

  for (let i = 0; i < toFetch.length; i += BATCH) {
    const batch = toFetch.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async ({ asset, conditionId }) => {
        const cacheKey = `mkt-res:${asset}`;
        const cached = getCached(cacheKey);
        if (cached) return { asset, conditionId, ...cached };

        try {
          const res = await fetch(`${MARKETS_API}?clob_token_ids=${asset}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!Array.isArray(data) || data.length === 0) throw new Error("Not found");

          const mkt = data[0];
          const prices = typeof mkt.outcomePrices === "string"
            ? JSON.parse(mkt.outcomePrices)
            : (mkt.outcomePrices || []);
          const tokenIds = typeof mkt.clobTokenIds === "string"
            ? JSON.parse(mkt.clobTokenIds)
            : (mkt.clobTokenIds || []);

          const idx = tokenIds.indexOf(asset);
          const rawPrice = idx >= 0 && prices[idx] !== undefined ? parseFloat(prices[idx]) : null;

          // Resolved = closed flag OR all prices are exactly 0 or 1
          const allBinary = prices.length > 0 && prices.every((p) => parseFloat(p) <= 0.01 || parseFloat(p) >= 0.99);
          const closed = mkt.closed === true || allBinary;
          const settlementPrice = (closed && rawPrice !== null) ? rawPrice : null;

          const entry = {
            settlementPrice,
            closed,
            question: mkt.question || "",
            endDate: mkt.endDateIso || mkt.endDate || null,
          };
          setCache(cacheKey, entry);
          return { asset, conditionId, ...entry };
        } catch {
          return { asset, conditionId, settlementPrice: null, closed: false };
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value?.asset) {
        resolutionMap.set(r.value.asset, r.value);
        // Also index by conditionId so extractResolutionTrades can find it
        // even when the asset stored in byMarket differs from the fetched asset
        if (r.value.conditionId) resolutionMap.set(r.value.conditionId, r.value);
      }
    }

    // Gentle rate-limit between batches
    if (i + BATCH < toFetch.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return resolutionMap;
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

// --- Trader Profile (all-time stats from leaderboard by address) ---
// NOTE: /leaderboard?user={address} returns all-time PnL and volume — accurate data
// The weekly leaderboard (?timePeriod=WEEK) is unreliable for individual wallets
export async function fetchTraderProfile(address) {
  const cacheKey = `profile:${address}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // timePeriod=ALL required — omitting it returns [] (API quirk)
    const res = await fetchWithRetry(`${LEADERBOARD_API}?user=${address}&timePeriod=ALL`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("No profile found");
    const p = data[0];
    const result = {
      profile: {
        rank: p.rank ? `#${p.rank}` : null,
        userName: p.userName || null,
        pnl: typeof p.pnl === "number" ? p.pnl : null,
        volume: typeof p.vol === "number" ? p.vol : null,
        profileImage: p.profileImage || "",
        wallet: p.proxyWallet || address,
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
