# CATEGORY_AUDIT.md — Market Category Detection Analysis

## Summary

There are **two separate category detection implementations** in the codebase. They use different regexes and produce different results for the same market title.

---

## Implementation 1: `getMarketCategory(market)` — `src/utils/api.js:538`

**Signature**: Takes a market object with `.category`, `.question`, `.title` fields.

**Used by**:
- `src/components/wallet/MarketCategoryBreakdown.jsx:8` — "Markets Traded by Category" widget
- `src/utils/agentTrackerEngine.js:15` — Agent Tracker win-rate-by-category
- `src/utils/arbitrageScanner.js:74,101,163` — Scanner category labels
- `src/utils/crossPlatform.js:52` — Cross-platform comparison

**Sports detection**: Only checks title for `nba|nfl|nhl|mlb|mls|fifa|premier league|la liga|bundesliga|serie a|olympic|super bowl|world cup|championship|playoffs|ncaa|march madness|\bsport\b|tennis|golf|f1|formula 1|ufc|boxing|wrestling`

**Missing**: No slug check. Does NOT detect:
- "Jazz vs. Suns: O/U 233.5" → classified as **"Other"** (should be Sports)
- "Capitals vs. Golden Knights: O/U 6.5" → classified as **"Other"** (should be Sports)
- "Spread: Hawks (-14.5)" → classified as **"Other"** (should be Sports)
- "Will BV Borussia 09 Dortmund win on 2026-02-07?" → classified as **"Other"** (should be Sports)

---

## Implementation 2: `calcMarketFocus(trades)` — `src/utils/botScoring.js:341`

**Signature**: Takes trades array, runs its own inline regex per trade title.

**Used by**: Bot scoring only.

**Sports detection**: `nba|nfl|nhl|mlb|premier league|la liga|bundesliga|serie a|champions league|will .+ win|spread:|total:|moneyline|over\/under|\bo\/u\b|vs\.|game \d|\bseries\b|playoff|championship game|super bowl|world cup`

**Better than Implementation 1** — detects `vs.`, `spread:`, `O/U` patterns. But still doesn't use slugs.

---

## Inconsistency Example

For the title **"Jazz vs. Suns: O/U 233.5"** (slug: `nba-uta-phx-2026-03-28-total-233pt5`):

| Implementation | Category | Why |
|---|---|---|
| `getMarketCategory` (api.js) | **Other** | No `vs.`, `O/U`, or NBA slug check |
| `calcMarketFocus` (botScoring.js) | **Sports** | `vs\.` pattern matches |

This is why the "Markets Traded by Category" pie chart shows 0% Sports for Polybotalpha while the bot scoring correctly detects 100% sports.

---

## Fix Applied

1. Improved `getMarketCategory` in `api.js` to:
   - Check `market.slug || market.eventSlug` prefix first (`nba-`, `nhl-`, `nfl-`, `mlb-`, `bun-`, etc.)
   - Added title patterns: `vs.`, `o/u \d`, `spread:`, `total:`, `will .+ win on \d{4}`

2. Updated `calcMarketFocus` in `botScoring.js` to import and use the unified `getMarketCategory`

---

## All Files With Category Logic (post-fix)

| File | Usage |
|---|---|
| `src/utils/api.js` | **Single source of truth** — `getMarketCategory(market)` |
| `src/utils/botScoring.js` | Imports `getMarketCategory` from api.js |
| `src/utils/agentTrackerEngine.js` | Imports `getMarketCategory` from api.js |
| `src/utils/arbitrageScanner.js` | Imports `getMarketCategory` from api.js |
| `src/utils/crossPlatform.js` | Imports `getMarketCategory` from api.js |
| `src/components/wallet/MarketCategoryBreakdown.jsx` | Imports `getMarketCategory` from api.js |
