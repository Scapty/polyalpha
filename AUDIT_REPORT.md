# Wallet Stalker — API Audit Report
_Audited: 2026-03-28_

---

## 1. Endpoints Tested

| Endpoint | Auth Required | Works | Returns |
|----------|--------------|-------|---------|
| `GET data-api.polymarket.com/trades?user={addr}` | No | ✅ | Array of individual trades: side, price, size (shares), timestamp (unix sec), title, outcome, conditionId, transactionHash, name |
| `GET data-api.polymarket.com/positions?user={addr}` | No | ✅ | Array of open/resolved positions: size, avgPrice, curPrice, cashPnl (unrealized), initialValue, currentValue, redeemable, title, outcome, endDate |
| `GET data-api.polymarket.com/v1/leaderboard?user={addr}` | No | ✅ | Array of 1 entry: rank, userName, pnl (all-time), vol (all-time), profileImage |
| `GET data-api.polymarket.com/v1/leaderboard?timePeriod=WEEK&orderBy=PNL` | No | ✅ | Top traders for that period |
| `GET data-api.polymarket.com/activity?user={addr}` | No | ✅ | YIELD events (interest), not useful for bot scoring |
| `GET gamma-api.polymarket.com/profiles/{addr}` | No | ❌ | Empty — endpoint does not return data |
| `GET gamma-api.polymarket.com/positions?user={addr}` | No | ❌ | Empty — endpoint does not exist |

---

## 2. Data Fields Available Per Endpoint

### `/trades?user={addr}&limit=1000`
- `side`: BUY or SELL
- `size`: number of shares (NOT dollars — multiply by price for USDC cost)
- `price`: price per share (0.00–1.00)
- `timestamp`: Unix seconds
- `title`: market name
- `outcome`: YES/NO label
- `conditionId`: market ID
- `name`: trader's display name
- **Limit**: 1000 trades maximum. Wallets with more history are truncated.
- **CORS**: allowed from browser

### `/positions?user={addr}`
- `size`: current shares held
- `avgPrice`: average entry price
- `curPrice`: current market price (0 = market resolved)
- `cashPnl`: unrealized P&L = currentValue - initialValue
- `initialValue`: total cost basis
- `currentValue`: current portfolio value
- `redeemable`: true = market has resolved (can be claimed)
- `title`, `outcome`, `endDate`: market metadata
- **Interpretation**:
  - `curPrice > 0, redeemable=false` → still open
  - `curPrice = 0, redeemable=true` → market resolved (against position = 0 payout)
  - `redeemable=true, curPrice≈1` → market resolved in favor (before redemption)
  - Won positions that were already redeemed **disappear** from this endpoint

### `/v1/leaderboard?user={addr}`
- `rank`: all-time rank on Polymarket
- `userName`: display name
- `pnl`: all-time profit & loss in USD (accurate — computed by Polymarket from all resolved positions)
- `vol`: all-time trading volume in USD
- **Note**: `?timePeriod=WEEK` returns inaccurate weekly figures. No-timePeriod = all-time = reliable.

---

## 3. What Was Broken and How It Was Fixed

### Bug 1: Positions endpoint never fetched
- **Before**: The app only fetched `/trades`. The `/positions` endpoint (with real P&L) was never called.
- **Fix**: Added `fetchWalletPositions()` in `api.js`, new proxy `/api/data-positions` in `vite.config.js`, and new Vercel serverless function `api/data-positions.js`.

### Bug 2: fetchTraderProfile data was fetched but never displayed
- **Before**: `fetchTraderProfile` fetched leaderboard rank/pnl/vol but `computeOverviewStats` completely ignored the `profile` parameter.
- **Fix**: `computeOverviewStats(trades, profile, positions)` now uses `profile.pnl` and `profile.volume` as the primary P&L/volume source (all-time, accurate). Falls back to trade-computed volume if not on leaderboard.

### Bug 3: P&L was removed in a previous session (incorrectly)
- **Before**: P&L was removed because "leaderboard API returns unreliable data." This was true for the **weekly** leaderboard (`?timePeriod=WEEK`) but false for the **all-time** leaderboard (`?user={addr}` with no timePeriod). The all-time PnL is Polymarket's own computed figure and is accurate.
- **Fix**: Restored P&L display using all-time leaderboard data, labeled clearly as "All-Time P&L (Polymarket leaderboard)".

### Bug 4: Volume was misleading
- **Before**: Volume was computed as `sum(size × price)` from the last 1,000 trades only, with no label. For a whale with $200M all-time volume, this showed a tiny fraction.
- **Fix**: Now uses `profile.vol` (all-time) from leaderboard when available. Falls back to trade-computed with clear label "from last 1,000 trades."

### Bug 5: Trader name was not always resolved
- **Before**: Only checked `trades[0].traderName` (which was a non-existent field — the real field is `trades[0].name`).
- **Fix**: Name priority: `profile.userName` (leaderboard) → `trades[0].name` (trade data). Both work.

### Bug 6: Leaderboard rank never shown
- **Before**: The rank from `fetchTraderProfile` was never displayed anywhere.
- **Fix**: Rank is now shown as a badge next to the wallet address (e.g., "#19 all-time").

---

## 4. Features Removed / What Requires Sufficient Data

| Feature | Status | Condition |
|---------|--------|-----------|
| Bot Score gauge | Shown | Requires ≥5 trades |
| Factor breakdown | Shown | Requires ≥5 trades |
| Activity Heatmap | Shown | Requires ≥20 trades |
| Copy Trading Sim | Shown | Always shown; shows message when 0 closed pairs |
| Win Rate | Shown | Only when ≥3 buy→sell pairs found |
| Open Positions | Shown | Only when positions endpoint returns data |
| All-Time P&L | Shown | Only when wallet appears on Polymarket leaderboard |
| All-Time Volume | Shown | From leaderboard; falls back to trade-calculated |

---

## 5. What Still Needs Attention

### Copy Trading for Hold-to-Resolution Wallets
Wallets like "beachboy4" (997 BUYs, 3 SELLs) hold their positions until market resolution rather than manually selling. The copy trading simulator currently only counts explicit BUY→SELL pairs, so it shows 3 closed trades for this wallet.

**Root cause**: The `/positions` endpoint does not include resolved + already-redeemed positions. Once a winner redeems their shares, that position disappears. Only losses remain visible (`curPrice=0, redeemable=true`).

**Partial fix available**: Resolved positions with `curPrice=0` could be treated as known losses in the simulation. Positions with `redeemable=true` and `curPrice≈1` could be treated as wins. But without timestamps on positions, the equity curve can't be chronologically ordered.

**Current behavior**: Shows a clear message when 0 closed pairs are found — "This wallet resolves positions at market outcome rather than selling early."

### Trade Limit
The Data API returns at most 1000 trades. High-frequency wallets (e.g., those with 100k+ trades) only show their most recent 1000. Bot scoring is still meaningful on a 1000-trade sample.

### Positions with Timestamps
The `/positions` endpoint does not return a buy timestamp. For future improvement, positions could be matched against trade records using `conditionId` to determine when the wallet entered each position.
