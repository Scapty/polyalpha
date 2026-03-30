# Dexio — Platform Documentation

*Non-technical guide for the FNCE313 presentation team*

---

## Section 1: What is Dexio?

Dexio is a prediction market intelligence platform that answers one question: **is this Polymarket trader a bot or a human?** Prediction markets like Polymarket let people bet real money on future events (elections, crypto prices, sports). But a significant portion of the trading volume comes from automated bots, not humans. Dexio fetches public trading data, runs a 4-factor detection algorithm, and uses AI to explain the results. It's built for researchers, traders, and anyone who wants to understand who they're really trading against.

---

## Section 2: The Three Pages

### Wallet Stalker

This is the core tool. The user pastes any Polymarket wallet address and clicks "Analyze."

1. The app calls the Polymarket Data API to fetch up to 3,000 trades, the trader's positions, and their leaderboard profile (rank, PnL, volume).
2. The app computes trading metrics from the raw data: how many orders per day, whether the trader bets on both sides of a market, how uniform their bet sizes are, and whether they have a sleep pattern.
3. The app runs the bot detection algorithm using 4 weighted factors and produces a score from 0 to 100.
4. If the user has an Anthropic API key, the app sends the metrics to Claude AI, which writes a plain-English explanation of the result and identifies the trader's likely strategy (market making, arbitrage, conviction betting, etc.). The AI does not change the score — it only explains it.
5. The dashboard displays: a bot score gauge, AI reasoning, a factor breakdown with individual scores, an activity heatmap (24h × 7 days), a market category breakdown, and a full trade history table.
6. A copy-trading simulator lets the user replay the trader's closed positions with configurable capital, position sizing, and strategy (fixed, compound, martingale, anti-martingale).
7. A wallet tracking feature lets the user enter their email to receive alerts when this trader makes a new trade. This uses Supabase for storage and Resend for email delivery.

**How to explain this in the presentation:** "You paste a wallet address, and Dexio tells you if that trader is a bot or a human, shows you how they trade, and lets you simulate copying their trades."

---

### AI Agent Tracker (Bot Leaderboard)

This page tracks the top Polymarket traders and classifies each one as a bot or human.

1. The user selects how many traders to track (top 10, 20, or 50), a time period (7 days, 30 days, all time), and optionally a market category (Crypto, Politics, Economics, etc.).
2. The user clicks "RE-SCAN." The app fetches the Polymarket leaderboard, then for each trader, fetches their trades and runs the same 4-factor bot detection algorithm.
3. The scan processes traders in batches of 5 to avoid hitting API rate limits. A progress indicator shows the current trader being analyzed.
4. When the scan completes, the page displays four headline stats: total traders tracked, bots detected, humans detected, and bot dominance percentage.
5. A comparison table shows bots vs. humans side by side: average win rate, total PnL, average trades per day, average hold time, active hours per day, and PnL share.
6. A bar chart shows win rate by market category for bots vs. humans, with an auto-generated insight (e.g., "On Politics markets, humans outperform bots by 20pp in win rate").
7. A sortable trader table lists every trader with their rank, name, bot score, classification, win rate, PnL, trades per day, average hold time, and market focus. Clicking a row opens Wallet Stalker for that trader.
8. Results are cached in Supabase so the page loads instantly on revisit. The user can re-scan at any time to refresh the data.

**How to explain this in the presentation:** "Agent Tracker scans the top traders on Polymarket's leaderboard, classifies each one, and shows you how bots perform compared to humans across different market categories."

---

### Odds Analyzer (Arbitrage Scanner)

This page compares prices between Polymarket and Kalshi to find pricing differences.

1. The user pastes a Polymarket or Kalshi market URL.
2. The app detects which platform the URL is from and fetches the market data (prices, volume, outcomes).
3. The app uses Claude AI with web search to find the equivalent market on the other platform. It matches markets based on similar event descriptions and resolution dates.
4. Once matched, the page shows a side-by-side comparison: YES and NO prices on both platforms, bid/ask spreads, volume, and deadline.
5. An education section explains the theoretical arbitrage: if YES is 45¢ on Polymarket and 52¢ on Kalshi, you could buy low and sell high. It factors in platform fees (Polymarket: 1% taker fee; Kalshi: $2 per contract) and shows profit after fees.
6. An AI analysis compares the resolution conditions (they can differ between platforms), analyzes deadline differences, and recommends which platform offers the better price.
7. A Price Finder tool lets the user search for any market by topic and finds matching markets on Kalshi using AI matching.
8. A price alert feature lets the user set email notifications when a market price crosses a threshold (e.g., "alert me when this market drops below 40¢").

**How to explain this in the presentation:** "Odds Analyzer compares the same event across Polymarket and Kalshi to find price differences and explains whether a real arbitrage opportunity exists after fees."

---

## Section 3: How Bot Detection Works

The algorithm uses 4 factors to produce a bot score from 0 to 100. Each factor is scored independently, then combined with weights.

### Factor 1: Trade Frequency (35% of the score)

**What it measures:** How many trading decisions the wallet makes per day.

**Why it matters:** Bots can trade hundreds of times per day without rest. Humans typically make 1 to 15 trading decisions per day.

**How it's scored:** The app first groups individual trade fills into "orders" — because Polymarket's order book splits one large order into multiple smaller fills. Any fills on the same market within 30 seconds are counted as one order. Then it divides total orders by the number of active days.

- 200+ orders/day → score 100 (almost certainly a bot)
- 50–100 orders/day → score 85–95
- 15–30 orders/day → score 50–70
- Under 5 orders/day → score 5 (almost certainly human)

**Example:** A market-making bot places 354 orders per day → scores 100. A human whale like "Theo" places 27 orders per day → scores around 50–70.

---

### Factor 2: Trading Behavior (25% of the score)

**What it measures:** Whether the trader bets on both YES and NO on the same market, and whether they focus on short-term crypto markets.

**Why it matters:** Market-making bots buy YES and sell YES (or buy both YES and NO) on the same market to capture the spread. Humans usually pick a side and stick with it. Short-term crypto markets (5-minute, 1-hour bets) are almost exclusively traded by bots.

**How it's scored:** It starts at a base of 30 and adds or subtracts points. If 70%+ of markets have both-side trading, it adds 50 points. If 80%+ of trades are on short-term crypto, it adds 30 points. If the trader only trades politics and never sells, it subtracts 25 points.

**Example:** A bot trading both sides on 85% of its markets and focused on 5-minute crypto → scores 95. A human betting only YES on political events → scores around 10–15.

---

### Factor 3: Size Uniformity (25% of the score)

**What it measures:** How consistent the trader's bet sizes are, using a statistic called the Coefficient of Variation (CV).

**Why it matters:** Bots are programmed to bet the exact same amount every time ($100.00, $100.00, $100.00). Humans tend to vary their bets naturally ($50, $200, $75, $500).

**How it's scored:** The CV measures how spread out the bet sizes are. A CV near 0 means every bet is basically the same size. A CV above 1.0 means the sizes vary a lot.

- CV below 0.05 → score 98 (machine-identical sizes, almost certainly a bot)
- CV 0.15–0.30 → score 70–85
- CV 0.60–1.00 → score 30–50
- CV above 2.0 → score 5 (very varied sizes, almost certainly human)

**Example:** A bot that always bets exactly $47.23 has a CV of 0.01 → scores 98. A human who bets $50 one day and $2,000 the next has a CV of 2.5 → scores 5.

---

### Factor 4: Activity Pattern (15% of the score)

**What it measures:** Whether the trader has a sleep gap — a block of hours with zero trades.

**Why it matters:** Humans need to sleep. A wallet that trades 23 hours a day with no break is almost certainly automated.

**How it's scored:** The app looks at which hours of the day (UTC) have trades and finds the longest gap of consecutive inactive hours.

- Sleep gap of 0–1 hours + 16+ active hours/day → score 95 (never sleeps, definitely a bot)
- Sleep gap of 2–3 hours → score 65–80
- Sleep gap of 6–8 hours + under 8 active hours/day → score 5–15 (normal human sleep pattern)

**Example:** A bot active 19.5 hours/day with a 1-hour gap → scores 95. A human active 3.7 hours/day with an 8-hour sleep gap → scores 5.

---

### The Classification Rule

The final classification (Bot or Human) is not just the weighted average. It uses these rules:

- If **any single factor scores 80 or above** → classified as **Bot** (one overwhelming signal is enough)
- If **3 or more factors score 50 or above** → classified as **Bot** (multiple moderate signals)
- If **2 factors score 50+ AND the weighted score is 40+** → classified as **Bot**
- Otherwise → classified as **Human**

**How to explain this in the presentation:** "One strong signal is enough. If a trader never sleeps OR always bets the exact same amount OR trades 200 times a day, that alone is enough to flag them as a bot. But even if no single signal is extreme, three moderate signals together still trigger a bot classification."

---

### Why We Group Trades into Orders

When a trader places one order for $1,000 on Polymarket, the order book may fill it as ten separate $100 trades. If we counted each fill as a separate trade, a normal human would look like a high-frequency bot. So the algorithm groups all fills on the same market within 30 seconds into a single "order." This makes the frequency metric accurate.

**How to explain this in the presentation:** "Polymarket's order book splits large orders into smaller pieces. We re-group them so we're counting real trading decisions, not order book artifacts."

---

## Section 4: Where AI is Used

### In the Wallet Stalker (Bot Explanation)

After the algorithm computes the bot score, the app sends the metrics (not the raw trades) to Claude AI. The AI receives: the score, the classification, all 4 factor scores, the number of orders per day, the size CV, the sleep gap, the category breakdown, and the buy/sell ratio.

Claude returns three things: a 2–3 sentence explanation using the actual numbers, an identified trading strategy (latency arbitrage, market making, conviction betting, etc.), and 3 key signals (e.g., "Size CV of 0.02 indicates machine-identical bet sizing").

**The AI does NOT decide the bot score.** The algorithm decides. The AI only explains. If you don't have an API key, the score and classification still work — you just don't get the AI explanation.

### In the Odds Analyzer (Market Matching)

When comparing markets across platforms, Claude AI is used twice: first to find the equivalent market on the other platform (using web search), and second to compare the resolution conditions between the two platforms and explain any differences.

### In the Price Finder

Claude AI matches a user's natural language search query to Kalshi markets from a pre-fetched list.

---

## Section 5: Data Sources

All data comes from Polymarket's public APIs. No authentication or API key is needed — it's all public blockchain data.

**What we get:** For each trade: the timestamp (when it happened), the price (how much per share), the size (how many shares), the market title, the outcome (YES or NO), and the wallet address. For positions: the current value, the entry price, unrealized profit/loss. For the leaderboard: rank, username, total PnL, total volume.

**Rate limits:** The Polymarket API allows roughly 60 requests per minute. The Agent Tracker processes traders in batches of 5 with delays to stay within limits. The API returns a maximum of about 3,000 trades per wallet.

---

## Section 6: The APIs and Endpoints

### Polymarket Data API

- **Trades:** We send a wallet address, we get back a list of every trade that wallet has made (timestamp, price, size, market, side). Called when analyzing a wallet or scanning the leaderboard.
- **Positions:** We send a wallet address, we get back all open and closed positions (current value, entry price, unrealized PnL). Called alongside trades during wallet analysis.
- **Activity:** We send a wallet address, we get back yield/interest events. Used as supplementary data.

### Polymarket Gamma API

- **Markets:** We send a market slug or condition ID, we get back market details including outcome prices and resolution status. Called to determine if a market has resolved (needed for win rate calculation).
- **Events:** We send an event slug, we get back all markets within that event. Called by the Arbitrage Scanner.

### Polymarket Leaderboard API

- **Top traders:** We send a time period and sorting parameter, we get back a ranked list of traders with their PnL, volume, username, and profile image. Called by the Agent Tracker when scanning.
- **Individual profile:** We send a wallet address, we get back that trader's rank and stats. Called during Wallet Stalker analysis.

### Kalshi API

- **Markets:** We fetch all active Kalshi markets (up to 1,000). Called by the Odds Analyzer and Price Finder for cross-platform comparison.
- **Events:** We fetch event-level data from Kalshi. Called when the user pastes a Kalshi URL.

### Claude API (Anthropic)

- **Bot explanation:** We send the computed metrics and scoring factors, we get back a JSON response with reasoning, strategy, and key signals. Called after bot scoring in Wallet Stalker.
- **Market matching:** We send a market description with web search enabled, we get back the matching market on the other platform. Called by the Odds Analyzer.
- **Resolution comparison:** We send two markets' resolution conditions, we get back an analysis of differences. Called by the Odds Analyzer.

---

## Section 7: Tech Stack

Dexio is a single-page web application built with **React** (the UI framework that handles what you see and interact with), styled with **CSS custom properties** (a dark theme with teal accents), and deployed on **Vercel** (a cloud platform that hosts the website and handles builds automatically when code is pushed to GitHub). The app uses **Supabase** as its database for caching leaderboard results, storing tracked wallets, and managing user authentication. Emails (trade alerts and tracking confirmations) are sent through **Resend**. The AI features use the **Anthropic API** (Claude) for natural language analysis. All external data comes from Polymarket and Kalshi's public APIs — no blockchain node or special access is needed.

---

## Section 8: Key Numbers and Facts

**Industry context (for the presentation):**

- "14 out of 20 top Polymarket traders are bots" — Stacy Muur, March 2025
- "3.7% of users generate 37.44% of trading volume" — Hubble Research
- "Arbitrage bots extracted $40M from Polymarket in one year" — academic paper, Cracking the code of Automated Market Makers
- Polymarket processed over $9 billion in trading volume in 2024
- The 2024 US Presidential Election market alone attracted $3.6 billion in volume

**Our detection method:**

- 4 detection factors: Trade Frequency (35%), Trading Behavior (25%), Size Uniformity (25%), Activity Pattern (15%)
- The algorithm classifies based on a hard rule: if any single factor scores 80+, it's flagged as a bot
- Order clustering groups trade fills within 30 seconds to avoid false positives from order book splitting
- The AI (Claude) explains the result but does not influence the score

**Platform capabilities:**

- Wallet Stalker analyzes up to 3,000 trades per wallet
- Agent Tracker can scan and classify the top 10, 20, or 50 traders
- Odds Analyzer compares prices across Polymarket and Kalshi with AI-powered market matching
- Trade alerts check for new trades every 5 minutes and send email notifications
- Price alerts notify users when a market crosses a price threshold
