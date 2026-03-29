# Polymarket Bot Detection Research Report

> How Polymarket's CLOB actually works, what bots really look like, what humans really look like, and what we should actually measure.

---

## 1. How Polymarket Executes Orders

### The CLOB Architecture

Polymarket runs a hybrid off-chain/on-chain CLOB (Central Limit Order Book). Orders are signed client-side using EIP-712 typed data, submitted to an off-chain matching engine at `clob.polymarket.com`, matched by price-time priority, then settled atomically on-chain via the CTFExchange smart contract on Polygon. The matching engine is operated by Polymarket, but it can only match orders and cancel them per user request. It cannot set prices, frontrun users, or execute unauthorized trades.

The token system uses Gnosis's Conditional Token Framework (CTF). Every market has two ERC-1155 outcome tokens (YES and NO). Lock $1 USDC and you get 1 YES + 1 NO token. The exchange supports three matching modes: COMPLEMENTARY (buy YES vs sell NO, a direct swap), MINT (both sides buy, so new token pairs are minted from collateral), and MERGE (both sides sell, so tokens are merged back to collateral).

All orders on Polymarket are technically limit orders. "Market orders" are implemented by submitting a limit order at a marketable price. Two special order types exist: FOK (Fill-Or-Kill, must fill completely or cancel entirely) and FAK (Fill-And-Kill, fills as much as immediately available, cancels the rest).

### One Order = Multiple Trades (Critical Finding)

**This is the single most important fact for our bot detection algorithm.** When a user places ONE order that matches against multiple resting limit orders in the book, the matching engine creates SEPARATE trade records for each individual fill. A $10,000 market order filling against three different price levels produces three separate trade objects in the API.

The Polymarket docs state explicitly: "Trades that have been broken into multiple trade objects can be reconciled by combining trade objects with the same `market_order_id`, `match_time` and incrementing `bucket_index`'s."

So when we see alexmulti with 104 "trades" in 1 day across 5 markets, the real question is: does that represent 104 separate decisions, or 5-10 large orders that each filled across many resting limit orders? The answer depends on how many distinct `market_order_id` values those 104 trades map to.

### What the API Data Actually Represents

Each trade object in the `/trades` endpoint represents ONE partial fill, not a complete order. The `size` field is the amount filled in that particular match. To reconstruct a complete order:

- **Group by**: `market_order_id` + `match_time`
- **Sort by**: `bucket_index` (ascending, 0, 1, 2...)
- **Sum**: `size` across all trades in that group = total order size

On-chain, each fill emits an `OrderFilled` event with `makerAmountFilled` and `takerAmountFilled`. A critical finding from Paradigm Research (December 2025): OrderFilled events are double-counted on most dashboards because there are separate events for both the maker and taker side of the same trade. A $1,000 trade generates $2,000 in apparent volume.

### Implications for Our Algorithm

**We have been counting fills, not orders.** A human placing 5 large conviction bets that each fill across 20 resting limit orders looks like "100 trades" in our data. This is indistinguishable from a bot making 100 small individual trades — unless we group by `market_order_id`.

However, the activity endpoint we use (`/activity`) may not expose `market_order_id` or `bucket_index`. We need to verify what fields are available. If these grouping fields aren't available, we need an alternative heuristic (see Section 5).

---

## 2. Confirmed Bot Patterns

### 2.1 Latency Arbitrage Bots (15-Minute Crypto Markets)

**How they work:** These bots monitor BTC/ETH/SOL spot prices on Binance and Coinbase in real-time. Polymarket runs 15-minute up/down prediction markets on these assets. When spot price momentum is confirmed (say BTC clearly going up), the bot buys YES on the Polymarket "BTC up" market before the odds catch up. The bot enters only when the true probability is already ~85% but Polymarket still offers ~50/50 pricing.

**What their data looks like:**
- Exclusively 15-minute crypto markets (BTC, ETH, SOL up/down)
- Identical position size every trade ($4,000-$5,000)
- Win rate: 98-99%
- Holding period: less than 60 seconds
- Thousands of trades per month
- Zero variability in position sizing

**Notable example:** The wallet known as "0x8dxd" turned $313 into $437,600+ in one month with 7,300+ trades, then grew to $512,000+ all-time. Near-perfect win rate, identical bet sizes, exclusively 15-min crypto markets.

**Platform response:** Polymarket introduced dynamic taker fees up to 3.15% at 50/50 odds, making this strategy largely unprofitable. The average arbitrage window collapsed from 12.3 seconds (2024) to 2.7 seconds (Q1 2026).

### 2.2 Intra-Market Arbitrage Bots (YES+NO < $1.00)

**How they work:** Continuously scan for markets where YES price + NO price < $1.00. Buy both sides, locking in a guaranteed profit at settlement. Example: YES at $0.517 + NO at $0.449 = $0.966 cost for a guaranteed $1.00 payout = $0.034 risk-free profit per share.

**What their data looks like:**
- Trades on BOTH sides of the same market simultaneously
- 200+ trades per day
- 100% win rate (risk-free by design)
- Small profit per trade ($20-$100)
- Holding period: until settlement (minutes for 15-min markets)
- Every trade is a mathematically hedged pair

**Notable example:** The account "gabagool" (@gabagool22) runs an open-source bot called "Arbigab" that generated ~$58 profit per 15-minute market cycle.

### 2.3 Market Making Bots

**How they work:** Provide liquidity on both sides of a market simultaneously, earning the bid-ask spread. Place limit orders above and below the current price, manage inventory, and continuously update quotes as the market moves.

**What their data looks like:**
- Buy AND sell on the same market, often within the same minute
- Hundreds of simultaneous open orders
- Holding period: ~10 minutes average
- Win rate: 78-85%
- High trade frequency but low net directional exposure
- Automated rebalancing patterns

**Key signal:** Market makers have very high trade counts but very low net position changes. They buy and sell roughly equal amounts.

### 2.4 News/Speed Reaction Bots

**How they work:** Monitor news feeds, social media, on-chain data in real-time. React to events within 2-5 seconds. By the time a human reads a headline and clicks buy, the odds have already moved 8-12 cents.

**What their data looks like:**
- First 5-10 trades after any major odds shift are from the same bot clusters
- Trades at exact regular intervals (every 4 hours for 18+ days)
- Perfect distribution across all 24 hours (no sleep pattern)
- Average time between trades: ~20 seconds
- High daily trade count (100s per day)
- Short holding periods (seconds to minutes)

### 2.5 Esports Live-Betting Bots

**How they work:** Monitor live game data (parses, official stats, stream data) for LoL and Dota 2 matches. React faster than the market to in-game events like team fights, objective takes, or gold swings.

**What their data looks like:**
- Exclusively esports markets
- Trading ONLY during live matches
- Rapid position cycling during games
- High win rate on match/series/map winner markets
- Exit immediately after locking small gains

**Notable example:** "TeemuTeemuTeemu" turned $956 into $208,521 in 3 months (225x return). 1,000+ trades, biggest single win ~$90,000. Focus: LoL and Dota 2 match/map winners.

### 2.6 Weather Prediction Bots (AI-Powered)

**How they work:** Compare real-time weather API data (GFS ensemble forecasts, etc.) against Polymarket odds. Target extreme probability events priced at 0.1%-10%. Each bet is $50-$200. Uses Claude AI + weather APIs to identify mispricing.

**What their data looks like:**
- Exclusively weather markets
- Bets at extreme odds (very cheap tokens)
- $50-$200 per bet (small, consistent sizing)
- Win rate: ~33% (but massive payoff when correct, 20x+)
- Always positive PnL due to odds asymmetry
- Hold until settlement

**Notable example:** One account went from $27 to $63,853 using this strategy.

### 2.7 Ensemble Model / AI Prediction Bots

**How they work:** Integrate multiple data sources (news, social media, on-chain activity, legislative trackers, sports data) into a probability model. Compare model output to market price. Execute when the gap is significant.

**Notable example:** "ilovecircle" earned $2.2 million in two months with a 74% win rate using an ensemble trained on news + social sentiment.

### 2.8 Copy Trading Bots

**How they work:** Monitor successful trader wallets via WebSocket. Detect trades within milliseconds. Instantly replicate the trade in proportional amounts. Mirror sell orders when the target trader reduces position.

**What their data looks like:**
- Trades appear 100ms-5s after the copied wallet's trade
- Same markets as the target wallet
- Proportional position sizes
- Identical directional bias

---

## 3. Confirmed Human Patterns

### What Human Traders Look Like

**Typical human trading profile:**
- Trades per day: 2-25 for active traders (top performers average ~11/day)
- Market focus: Specialize in 1-3 domains (politics, sports, crypto, niche)
- Focus ratio (trades/markets): 2-10
- Holding period: 1 hour to 7+ days
- Position sizes: Rounded numbers ($50, $100, $500, $1,000)
- Win rate: 55-75% for profitable traders (only 7.6% of all wallets are profitable)
- Decision-making: Irregular intervals, visible sleep gaps, variable activity days

**Key behavioral signatures:**
- **Round position sizes**: Humans think in round numbers. A bot calculates $4,156.27; a human bets $4,000.
- **Sleep pattern**: A 6-8 hour gap in trading activity in every 24-hour cycle
- **Irregular timing**: Variable gaps between trades (15 min, then 2 hours, then 45 min)
- **Specialization**: Most successful humans find one edge and exploit it repeatedly
- **Conviction betting**: Large single positions on high-conviction views, held for days/weeks

### Notable Human Traders

**Theo (French "Trump Whale")**: Multiple accounts (Theo4, Fredi9999, PrincessCaro, Michie). Invested $30M+, profited $85M on Trump 2024 election. Strategy based on "neighbor poll effect" (gauging shy voters). High conviction, long-term holds, pure fundamental analysis. Very few trades relative to position size.

**Erasmus**: $1.3M profit. Strategy: polling analysis, policy debate tracking, campaign momentum reading. Political markets only. Low frequency, high precision.

**WindWalk3**: $1.1M+ profit. Deep specialization in RFK Jr. predictions. Narrow focus, deep domain expertise.

### Why Humans Can Look Like Bots

The CLOB order-splitting problem means a human placing 5 large conviction bets in a day could generate 50-100+ "trade" records in the API. Additional factors:

- **High-conviction whales**: A human betting $50,000 on a single outcome fills across many resting orders
- **Active day traders**: Some humans do trade 50+ times in a day during major events (elections, debates)
- **Systematic humans**: Some traders use spreadsheets and alerts, leading to more regular patterns than typical humans

The critical difference: humans have VARIABLE behavior. They don't trade the exact same size every time, at the exact same intervals, on the exact same market types.

---

## 4. Existing Detection Methodologies

### 4.1 Hubble Research Methodology

Hubble Research (led by 0xLeon) analyzed 90,000+ Polymarket wallets using a "Quadrant Analysis Method."

**Key metrics and thresholds:**

| Metric | Human Zone | Bot Zone |
|---|---|---|
| Markets participated (lifetime) | < 289 | > 500 |
| Focus Ratio (trades/markets) | 2-10 | 39,394+ (extreme outliers) |
| Holding period | > 1 hour | < 60 sec (HFT), ~10 min (market maker) |
| Time exposure for signal value | > 1 hour | < 10 minutes = noise |

**Key finding:** 3.7% of users (~54,000 addresses) generate 37.44% of total trading volume. Nearly 40% of visible "market sentiment" is algorithmically generated noise.

**Focus Ratio insight:** A high focus ratio (concentrated trades in few markets) is 4x more valuable than a high win rate. Focused traders average $1,225 returns vs $306 for diversified ones (33.8% win rate vs 41.3%). This is counterintuitive: the "bots" diversify broadly, while smart humans concentrate.

### 4.2 Stacy Muur / Academic Research

Based on the paper "Unravelling the Probabilistic Forest" (August 2025, Saguillo et al.):

- 14 of top 20 most profitable Polymarket wallets are bots
- Between April 2024 and April 2025, arbitrage bots extracted approximately $40 million
- Top 3 bot wallets: 10,200+ bets combined, $4.2M profit
- Top single bot: $2.0M from 4,049 trades

**Three arbitrage types identified:**
1. Market Rebalancing (YES+NO < $1.00 within one market)
2. Combinatorial (across related markets)
3. Latency (between Polymarket and crypto exchanges)

### 4.3 BotEdge (botedge.net)

Real-time bot detection tool that scans the leaderboard hourly.

**Scoring:** 0-100 bot-likelihood score based on 6 behavioral heuristics:
1. Trade frequency patterns
2. Timing regularity
3. Position sizing consistency
4. Hold time patterns
5. Market selectivity
6. Win rate stability

Threshold: 45+ = bot candidate. Refreshes every 5 minutes for featured accounts.

### 4.4 Chaos Labs (Wash Trading Detection)

Focused on wash trading specifically, not general bot detection.

**Findings:** Wash trading comprises ~33% of Polymarket's presidential market volume. Additional Columbia University research found ~25% of platform's historical volume involved rapid buy-sell cycles to self or colluding accounts (motivation: gaming potential future token airdrops).

### 4.5 Other Tools

- **HashDive**: Smart Scores from -100 to +100. Evaluates profitability, consistency, history. Over 70% correlation when following high-score traders.
- **Specula**: Ghost wallet detection via coordinated timing and funding patterns. Multi-factor scoring across full trade history.
- **Polywhaler**: Whale tracking (>$10K transactions). AI-powered insider detection. Flags rapid open/close cycles and extreme-price trading.
- **Dune Dashboards**: Multiple public dashboards tracking bot activity, including `dune.com/kucoinventures/trading-bots-on-polymarket`.

---

## 5. Recommendations for Our Algorithm

### 5.1 The Order-Splitting Problem (Must Solve First)

**Option A (Best):** If the activity API exposes `market_order_id` or `transaction_hash`, group fills into logical orders before counting. This gives us the true decision count.

**Option B (If no grouping field available):** Use time-based clustering. Trades from the same wallet on the same market within a short window (e.g., 30 seconds) likely represent fills from a single order. Count clusters, not individual trades.

**Option C (Fallback):** Accept that trade count is inflated and adjust all thresholds upward accordingly. A "100 trades/day" threshold might need to be "500 trades/day" to account for order splitting.

### 5.2 Recommended Detection Factors

Based on all research, here are the factors ranked by reliability:

**Tier 1 (Strongest Signals):**

1. **Market Type Concentration**: Bots that exclusively trade 15-min crypto markets are almost certainly latency arb bots. This is the single strongest signal.

2. **Position Size Variance**: Calculate the coefficient of variation (std dev / mean) of position sizes. Bots have near-zero variance (identical sizes every trade). Humans have high variance (round numbers, different conviction levels). Threshold: CV < 0.05 = strong bot signal.

3. **Both-Sides Trading**: If a wallet buys YES AND NO on the same market within the same session, it's likely an arb bot or market maker. Humans almost never do this.

4. **24-Hour Distribution**: Plot trades across 24 1-hour buckets. Humans show a clear 6-8 hour gap (sleep). Bots show uniform distribution. Use entropy or gap analysis.

**Tier 2 (Good Supporting Signals):**

5. **Trade Timing Regularity**: Measure the variance in time between consecutive trades. Bots have regular intervals (every N seconds/minutes). Humans are irregular. Low variance = bot.

6. **Market Breadth vs. Lifetime**: Following Hubble's finding, >500 lifetime markets is suspicious. But this requires long-term data we may not have for recent wallets.

7. **Holding Period**: If detectable from our data (buy timestamp vs sell timestamp or settlement), <10 minutes average is bot territory. >1 hour average is human territory.

8. **Win Rate Extremes**: Win rates above 95% are almost impossible for humans over a significant number of trades. Combined with high volume, this is a strong bot signal.

**Tier 3 (Supplementary):**

9. **Focus Ratio**: Trades per market. Extreme values (>100 trades on a single market) suggest market making or arb bots. Humans typically have 2-10.

10. **Reaction Speed**: If we can detect trades within seconds of major odds movements, those are bots. This requires price-change context we may not have.

### 5.3 Proposed Classification Tiers

Instead of binary bot/human, use a spectrum:

| Classification | Description | Typical Signals |
|---|---|---|
| **Confirmed Bot** | Automated trading, no human in the loop | Identical position sizes, 24/7 trading, single market type, 95%+ win rate, both-sides trading |
| **Likely Bot** | High probability automated, possibly with human oversight | Regular timing, low size variance, narrow market focus, high trade frequency |
| **Ambiguous** | Could be either, insufficient signal | High trade count but variable sizes, or specialized human with systematic approach |
| **Likely Human** | Behavioral patterns consistent with manual trading | Sleep gaps, round position sizes, variable timing, mixed market types |
| **Confirmed Human** | Clear human behavioral signatures | Known public figure, irregular patterns, conviction betting, long holds |

### 5.4 What We Can Detect With Our Data (Activity + Positions Endpoints)

**From Activity endpoint:** Trade timestamps, market IDs, sizes, prices, side (buy/sell), asset type. This gives us: timing patterns, size variance, market breadth, both-sides detection, 24h distribution.

**From Positions endpoint:** Current open positions, market exposure. This gives us: holding period estimates (if we track over time), market concentration, directional bias.

**What we CAN'T detect without additional data:**
- Order-level grouping (unless `market_order_id` is available)
- Reaction speed to price changes (need real-time price feed)
- On-chain patterns (funding sources, wallet age, related wallets)
- Execution latency

### 5.5 Priority Action Items

1. **Inspect the raw API response** for `market_order_id`, `bucket_index`, `match_time`, or `transaction_hash` fields. If present, group trades into orders immediately.

2. **Implement position size variance** (coefficient of variation). This is the easiest, most reliable signal and requires no additional data.

3. **Implement 24-hour trade distribution analysis**. Simple entropy calculation over 24 hourly buckets. High entropy = bot, low entropy (with gaps) = human.

4. **Add market type tagging**. If a wallet only trades crypto 15-min markets, flag it immediately as likely latency arb bot.

5. **Implement both-sides detection**. Check if the wallet has both YES and NO positions or trades on the same market. Immediate arb/market-maker signal.

6. **Drop or de-weight raw trade count** as a primary signal. It's inflated by order splitting and is the most unreliable metric we currently use.

---

## Sources

### Official Documentation
- Polymarket CLOB Introduction: docs.polymarket.com/developers/CLOB/introduction
- Polymarket Trades Overview: docs.polymarket.com/developers/CLOB/trades/trades-overview
- Polymarket Order Lifecycle: docs.polymarket.com/concepts/order-lifecycle
- Polymarket On-Chain Order Info: docs.polymarket.com/developers/CLOB/orders/onchain-order-info
- CTF Exchange Technical Overview: github.com/Polymarket/ctf-exchange

### Research & Analysis
- "Unravelling the Probabilistic Forest" (Saguillo et al., August 2025): arxiv.org/abs/2508.03474
- Paradigm: "Polymarket Volume Is Being Double-Counted" (December 2025)
- Chaos Labs / Columbia University: Wash trading analysis
- Hubble Research (0xLeon): Quadrant Analysis of 90,000+ wallets

### Bot Detection Tools
- BotEdge: botedge.net
- HashDive: hashdive.com
- Specula: specula.app
- Polywhaler: polywhaler.com

### Articles & Threads
- "Polymarket Has a Bot Problem" (0xicaruss, Medium)
- "Arbitrage Bots Dominate Polymarket With Millions in Profits" (Yahoo Finance)
- "How to Avoid Bots and Find Real Experts" (KuCoin)
- "Beyond Simple Arbitrage: 4 Polymarket Strategies Bots Actually Profit From" (Medium)
- Stacy Muur: Polymarket Trading Tools Masterclass (Substack)
- Finbold: "Trading Bot Turns $313 Into $438,000 on Polymarket"
- Esports.net: "A Polymarket Bot Makes Over $200k in 3 Months"

### Dune Dashboards
- dune.com/kucoinventures/trading-bots-on-polymarket
- dune.com/filarm/polymarket-activity
- dune.com/datadashboards/polymarket-overview
