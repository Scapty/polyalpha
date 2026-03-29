# Bot Scoring Debug Results
Generated: 2026-03-29T10:40:09.052Z

---

## Summary: Root Cause + Fix

### What was wrong

The timing pattern factor used `activeHoursPerDay` as its only signal, calibrated for **crypto arbitrage bots** that trade 24/7. These 5 wallets are all **sports bettors** who only trade during game windows (evening US time = midnight-4am UTC). A sports bot — or even an active human bettor — will naturally show only 2–7 active hours/day, which the old algorithm read as a strong "human" signal.

Before fix: all 5 wallets scored 29–36 → "Likely Human"

### What was fixed (`src/utils/botScoring.js`)

**Timing Pattern factor**: Added a second signal — `tradesPerActiveHour` (trade intensity within the windows they're actually active). A human places 1–3 bets per game hour; an automated system fires 5–20+ per hour.
- Combined as `max(activeHoursScore, intensityScore)` — whichever is stronger wins
- Override Rule 5: `tradesPerActiveHour ≥ 10 AND tradesPerDay ≥ 20` → score ≥ 72

**Market Focus factor**: Added sports regex (`nba|nfl|nhl|mlb|spread:|total:|vs.|etc`). Sports-heavy wallets now score 50 (neutral) instead of 35 (slightly human). A sports bettor could be human or automated.

### Results after fix

| Wallet | Before | After | Note |
|--------|--------|-------|------|
| Polybotalpha | 35 Likely Human | **50 Uncertain** | 9.2 trades/active-hr |
| kch123 | 34 Likely Human | **49 Uncertain** | 5.7 trades/hr + night bonus |
| beachboy4 | 36 Likely Human | **43 Uncertain** | 2-min avg hold, 4.4 trades/hr |
| FeatherLeather | 29 Likely Human | **44 Uncertain** | 7.1 trades/hr in bursts |
| DrPufferfish | 18 Likely Human | **19 Likely Human** | 3.5 trades/day, 30% win rate |

### Why these wallets aren't scored "Likely Bot"

These are sports bettors. They don't exhibit traditional bot signatures:
- No crypto/arb market focus
- Hold-to-resolution (no explicit sell trades → win rate and hold duration factors can't score them)
- Trade frequency of 10–50/day is high for a human but low vs a 24/7 crypto bot

An actual 24/7 crypto bot still scores 85+ (R1 override triggers at ≥22 active hrs/day).
An every-minute bot (even during game hours): 60 trades/active-hr → intensityScore 95 → R5 → ≥72 → Likely Bot.

### What the "Insufficient Data" threshold means
Minimum 20 trades required. All 5 wallets had 113–3000 trades, so this isn't an issue here.

---



======================================================================
WALLET: Polybotalpha — 0x492442eab586f242b53bda933fd5de859c8a3782
======================================================================

── 1. FETCHING TRADES ────────────────────────────────────────────────
  Total fetched: 3000 trades

── 2. RAW TRADE STRUCTURE (first object) ─────────────────────────────
  Keys: asset, bio, conditionId, eventSlug, icon, name, outcome, outcomeIndex, price, profileImage, profileImageOptimized, proxyWallet, pseudonym, side, size, slug, timestamp, title, transactionHash
  Timestamp field: timestamp
  Raw timestamp value: 1774750006 (type: number)
  As date (direct): 1970-01-21T12:59:10.006Z
  As date (*1000): 2026-03-29T02:06:46.000Z
  Side: BUY | Size: 12755.79 | Price: 0.47
  Title: Capitals vs. Golden Knights: O/U 6.5

── 3. FULL FIRST TRADE OBJECT ────────────────────────────────────────
{
  "proxyWallet": "0x492442eab586f242b53bda933fd5de859c8a3782",
  "side": "BUY",
  "asset": "60200335366583529750107915773663861788137817376410291993258126224740571960537",
  "conditionId": "0x982b435c47eb55bec825ad62d79156a0d07e34e4700a89f374b579fd6d516632",
  "size": 12755.79,
  "price": 0.47,
  "timestamp": 1774750006,
  "title": "Capitals vs. Golden Knights: O/U 6.5",
  "slug": "nhl-wsh-las-2026-03-28-total-6pt5",
  "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/nhl.png",
  "eventSlug": "nhl-wsh-las-2026-03-28",
  "outcome": "Over",
  "outcomeIndex": 0,
  "name": "0x492442EaB586F242B53bDa933fD5dE859c8A3782-1766317541188",
  "pseudonym": "Multicolored-Self",
  "bio": "",
  "profileImage": "",
  "profileImageOptimized": "",
  "transactionHash": "0xe0dbde43eb1d38a52fe5e3cc4d5c072a5753be49ef083c39b9e9a5ade83a3965"
}

── 4. TIMESTAMP ANALYSIS ─────────────────────────────────────────────
  Valid timestamps: 3000 / 3000
  Earliest trade: 2026-01-26T16:43:49.000Z (1769445829000)
  Latest trade:   2026-03-29T02:06:46.000Z (1774750006000)
  Span: 61.39 days (1473.4 hours)
  Trades per day: 48.9
  Trades per hour: 2.0
  Active UTC hours (across all data): 21/24
  Hour distribution: 00h=297, 01h=247, 02h=160, 03h=67, 04h=44, 05h=10, 09h=2, 10h=2, 11h=18, 12h=13, 13h=82, 14h=59, 15h=70, 16h=204, 17h=243, 18h=237, 19h=226, 20h=102, 21h=35, 22h=344, 23h=538
  First 5 timestamps: 2026-01-26T16:43:49.000Z, 2026-01-26T16:44:45.000Z, 2026-01-26T18:49:05.000Z, 2026-01-26T18:49:05.000Z, 2026-01-26T18:55:45.000Z
  Last 5 timestamps:  2026-03-29T02:02:16.000Z, 2026-03-29T02:02:20.000Z, 2026-03-29T02:06:28.000Z, 2026-03-29T02:06:36.000Z, 2026-03-29T02:06:46.000Z

── 5. FACTOR SCORES ──────────────────────────────────────────────────
  Trade Frequency (15%)        score= 55  contrib= 8.3  | 48.9 trades/day over 61.4 days
  Timing Pattern (30%)         score= 68  contrib=20.4  | 5.3/24 active hrs/day · 9.2 trades/active-hr
  Win Rate (15%)               score= 50  contrib= 7.5  | Not enough resolved pairs
  Size Uniformity (15%)        score= 10  contrib= 1.5  | CV=1.691, mean=$60832.06, stddev=$102857.71
  Holding Duration (15%)       score= 50  contrib= 7.5  | No resolved buy→sell pairs
  Market Focus (10%)           score= 50  contrib= 5.0  | 0% crypto, 100% sports, 0% politics

  Weighted average: 50
  No override rules triggered.

  FINAL SCORE: 50 → Uncertain

── 6. DIAGNOSIS ──────────────────────────────────────────────────────
  ⚠ LOW timing score (68): only 5.3 active hrs/day
    dayHourSlots=328, uniqueDays=62
    If uniqueDays=1, ALL trades happened in 1 calendar day → normal to have <24 hr slots
    If slots is very low, check whether timestamps are valid (year/month correct?)

======================================================================
WALLET: kch123 — 0x6a72f61820b26b1fe4d956e17b6dc2a1ea3033ee
======================================================================

── 1. FETCHING TRADES ────────────────────────────────────────────────
  Total fetched: 3000 trades

── 2. RAW TRADE STRUCTURE (first object) ─────────────────────────────
  Keys: asset, bio, conditionId, eventSlug, icon, name, outcome, outcomeIndex, price, profileImage, profileImageOptimized, proxyWallet, pseudonym, side, size, slug, timestamp, title, transactionHash
  Timestamp field: timestamp
  Raw timestamp value: 1774757922 (type: number)
  As date (direct): 1970-01-21T12:59:17.922Z
  As date (*1000): 2026-03-29T04:18:42.000Z
  Side: BUY | Size: 4045 | Price: 0.59
  Title: Capitals vs. Golden Knights

── 3. FULL FIRST TRADE OBJECT ────────────────────────────────────────
{
  "proxyWallet": "0x6a72f61820b26b1fe4d956e17b6dc2a1ea3033ee",
  "side": "BUY",
  "asset": "82900645271827882379553460497896182861700399819920273587348429108128218714619",
  "conditionId": "0xa44867be8210197d50720a175ffbfbacd0f8f6606ad023a3da8ca5c9fec36130",
  "size": 4045,
  "price": 0.59,
  "timestamp": 1774757922,
  "title": "Capitals vs. Golden Knights",
  "slug": "nhl-wsh-las-2026-03-28",
  "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/nhl.png",
  "eventSlug": "nhl-wsh-las-2026-03-28",
  "outcome": "Golden Knights",
  "outcomeIndex": 1,
  "name": "kch123",
  "pseudonym": "Aggravating-Grin",
  "bio": "",
  "profileImage": "",
  "profileImageOptimized": "",
  "transactionHash": "0x71b487f420c54cd085a4577553e437ad5337460909f07ee5bd339adcf6a297ed"
}

── 4. TIMESTAMP ANALYSIS ─────────────────────────────────────────────
  Valid timestamps: 3000 / 3000
  Earliest trade: 2026-01-11T00:20:34.000Z (1768090834000)
  Latest trade:   2026-03-29T04:18:42.000Z (1774757922000)
  Span: 77.17 days (1852.0 hours)
  Trades per day: 38.9
  Trades per hour: 1.6
  Active UTC hours (across all data): 20/24
  Hour distribution: 00h=526, 01h=544, 02h=510, 03h=368, 04h=216, 05h=62, 06h=5, 11h=1, 12h=1, 13h=5, 14h=7, 15h=31, 16h=31, 17h=24, 18h=44, 19h=62, 20h=87, 21h=117, 22h=114, 23h=245
  First 5 timestamps: 2026-01-11T00:20:34.000Z, 2026-01-11T00:37:12.000Z, 2026-01-11T00:42:08.000Z, 2026-01-11T00:45:48.000Z, 2026-01-11T00:46:12.000Z
  Last 5 timestamps:  2026-03-29T03:19:12.000Z, 2026-03-29T03:38:44.000Z, 2026-03-29T03:42:24.000Z, 2026-03-29T04:10:02.000Z, 2026-03-29T04:18:42.000Z

── 5. FACTOR SCORES ──────────────────────────────────────────────────
  Trade Frequency (15%)        score= 55  contrib= 8.3  | 38.9 trades/day over 77.2 days
  Timing Pattern (30%)         score= 75  contrib=22.5  | 6.8/24 active hrs/day · 5.7 trades/active-hr
  Win Rate (15%)               score= 50  contrib= 7.5  | Not enough resolved pairs
  Size Uniformity (15%)        score= 10  contrib= 1.5  | CV=4.609, mean=$10381.87, stddev=$47848.78
  Holding Duration (15%)       score= 30  contrib= 4.5  | avg hold 9.4hr (4 pairs)
  Market Focus (10%)           score= 50  contrib= 5.0  | 0% crypto, 100% sports, 0% politics

  Weighted average: 49
  No override rules triggered.

  FINAL SCORE: 49 → Uncertain

── 6. DIAGNOSIS ──────────────────────────────────────────────────────
  ⚠ LOW timing score (75): only 6.8 active hrs/day
    dayHourSlots=465, uniqueDays=68
    If uniqueDays=1, ALL trades happened in 1 calendar day → normal to have <24 hr slots
    If slots is very low, check whether timestamps are valid (year/month correct?)

======================================================================
WALLET: beachboy4 — 0xc2e7800b5af46e6093872b177b7a5e7f0563be51
======================================================================

── 1. FETCHING TRADES ────────────────────────────────────────────────
  Total fetched: 1100 trades

── 2. RAW TRADE STRUCTURE (first object) ─────────────────────────────
  Keys: asset, bio, conditionId, eventSlug, icon, name, outcome, outcomeIndex, price, profileImage, profileImageOptimized, proxyWallet, pseudonym, side, size, slug, timestamp, title, transactionHash
  Timestamp field: timestamp
  Raw timestamp value: 1774319437 (type: number)
  As date (direct): 1970-01-21T12:51:59.437Z
  As date (*1000): 2026-03-24T02:30:37.000Z
  Side: BUY | Size: 12089.24 | Price: 0.5223051821289014
  Title: Spread: Clippers (-13.5)

── 3. FULL FIRST TRADE OBJECT ────────────────────────────────────────
{
  "proxyWallet": "0xc2e7800b5af46e6093872b177b7a5e7f0563be51",
  "side": "BUY",
  "asset": "93773135074282792587196364633002696859457046906806246867401563225985120743951",
  "conditionId": "0x3542af940109206ebcd82861e2b7c868b122ca7315bec174877f95e85cfcd755",
  "size": 12089.24,
  "price": 0.5223051821289014,
  "timestamp": 1774319437,
  "title": "Spread: Clippers (-13.5)",
  "slug": "nba-mil-lac-2026-03-23-spread-home-13pt5",
  "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/super+cool+basketball+in+red+and+blue+wow.png",
  "eventSlug": "nba-mil-lac-2026-03-23",
  "outcome": "Bucks",
  "outcomeIndex": 1,
  "name": "beachboy4",
  "pseudonym": "Threadbare-Skunk",
  "bio": "",
  "profileImage": "",
  "profileImageOptimized": "",
  "transactionHash": "0x5ba393fcb05f5ff838777b72c08b4cde734da306fa4604aeb05377815dab3ad5"
}

── 4. TIMESTAMP ANALYSIS ─────────────────────────────────────────────
  Valid timestamps: 1100 / 1100
  Earliest trade: 2025-11-30T22:46:06.000Z (1764542766000)
  Latest trade:   2026-03-24T02:30:37.000Z (1774319437000)
  Span: 113.16 days (2715.7 hours)
  Trades per day: 9.7
  Trades per hour: 0.4
  Active UTC hours (across all data): 15/24
  Hour distribution: 00h=87, 01h=71, 02h=72, 03h=20, 13h=5, 14h=60, 15h=34, 16h=45, 17h=132, 18h=48, 19h=250, 20h=63, 21h=40, 22h=41, 23h=132
  First 5 timestamps: 2025-11-30T22:46:06.000Z, 2025-11-30T22:47:28.000Z, 2025-11-30T22:48:22.000Z, 2025-11-30T22:52:24.000Z, 2025-11-30T22:53:38.000Z
  Last 5 timestamps:  2026-03-24T02:27:01.000Z, 2026-03-24T02:28:41.000Z, 2026-03-24T02:28:51.000Z, 2026-03-24T02:29:35.000Z, 2026-03-24T02:30:37.000Z

── 5. FACTOR SCORES ──────────────────────────────────────────────────
  Trade Frequency (15%)        score= 30  contrib= 4.5  | 9.7 trades/day over 113.2 days
  Timing Pattern (30%)         score= 35  contrib=10.5  | 2.2/24 active hrs/day · 4.4 trades/active-hr
  Win Rate (15%)               score= 50  contrib= 7.5  | Not enough resolved pairs
  Size Uniformity (15%)        score= 10  contrib= 1.5  | CV=1.815, mean=$171684.26, stddev=$311670.25
  Holding Duration (15%)       score= 95  contrib=14.3  | avg hold 2min (3 pairs)
  Market Focus (10%)           score= 50  contrib= 5.0  | 0% crypto, 100% sports, 0% politics

  Weighted average: 43
  No override rules triggered.

  FINAL SCORE: 43 → Uncertain

── 6. DIAGNOSIS ──────────────────────────────────────────────────────
  ⚠ LOW timing score (35): only 2.2 active hrs/day
    dayHourSlots=134, uniqueDays=61
    If uniqueDays=1, ALL trades happened in 1 calendar day → normal to have <24 hr slots
    If slots is very low, check whether timestamps are valid (year/month correct?)

======================================================================
WALLET: FeatherLeather — 0xd25c72ac0928385610611c8148803dc717334d20
======================================================================

── 1. FETCHING TRADES ────────────────────────────────────────────────
  Total fetched: 113 trades

── 2. RAW TRADE STRUCTURE (first object) ─────────────────────────────
  Keys: asset, bio, conditionId, eventSlug, icon, name, outcome, outcomeIndex, price, profileImage, profileImageOptimized, proxyWallet, pseudonym, side, size, slug, timestamp, title, transactionHash
  Timestamp field: timestamp
  Raw timestamp value: 1770474533 (type: number)
  As date (direct): 1970-01-21T11:47:54.533Z
  As date (*1000): 2026-02-07T14:28:53.000Z
  Side: BUY | Size: 4398.15 | Price: 0.44
  Title: Will BV Borussia 09 Dortmund win on 2026-02-07?

── 3. FULL FIRST TRADE OBJECT ────────────────────────────────────────
{
  "proxyWallet": "0xd25c72ac0928385610611c8148803dc717334d20",
  "side": "BUY",
  "asset": "81997972157814223509727927373244385823045752373766415351009297409490556699018",
  "conditionId": "0xd03cf5ee38ce116533fdcdc827ac7953ed101af802127ce9201c906309144ecb",
  "size": 4398.15,
  "price": 0.44,
  "timestamp": 1770474533,
  "title": "Will BV Borussia 09 Dortmund win on 2026-02-07?",
  "slug": "bun-wol-dor-2026-02-07-dor",
  "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/league-bun.jpg",
  "eventSlug": "bun-wol-dor-2026-02-07",
  "outcome": "No",
  "outcomeIndex": 1,
  "name": "FeatherLeather",
  "pseudonym": "Icky-Victory",
  "bio": "",
  "profileImage": "",
  "profileImageOptimized": "",
  "transactionHash": "0xcdbf1a85f41c9789185babdf910ebf144d38eef2f984242f482e7b9260392e50"
}

── 4. TIMESTAMP ANALYSIS ─────────────────────────────────────────────
  Valid timestamps: 113 / 113
  Earliest trade: 2026-01-29T19:28:28.000Z (1769714908000)
  Latest trade:   2026-02-07T14:28:53.000Z (1770474533000)
  Span: 8.79 days (211.0 hours)
  Trades per day: 12.9
  Trades per hour: 0.5
  Active UTC hours (across all data): 6/24
  Hour distribution: 13h=5, 14h=10, 17h=16, 18h=2, 19h=79, 20h=1
  First 5 timestamps: 2026-01-29T19:28:28.000Z, 2026-01-29T19:29:56.000Z, 2026-01-29T19:30:56.000Z, 2026-01-29T19:31:12.000Z, 2026-01-29T19:31:16.000Z
  Last 5 timestamps:  2026-02-07T14:11:43.000Z, 2026-02-07T14:13:25.000Z, 2026-02-07T14:17:31.000Z, 2026-02-07T14:18:17.000Z, 2026-02-07T14:28:53.000Z

── 5. FACTOR SCORES ──────────────────────────────────────────────────
  Trade Frequency (15%)        score= 30  contrib= 4.5  | 12.9 trades/day over 8.8 days
  Timing Pattern (30%)         score= 60  contrib=18.0  | 1.8/24 active hrs/day · 7.1 trades/active-hr
  Win Rate (15%)               score= 50  contrib= 7.5  | Not enough resolved pairs
  Size Uniformity (15%)        score= 10  contrib= 1.5  | CV=1.850, mean=$40198.56, stddev=$74370.07
  Holding Duration (15%)       score= 50  contrib= 7.5  | No resolved buy→sell pairs
  Market Focus (10%)           score= 50  contrib= 5.0  | 0% crypto, 100% sports, 0% politics

  Weighted average: 44
  No override rules triggered.

  FINAL SCORE: 44 → Uncertain

── 6. DIAGNOSIS ──────────────────────────────────────────────────────
  ⚠ LOW timing score (60): only 1.8 active hrs/day
    dayHourSlots=9, uniqueDays=5
    If uniqueDays=1, ALL trades happened in 1 calendar day → normal to have <24 hr slots
    If slots is very low, check whether timestamps are valid (year/month correct?)

======================================================================
WALLET: DrPufferfish — 0xdb27bf2ac5d428a9c63dbc914611036855a6c56e
======================================================================

── 1. FETCHING TRADES ────────────────────────────────────────────────
  Total fetched: 1052 trades

── 2. RAW TRADE STRUCTURE (first object) ─────────────────────────────
  Keys: asset, bio, conditionId, eventSlug, icon, name, outcome, outcomeIndex, price, profileImage, profileImageOptimized, proxyWallet, pseudonym, side, size, slug, timestamp, title, transactionHash
  Timestamp field: timestamp
  Raw timestamp value: 1774473913 (type: number)
  As date (direct): 1970-01-21T12:54:33.913Z
  As date (*1000): 2026-03-25T21:25:13.000Z
  Side: BUY | Size: 3025.93 | Price: 0.44
  Title: Thunder vs. Celtics

── 3. FULL FIRST TRADE OBJECT ────────────────────────────────────────
{
  "proxyWallet": "0xdb27bf2ac5d428a9c63dbc914611036855a6c56e",
  "side": "BUY",
  "asset": "12160776981609763533501553797509574492383854838127183751971345302533107597107",
  "conditionId": "0xae0bacd8397c67269daea66181ae83fdb39c522616db9d93f69e63eadc975daa",
  "size": 3025.93,
  "price": 0.44,
  "timestamp": 1774473913,
  "title": "Thunder vs. Celtics",
  "slug": "nba-okc-bos-2026-03-25",
  "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/super+cool+basketball+in+red+and+blue+wow.png",
  "eventSlug": "nba-okc-bos-2026-03-25",
  "outcome": "Celtics",
  "outcomeIndex": 1,
  "name": "DrPufferfish",
  "pseudonym": "Extraneous-Twine",
  "bio": "",
  "profileImage": "",
  "profileImageOptimized": "",
  "transactionHash": "0x9ffe8f718b1a7aa0f47c0b69825c268bb345b9c6fccb3f029d3a7c3c7e6c0285"
}

── 4. TIMESTAMP ANALYSIS ─────────────────────────────────────────────
  Valid timestamps: 1052 / 1052
  Earliest trade: 2025-05-30T16:00:09.000Z (1748620809000)
  Latest trade:   2026-03-25T21:25:13.000Z (1774473913000)
  Span: 299.23 days (7181.4 hours)
  Trades per day: 3.5
  Trades per hour: 0.1
  Active UTC hours (across all data): 20/24
  Hour distribution: 00h=114, 01h=52, 02h=34, 03h=27, 04h=4, 05h=8, 09h=1, 11h=1, 12h=10, 13h=20, 14h=41, 15h=31, 16h=72, 17h=104, 18h=90, 19h=100, 20h=49, 21h=62, 22h=108, 23h=124
  First 5 timestamps: 2025-05-30T16:00:09.000Z, 2025-05-30T16:22:05.000Z, 2025-05-30T16:26:45.000Z, 2025-05-30T16:29:15.000Z, 2025-05-30T16:31:17.000Z
  Last 5 timestamps:  2026-03-24T00:35:05.000Z, 2026-03-24T00:35:59.000Z, 2026-03-24T01:07:33.000Z, 2026-03-24T13:59:13.000Z, 2026-03-25T21:25:13.000Z

── 5. FACTOR SCORES ──────────────────────────────────────────────────
  Trade Frequency (15%)        score= 10  contrib= 1.5  | 3.5 trades/day over 299.2 days
  Timing Pattern (30%)         score= 15  contrib= 4.5  | 3.3/24 active hrs/day · 1.1 trades/active-hr
  Win Rate (15%)               score= 15  contrib= 2.3  | 30% win rate (7W / 16L)
  Size Uniformity (15%)        score= 10  contrib= 1.5  | CV=1.854, mean=$37166.42, stddev=$68889.21
  Holding Duration (15%)       score= 30  contrib= 4.5  | avg hold 11.2hr (23 pairs)
  Market Focus (10%)           score= 50  contrib= 5.0  | 0% crypto, 99% sports, 0% politics

  Weighted average: 19
  No override rules triggered.

  FINAL SCORE: 19 → Likely Human

── 6. DIAGNOSIS ──────────────────────────────────────────────────────
  ⚠ LOW timing score (15): only 3.3 active hrs/day
    dayHourSlots=479, uniqueDays=144
    If uniqueDays=1, ALL trades happened in 1 calendar day → normal to have <24 hr slots
    If slots is very low, check whether timestamps are valid (year/month correct?)
  ⚠ LOW frequency score (10): only 3.5 trades/day
    This likely means the API is returning trades spread over a very long time span
    OR the address has genuinely low activity