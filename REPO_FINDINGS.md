# REPO_FINDINGS.md
# Analysis: Fully-Autonomous-Polymarket-AI-Trading-Bot
# Source: https://github.com/dylanpersonguy/Fully-Autonomous-Polymarket-AI-Trading-Bot
# Analyzed: 2026-03-29

---

## Summary

This is a Python trading bot (not JavaScript). The entire data-fetching stack is in `src/connectors/`. It hits three Polymarket APIs (Gamma, CLOB, Data API) plus a WebSocket feed — all public and unauthenticated except for order execution. There is **no scraping** of polymarket.com. The leaderboard wallets are **hardcoded** as a static list, not dynamically fetched.

---

## 1. Leaderboard / Whale Discovery

### Key Finding: Static Hardcoded List — NOT Dynamic

The leaderboard wallets are a **hardcoded Python list** in `src/analytics/wallet_scanner.py`, manually populated from the Polymarket leaderboard page. There is no API call to discover top traders.

```python
# src/analytics/wallet_scanner.py  lines 36-52
LEADERBOARD_WALLETS: list[dict[str, Any]] = [
    {"address": "0x492442eab586f242b53bda933fd5de859c8a3782", "name": "Polybotalpha", "pnl": 3_250_000},
    {"address": "0x6a72f61820b26b1fe4d956e17b6dc2a1ea3033ee", "name": "kch123",       "pnl": 2_240_000},
    {"address": "0xc2e7800b5af46e6093872b177b7a5e7f0563be51", "name": "beachboy4",     "pnl": 2_100_000},
    {"address": "0xd25c72ac0928385610611c8148803dc717334d20", "name": "FeatherLeather", "pnl": 1_760_000},
    {"address": "0xdb27bf2ac5d428a9c63dbc914611036855a6c56e", "name": "DrPufferfish",   "pnl": 1_340_000},
    {"address": "0x1b7b52b0daa26c4d8e42f97ad3a23a6c946cec12", "name": "dbruno",         "pnl": 1_260_000},
    # ... 9 more entries
]
```

### What This Means for PolyAlpha

To **dynamically** discover top traders you would need either:
- The undocumented Polymarket leaderboard API (check `/leaderboard` on `data-api.polymarket.com` — not confirmed in this codebase)
- A periodic scrape of `https://polymarket.com/leaderboard` (not present in this repo)

The addresses above are real mainnet Polygon addresses you can use directly to bootstrap a tracker.

---

## 2. Trade Data Fetching — Polymarket Data API

### Base URL
```
https://data-api.polymarket.com
```

No authentication required. No API key needed. Rate limit: **60 RPM** per the `api_pool.py` config.

### Endpoint 1: GET /positions

Fetches all open (and optionally closed) positions for a wallet.

```
GET https://data-api.polymarket.com/positions
    ?user={address_lowercase}
    &sortBy={CURRENT|INITIAL|TOKENS|CASHPNL|PERCENTPNL}
    &limit={1-200}
    &offset={0}
```

**Response**: JSON array of position objects. Fields observed (with both camelCase and snake_case fallbacks):

| Field | Type | Description |
|-------|------|-------------|
| `proxyWallet` / `proxy_wallet` | string | Proxy wallet address |
| `asset` | string | Token ID (CLOB token) |
| `conditionId` / `condition_id` | string | Condition ID |
| `slug` / `market_slug` | string | Market URL slug |
| `title` | string | Market question |
| `outcome` | string | "Yes" or "No" |
| `size` | float | Number of shares held |
| `avgPrice` / `avg_price` | float | Average entry price (0-1) |
| `curPrice` / `cur_price` | float | Current market price (0-1) |
| `initialValue` / `initial_value` | float | USD value at entry |
| `currentValue` / `current_value` | float | Current USD value |
| `cashPnl` / `cash_pnl` | float | Realized+unrealized USD P&L |
| `percentPnl` / `percent_pnl` | float | % P&L |
| `endDate` / `end_date` | string | Market resolution date |
| `realized` | bool | Whether position is closed |

**Copy-paste fetch code:**
```python
import httpx

async def get_positions(address: str, limit: int = 200) -> list[dict]:
    url = "https://data-api.polymarket.com/positions"
    params = {
        "user": address.lower(),
        "sortBy": "CURRENT",   # sort by current USD value
        "limit": limit,
        "offset": 0,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    # Response is a list OR {"positions": [...]} OR {"data": [...]}
    if isinstance(data, list):
        return data
    return data.get("positions", data.get("data", []))
```

### Endpoint 2: GET /activity

Fetches recent buy/sell/redeem events for a wallet.

```
GET https://data-api.polymarket.com/activity
    ?user={address_lowercase}
    &limit={1-100}
    &offset={0}
```

**Response**: JSON array of activity objects.

| Field | Type | Description |
|-------|------|-------------|
| `transactionHash` / `transaction_hash` | string | On-chain tx hash |
| `type` / `action` | string | "Buy", "Sell", "Redeem" |
| `slug` / `market_slug` | string | Market slug |
| `title` | string | Market question |
| `outcome` | string | "Yes" or "No" |
| `size` / `amount` | float | Number of shares |
| `price` | float | Price at trade (0-1) |
| `value` / `usdcSize` | float | USD value of trade |
| `timestamp` / `createdAt` | string | ISO timestamp |

**Copy-paste fetch code:**
```python
async def get_activity(address: str, limit: int = 100) -> list[dict]:
    url = "https://data-api.polymarket.com/activity"
    params = {"user": address.lower(), "limit": limit, "offset": 0}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    if isinstance(data, list):
        return data
    return data.get("activity", data.get("data", []))
```

---

## 3. Market Data — Polymarket Gamma API

### Base URL
```
https://gamma-api.polymarket.com
```

No authentication. Rate limit: **60 RPM** (5 req/s in `rate_limiter.py`).

### Endpoint: GET /markets

```
GET https://gamma-api.polymarket.com/markets
    ?limit={1-100}
    &offset={0}
    &active={true|false}
    &closed={true|false}
    &order={volume|startDate|endDate|liquidity}
    &ascending={true|false}
    &tag={category_string}   # optional filter
```

**Response**: JSON array of market objects. The list endpoint returns token data as **JSON-encoded strings**, not objects.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Market ID |
| `condition_id` / `conditionId` | string | Condition ID |
| `question` / `title` | string | Market question |
| `description` | string | Extended description |
| `category` / `tag` | string | Category label |
| `volume` / `volumeNum` | float | Total USD traded |
| `liquidity` / `liquidityNum` | float | Current USD liquidity |
| `active` | bool | Is market accepting orders |
| `closed` | bool | Has market closed |
| `outcomes` | string | JSON-encoded `["Yes","No"]` |
| `outcomePrices` | string | JSON-encoded `["0.55","0.45"]` |
| `clobTokenIds` | string | JSON-encoded `["token_id_1","token_id_2"]` |
| `end_date_iso` / `endDate` | string | ISO resolution date |
| `startDate` | string | Market open date |
| `resolution_source` / `resolutionSource` | string | How it resolves |
| `slug` | string | URL slug |

### Endpoint: GET /markets/{market_id}

Returns a single market by condition_id or slug. Token data is returned as proper objects:

```json
{
  "tokens": [
    {"token_id": "...", "outcome": "Yes", "price": 0.55, "winner": null},
    {"token_id": "...", "outcome": "No",  "price": 0.45, "winner": null}
  ]
}
```

**Copy-paste market fetch:**
```python
async def fetch_active_markets(min_volume: float = 1000, limit: int = 100) -> list[dict]:
    import json, httpx
    url = "https://gamma-api.polymarket.com/markets"
    params = {"limit": limit, "active": "true", "closed": "false",
              "order": "volume", "ascending": "false"}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        markets = resp.json()
    if isinstance(markets, dict):
        markets = markets.get("data", markets.get("markets", []))
    # Parse token prices from JSON-string fields
    result = []
    for m in markets:
        if float(m.get("volume", m.get("volumeNum", 0))) < min_volume:
            continue
        outcomes = json.loads(m.get("outcomes", "[]"))
        prices = json.loads(m.get("outcomePrices", "[]"))
        token_ids = json.loads(m.get("clobTokenIds", "[]"))
        m["_tokens"] = [
            {"outcome": outcomes[i], "price": float(prices[i]), "token_id": token_ids[i]}
            for i in range(len(outcomes))
        ]
        result.append(m)
    return result
```

---

## 4. Order Book & Trade History — Polymarket CLOB API

### Base URL
```
https://clob.polymarket.com
```

No authentication for read endpoints. Authentication (API key + private key) required for order placement.

### Endpoint: GET /book

```
GET https://clob.polymarket.com/book?token_id={token_id}
```

**Response:**
```json
{
  "bids": [{"price": "0.54", "size": "500.0"}, ...],
  "asks": [{"price": "0.55", "size": "300.0"}, ...],
  "timestamp": 1711720000.0
}
```

### Endpoint: GET /price

```
GET https://clob.polymarket.com/price?token_id={token_id}
```

**Response:** `{"price": 0.545}` or `{"mid": 0.545}`

### Endpoint: GET /trades

```
GET https://clob.polymarket.com/trades?token_id={token_id}&limit={100}
```

**Response**: List of trade objects.

| Field | Type | Description |
|-------|------|-------------|
| `price` | float | Trade price |
| `size` / `amount` | float | Number of shares |
| `side` | string | "buy" or "sell" |
| `timestamp` / `time` | float | Unix timestamp |

**Authentication for order placement** (env vars required):
```
POLYMARKET_API_KEY
POLYMARKET_API_SECRET
POLYMARKET_API_PASSPHRASE
POLYMARKET_PRIVATE_KEY
POLYMARKET_CHAIN_ID   # 137 = Polygon mainnet
```
Uses the `py-clob-client` library for signing.

---

## 5. WebSocket Feed

### URL
```
wss://ws-subscriptions-clob.polymarket.com/ws/market
```

No authentication required.

**Subscribe message:**
```json
{
  "type": "subscribe",
  "channel": "market",
  "assets_ids": ["token_id_1", "token_id_2"]
}
```

**Incoming message types:**
- `book` / `price_change` / `tick` — price updates with fields: `asset_id`, `best_bid`, `best_ask`, `mid`, `timestamp`
- `trade` / `last_trade_price` — trade prints with fields: `asset_id`, `price`, `size`, `side`, `timestamp`

---

## 6. Conviction / Bot Scoring

### Wallet Scoring (`WalletScanner._score_wallet`)

Scoring is a simple composite — **no bot-vs-human differentiation logic exists**.

```python
# src/analytics/wallet_scanner.py  lines 251-280
def _score_wallet(address, name, positions, info):
    total_pnl   = sum(p.cash_pnl for p in positions)
    win_rate    = (winners / total) if total > 0 else 0

    pnl_score      = min(info.get("pnl", total_pnl) / 100_000, 50)  # 0-50 pts
    wr_score       = win_rate * 30                                    # 0-30 pts
    activity_score = min(len(positions) / 5, 20)                     # 0-20 pts
    score          = min(pnl_score + wr_score + activity_score, 100)
```

**Score components:**
| Component | Formula | Max Points |
|-----------|---------|------------|
| PnL rank | `pnl_usd / 100,000` capped | 50 |
| Win rate | `win_rate × 30` | 30 |
| Activity | `num_positions / 5` capped | 20 |
| **Total** | | **100** |

### Conviction Signal Scoring (`WalletScanner._compute_conviction`)

Computes per-market conviction when multiple tracked wallets hold the same outcome.

```python
# src/analytics/wallet_scanner.py  lines 367-449
import math
usd_factor    = math.log10(max(total_usd, 1)) * 8     # whale $ invested (log-scaled)
count_factor  = whale_count * 25                        # how many whales (25 pts each)
# Profit bonus: whales already in-profit → higher conviction
if avg_price > 0 and cur_price > 0:
    whale_return = (cur_price - avg_price) / avg_price
    profit_factor = max(0, min(whale_return * 20, 15))  # 0-15 pts
conviction = min(count_factor + usd_factor + profit_factor, 100)

# Signal strength thresholds
# >= 70 → "STRONG"
# >= 45 → "MODERATE"
# < 45  → "WEAK"
```

**Copy-paste conviction scoring:**
```python
import math

def score_conviction(whale_count: int, total_usd: float,
                     avg_price: float, cur_price: float) -> float:
    usd_factor = math.log10(max(total_usd, 1)) * 8
    count_factor = whale_count * 25
    profit_factor = 0.0
    if avg_price > 0 and cur_price > 0:
        whale_return = (cur_price - avg_price) / avg_price
        profit_factor = max(0.0, min(whale_return * 20, 15.0))
    return min(count_factor + usd_factor + profit_factor, 100.0)
```

**No bot/human differentiation.** The codebase has no logic to distinguish algorithmic traders from human traders. All tracked wallets are treated identically.

---

## 7. Order Flow Analysis (Microstructure)

Source: `src/connectors/microstructure.py`

### Configuration (from `MicrostructureConfig`):

```python
flow_imbalance_windows        = [60, 240, 1440]   # minutes: 1h, 4h, 24h
whale_size_threshold_usd      = 2000.0
trade_acceleration_window_mins = 30
vwap_lookback_trades          = 100
```

### Flow Imbalance (OFI) — All Three Windows

```python
# For each window (60, 240, 1440 min):
cutoff = now - (window_minutes * 60)
window_trades = [t for t in trades if t.timestamp >= cutoff]

buy_vol  = sum(t.size * t.price for t in window_trades if t.side == "buy")
sell_vol = sum(t.size * t.price for t in window_trades if t.side == "sell")
total_vol = buy_vol + sell_vol

imbalance_ratio = (buy_vol - sell_vol) / total_vol  # -1.0 to +1.0
net_flow        = buy_vol - sell_vol                  # USD
```

### VWAP Divergence

```python
# Last 100 trades (configurable)
total_volume  = sum(t.size for t in recent_trades)
weighted_sum  = sum(t.price * t.size for t in recent_trades)
vwap          = weighted_sum / total_volume
current_price = orderbook.mid
vwap_divergence     = current_price - vwap         # positive = above VWAP
vwap_divergence_pct = vwap_divergence / vwap       # fraction
```

### Trade Acceleration

```python
accel_window  = 30 * 60   # 30 min in seconds
accel_cutoff  = now - accel_window
baseline_cutoff = now - (accel_window * 4)        # previous 90 min

recent_count   = count trades in [accel_cutoff, now]
baseline_count = count trades in [baseline_cutoff, accel_cutoff]

trade_rate_current  = recent_count / 30           # trades per minute
trade_rate_baseline = baseline_count / 90
trade_acceleration  = trade_rate_current / trade_rate_baseline
# >2.0 = surging activity (configurable threshold)
```

### Book Depth Ratio

```python
# Top 10 levels each side
bid_depth = sum(bid.price * bid.size for bid in orderbook.bids[:10])
ask_depth = sum(ask.price * ask.size for ask in orderbook.asks[:10])

depth_ratio     = bid_depth / ask_depth          # >1 = more buy pressure
depth_imbalance = (bid_depth - ask_depth) / (bid_depth + ask_depth)  # -1 to +1
```

### Smart Money Direction (Composite)

```python
direction_score = 0.0

# Whale net flow
if whale_net_flow >  whale_threshold * 0.5: direction_score += 1.0
if whale_net_flow < -whale_threshold * 0.5: direction_score -= 1.0

# Book depth
if depth_imbalance > 0.2:  direction_score += 0.5
if depth_imbalance < -0.2: direction_score -= 0.5

# Shortest-window OFI
direction_score += flow_imbalances[0].imbalance_ratio * 0.5

# Classify
if direction_score >  0.5: direction = "bullish"
if direction_score < -0.5: direction = "bearish"
else:                       direction = "neutral"
```

---

## 8. Activity Heatmap

**There is no activity heatmap computation in this repo.** The codebase does not contain any 24-hour trading intensity calculation. Checking screenshots confirms a "whale tracker wallets" and "whale tracker signals" view exists in the dashboard, but the computation is purely based on live position snapshots and delta detection — not time-bucketed heatmap data.

The closest analog: `WalletScanner._detect_deltas()` tracks what changed since the *last scan* (every 15 minutes by default), but does not bucket activity by hour-of-day.

---

## 9. Complete Data Models

### WalletPosition (from `src/connectors/polymarket_data.py`)
```python
@dataclass
class WalletPosition:
    proxy_wallet:  str   = ""      # proxy wallet address
    asset:         str   = ""      # CLOB token ID
    condition_id:  str   = ""
    market_slug:   str   = ""
    title:         str   = ""
    outcome:       str   = ""      # "Yes" | "No"
    size:          float = 0.0     # shares held
    avg_price:     float = 0.0     # 0-1
    cur_price:     float = 0.0     # 0-1
    initial_value: float = 0.0     # USD at entry
    current_value: float = 0.0     # USD now
    cash_pnl:      float = 0.0     # USD P&L
    percent_pnl:   float = 0.0     # %
    end_date:      str   = ""
    realized:      bool  = False
```

### TrackedWallet (from `src/analytics/wallet_scanner.py`)
```python
@dataclass
class TrackedWallet:
    address:          str   = ""
    name:             str   = ""
    total_pnl:        float = 0.0
    win_rate:         float = 0.0
    active_positions: int   = 0
    total_volume:     float = 0.0
    last_scanned:     str   = ""
    score:            float = 0.0   # 0-100 composite
```

### ConvictionSignal (from `src/analytics/wallet_scanner.py`)
```python
@dataclass
class ConvictionSignal:
    market_slug:      str        = ""
    title:            str        = ""
    condition_id:     str        = ""
    outcome:          str        = ""      # "Yes" | "No"
    whale_count:      int        = 0
    total_whale_usd:  float      = 0
    avg_whale_price:  float      = 0
    current_price:    float      = 0
    conviction_score: float      = 0       # 0-100
    whale_names:      list[str]  = []
    direction:        str        = ""      # "BULLISH" | "BEARISH"
    signal_strength:  str        = ""      # "STRONG" | "MODERATE" | "WEAK"
    detected_at:      str        = ""
```

### WalletDelta (position change event)
```python
@dataclass
class WalletDelta:
    wallet_address:   str   = ""
    wallet_name:      str   = ""
    action:           str   = ""   # "NEW_ENTRY" | "EXIT" | "SIZE_INCREASE" | "SIZE_DECREASE"
    market_slug:      str   = ""
    title:            str   = ""
    outcome:          str   = ""
    size_change:      float = 0.0
    value_change_usd: float = 0.0
    current_price:    float = 0.0
    detected_at:      str   = ""
```

### GammaMarket (from `src/connectors/polymarket_gamma.py`)
```python
class GammaMarket(BaseModel):
    id:                str
    condition_id:      str
    question:          str
    description:       str
    category:          str
    market_type:       str        # MACRO | ELECTION | CORPORATE | WEATHER | SPORTS | UNKNOWN
    end_date:          datetime | None
    created_at:        datetime | None
    active:            bool
    closed:            bool
    volume:            float
    liquidity:         float
    tokens:            list[GammaToken]
    resolution_source: str
    slug:              str
```

### GammaToken
```python
class GammaToken(BaseModel):
    token_id: str
    outcome:  str
    price:    float
    winner:   bool | None
```

### TradeRecord (CLOB)
```python
@dataclass
class TradeRecord:
    price:     float
    size:      float
    side:      str       # "buy" | "sell"
    timestamp: float     # Unix seconds
```

### OrderBook (CLOB)
```python
@dataclass
class OrderBook:
    token_id: str
    bids:     list[OrderBookLevel]   # sorted high→low
    asks:     list[OrderBookLevel]   # sorted low→high
    timestamp: float

@dataclass
class OrderBookLevel:
    price: float
    size:  float
```

### MicrostructureSignals (from `src/connectors/microstructure.py`)
```python
@dataclass
class MicrostructureSignals:
    token_id:             str
    vwap:                 float
    vwap_divergence:      float
    vwap_divergence_pct:  float
    flow_imbalances:      list[FlowImbalance]   # one per window: 60, 240, 1440 min
    whale_alerts:         list[WhaleAlert]
    whale_buy_volume:     float
    whale_sell_volume:    float
    whale_net_flow:       float
    trade_rate_current:   float   # trades/min, recent window
    trade_rate_baseline:  float   # trades/min, 4x longer baseline
    trade_acceleration:   float   # current / baseline
    bid_depth_total:      float
    ask_depth_total:      float
    depth_ratio:          float   # bid/ask, >1 = buy pressure
    depth_imbalance:      float   # (bid-ask)/(bid+ask), -1 to +1
    large_trade_direction: str    # "bullish" | "bearish" | "neutral"
    confidence:           float   # 0-1
```

### Market Categories (from `src/engine/market_classifier.py`)

11 categories with subcategories:

| Category | Key Subcategories | Researchability |
|----------|-------------------|-----------------|
| MACRO | fed_rates, inflation, gdp, employment, trade, bonds | 75–92 |
| ELECTION | presidential, congressional, state_local, appointments, legislation | 68–88 |
| CRYPTO | btc_price, eth_price, altcoin_price, crypto_regulation, crypto_events | 45–78 |
| CORPORATE | earnings, ipo, mna, layoffs, stock_price | 55–85 |
| LEGAL | court_cases, criminal, regulatory | 75–80 |
| SCIENCE | pharma, space | 80–82 |
| TECH | ai, product_launch | 60–65 |
| SPORTS | major_leagues, combat, motorsport, general | 40–50 |
| WEATHER | severe_weather, forecast, natural_disaster | 35–70 |
| GEOPOLITICS | conflict, diplomacy | 62–65 |
| SOCIAL_MEDIA / CULTURE | social_posts, celebrity, entertainment | 8–55 |

---

## 10. Rate Limits (Documented in Code)

| Endpoint / Service | Req/s | Max Burst | Source |
|--------------------|-------|-----------|--------|
| Gamma API | 5.0/s | 10 | `rate_limiter.py` |
| CLOB API | 10.0/s | 20 | `rate_limiter.py` |
| Data API (positions/activity) | 1.0/s (= 60 RPM) | — | `api_pool.py` |
| Gamma API (pool) | 1.0/s (= 60 RPM) | — | `api_pool.py` |
| OpenAI | 3.0/s | 5 | `rate_limiter.py` |
| Anthropic | 2.0/s | 4 | `rate_limiter.py` |
| SerpAPI | 1.0/s | 3 | `rate_limiter.py` |

**Note:** These are self-imposed limits in the bot's token-bucket code. The actual Polymarket API limits are not documented in this repo. 60 RPM (1 req/s) per endpoint is treated as safe.

---

## 11. Authentication Requirements

| Operation | Auth Required | Mechanism |
|-----------|---------------|-----------|
| GET /positions (Data API) | No | — |
| GET /activity (Data API) | No | — |
| GET /markets (Gamma API) | No | — |
| GET /book (CLOB) | No | — |
| GET /trades (CLOB) | No | — |
| WebSocket feed | No | — |
| Place / cancel orders (CLOB) | **Yes** | `py-clob-client` + API key + EIP-712 signing |

---

## 12. Reuse vs Skip Assessment

### REUSE — High Value

| Item | File | Why |
|------|------|-----|
| **Data API client** (`DataAPIClient`) | `src/connectors/polymarket_data.py` | Clean async implementation, handles both list/dict response shapes, built-in retry. Copy the `get_positions()` and `get_activity()` methods directly. |
| **Gamma API client** (`GammaClient`) | `src/connectors/polymarket_gamma.py` | `parse_market()` function handles the awkward JSON-string fields for `outcomes`, `outcomePrices`, `clobTokenIds`. This parser is essential — save yourself the debugging. |
| **WalletPosition dataclass** | `src/connectors/polymarket_data.py` | Perfectly maps Data API response fields. Use as-is. |
| **ConvictionSignal scoring formula** | `src/analytics/wallet_scanner.py` lines 395–415 | The `log10(usd) * 8 + count * 25 + profit_bonus` formula is thoughtful and ready to use. |
| **Flow imbalance windows** | `src/connectors/microstructure.py` | The 60/240/1440 min OFI calculation is clean and correct. The pattern for windowing trade history applies directly. |
| **VWAP divergence calc** | `src/connectors/microstructure.py` lines 113–123 | Standard VWAP formula, correct implementation. |
| **Rate limiter** | `src/connectors/rate_limiter.py` | Token-bucket limiter with async support. The 60 RPM figure for Data API is well-calibrated. |
| **Market classifier** | `src/engine/market_classifier.py` | 11-category regex rule set with researchability scores is immediately useful for PolyAlpha's `MarketCategoryBreakdown` component. |
| **Hardcoded whale addresses** | `src/analytics/wallet_scanner.py` | These 15 addresses are real high-PnL traders on mainnet as of the repo creation date. Use as a seed list. |

### ADAPT — Useful with Modifications

| Item | Notes |
|------|-------|
| **WalletScanner** | The scan/delta/conviction loop is solid but scans all wallets serially. Adapt for concurrent fetching (`asyncio.gather`). |
| **MicrostructureConfig defaults** | `flow_imbalance_windows = [60, 240, 1440]` — matches PolyAlpha's stated 60min/4hr/24hr requirement exactly. |
| **Book depth analysis** | Uses top-10 levels. Adjust level count based on typical Polymarket order book depth. |

### SKIP — Not Relevant to PolyAlpha's Data Layer

| Item | Why |
|------|-----|
| Trade execution (`src/execution/`) | Not needed for PolyAlpha (display only). |
| LLM forecasting (`src/forecast/`) | PolyAlpha uses different AI integration. |
| Risk management (`src/policy/`) | Not applicable. |
| SQLite storage layer | PolyAlpha uses different storage. |
| **Leaderboard discovery** | There is NO dynamic leaderboard fetch — this feature does not exist in the repo. You must either hardcode addresses or build your own leaderboard API call. |
| **Activity heatmap** | Does not exist in this repo. Must be built from scratch using `GET /activity` time-bucketed by hour. |
| **Bot score / bot-vs-human detection** | Does not exist. The scoring is purely P&L + win-rate + activity count, with no algorithmic-trader detection logic. |

---

## 13. What's Missing / Must Be Built

Based on PolyAlpha's feature requirements vs. what exists in this repo:

1. **Dynamic leaderboard fetch** — No API endpoint is used. You need to either: (a) poll `https://data-api.polymarket.com/leaderboard` (unconfirmed endpoint, needs testing) or (b) scrape `https://polymarket.com/leaderboard`.

2. **Activity heatmap (24h trading intensity)** — Not in this repo. Must build from `GET /activity` responses, group by `hour_of_day = datetime.fromisoformat(ts).hour`, bucket into 24 bins.

3. **Bot vs human differentiation** — Not in this repo. Signals you could derive from Data API: inter-trade timing regularity, 24/7 activity pattern, position sizing consistency, reaction time to price moves.

4. **Trades endpoint** — The file comments reference `GET /trades?user={address}` on `data-api.polymarket.com` but **this endpoint is never called in the code**. Only `/positions` and `/activity` are actually fetched. Worth testing directly.

---

## 14. Quick-Start Snippet: Full Wallet Scan

```python
import asyncio
import httpx
import math

DATA_API = "https://data-api.polymarket.com"

async def fetch_positions(address: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{DATA_API}/positions",
                        params={"user": address.lower(), "sortBy": "CURRENT", "limit": 200})
        r.raise_for_status()
        data = r.json()
    return data if isinstance(data, list) else data.get("positions", data.get("data", []))

def parse_position(raw: dict) -> dict:
    return {
        "market_slug":    raw.get("slug", raw.get("market_slug", "")),
        "title":          raw.get("title", ""),
        "outcome":        raw.get("outcome", ""),
        "size":           float(raw.get("size", 0)),
        "avg_price":      float(raw.get("avgPrice", raw.get("avg_price", 0))),
        "cur_price":      float(raw.get("curPrice", raw.get("cur_price", 0))),
        "current_value":  float(raw.get("currentValue", raw.get("current_value", 0))),
        "cash_pnl":       float(raw.get("cashPnl", raw.get("cash_pnl", 0))),
        "condition_id":   raw.get("conditionId", raw.get("condition_id", "")),
    }

def score_wallet(positions: list[dict], known_pnl: float = 0) -> float:
    total_pnl = sum(p["cash_pnl"] for p in positions)
    winners   = sum(1 for p in positions if p["cash_pnl"] > 0)
    win_rate  = winners / len(positions) if positions else 0
    pnl_score      = min((known_pnl or total_pnl) / 100_000, 50)
    wr_score       = win_rate * 30
    activity_score = min(len(positions) / 5, 20)
    return min(pnl_score + wr_score + activity_score, 100)

def score_conviction(whale_count: int, total_usd: float,
                     avg_price: float, cur_price: float) -> float:
    usd_factor    = math.log10(max(total_usd, 1)) * 8
    count_factor  = whale_count * 25
    profit_factor = 0.0
    if avg_price > 0 and cur_price > 0:
        ret = (cur_price - avg_price) / avg_price
        profit_factor = max(0.0, min(ret * 20, 15.0))
    return min(count_factor + usd_factor + profit_factor, 100.0)

# Example usage
async def main():
    WALLETS = [
        {"address": "0x492442eab586f242b53bda933fd5de859c8a3782", "name": "Polybotalpha", "pnl": 3_250_000},
        # add more...
    ]
    all_positions = {}
    for w in WALLETS:
        raw = await fetch_positions(w["address"])
        all_positions[w["address"]] = [parse_position(r) for r in raw]
        score = score_wallet(all_positions[w["address"]], w["pnl"])
        print(f"{w['name']}: score={score:.1f}, positions={len(all_positions[w['address']])}")

asyncio.run(main())
```
