-- ============================================
-- PolyAlpha — Supabase Tables Setup
-- Run this in the Supabase SQL Editor
-- (https://supabase.com/dashboard → your project → SQL Editor)
-- ============================================

-- 1. Tracked Wallets (Trade Alert System)
CREATE TABLE IF NOT EXISTS tracked_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  wallet_label TEXT,
  bot_score NUMERIC,
  is_active BOOLEAN DEFAULT true,
  last_known_trade_count INTEGER DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, wallet_address)
);

-- 2. Alert History (Trade Alert System)
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_wallet_id UUID REFERENCES tracked_wallets(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  new_trade_count INTEGER,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Leaderboard Cache (Bot Leaderboard)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  profile_image TEXT,
  pnl NUMERIC,
  volume NUMERIC,
  markets_traded INTEGER,
  bot_score NUMERIC,
  classification TEXT,
  factors JSONB,
  trade_count INTEGER,
  stats JSONB,
  rank INTEGER,
  cached_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Price Alerts (Arbitrage Scanner)
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  market_title TEXT NOT NULL,
  market_slug TEXT,
  platform TEXT NOT NULL DEFAULT 'polymarket',
  market_id TEXT NOT NULL,
  target_price NUMERIC NOT NULL,
  direction TEXT NOT NULL DEFAULT 'below',
  current_price NUMERIC,
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Row Level Security (RLS)
ALTER TABLE tracked_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/insert/update on tracked_wallets (frontend uses anon key)
CREATE POLICY "Allow anonymous insert" ON tracked_wallets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous select" ON tracked_wallets
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous update" ON tracked_wallets
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow anonymous read on alert_history
CREATE POLICY "Allow anonymous select alert_history" ON alert_history
  FOR SELECT USING (true);

-- Allow service role insert on alert_history (Edge Function uses service key)
CREATE POLICY "Allow service insert alert_history" ON alert_history
  FOR INSERT WITH CHECK (true);

-- Allow anonymous read on leaderboard_cache
CREATE POLICY "Allow anonymous select leaderboard_cache" ON leaderboard_cache
  FOR SELECT USING (true);

-- Allow anonymous upsert on leaderboard_cache (frontend refreshes cache)
CREATE POLICY "Allow anonymous insert leaderboard_cache" ON leaderboard_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update leaderboard_cache" ON leaderboard_cache
  FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert price_alerts" ON price_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous select price_alerts" ON price_alerts
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous update price_alerts" ON price_alerts
  FOR UPDATE USING (true) WITH CHECK (true);

-- 6. Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_email ON tracked_wallets(email);
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_active ON tracked_wallets(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_cached_at ON leaderboard_cache(cached_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_rank ON leaderboard_cache(rank);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_price_alerts_email ON price_alerts(email);
