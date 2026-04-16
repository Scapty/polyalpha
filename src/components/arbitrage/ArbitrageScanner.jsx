import React, { useState } from "react";
import GlowingInput from "../shared/GlowingInput";
import SpotlightCard from "../shared/SpotlightCard";
import ProPaywall from "../shared/ProPaywall";
import PricingModal from "../shared/PricingModal";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
function getApiKey() { return localStorage.getItem("polyalpha_api_key") || ""; }

const norm = (s) => s.toLowerCase().replace(/[.\-']/g, "").replace(/\s+/g, " ").trim();

// Levenshtein distance for fuzzy word matching
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

// Check if two words are fuzzy-similar (e.g. "munich" vs "munchen")
function fuzzyWordMatch(a, b) {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 2) return a === b;
  const threshold = maxLen <= 5 ? 1 : Math.floor(maxLen * 0.3);
  return levenshtein(a, b) <= threshold;
}

export default function ArbitrageScanner({ plan = "free", setPlan }) {
  const [url, setUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchStep, setSearchStep] = useState("");
  const [result, setResult] = useState(null);
  const [showPricing, setShowPricing] = useState(false);

  const isPro = plan === "pro" || plan === "elite";
  const isElite = plan === "elite";
  const [error, setError] = useState(null);

  function checkFreeLimit() {
    if (isPro) return true;
    const key = "dexio_oddz_daily";
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "{}");
      const today = new Date().toISOString().slice(0, 10);
      if (stored.date === today && stored.count >= 1) return false;
      return true;
    } catch { return true; }
  }

  function incrementFreeUsage() {
    if (isPro) return;
    const key = "dexio_oddz_daily";
    const today = new Date().toISOString().slice(0, 10);
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "{}");
      if (stored.date === today) {
        stored.count = (stored.count || 0) + 1;
      } else {
        stored.date = today;
        stored.count = 1;
      }
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {}
  }

  function detectPlatform(input) {
    const lower = input.trim().toLowerCase();
    if (lower.includes("polymarket.com")) return "polymarket";
    if (lower.includes("kalshi.com")) return "kalshi";
    return null;
  }

  function extractPolySlug(input) {
    const m = input.match(/polymarket\.com\/event\/([^/?#]+)/i);
    if (m) return m[1];
    const m2 = input.match(/polymarket\.com\/markets\/([^/?#]+)/i);
    if (m2) return m2[1];
    return null;
  }

  function extractKalshiTicker(input) {
    const m = input.match(/kalshi\.com\/markets\/([^?#]+)/i);
    if (!m) return null;
    // URL path: /series/subtitle/event-ticker — take the last non-empty segment
    const segments = m[1].split("/").filter(Boolean);
    return segments[segments.length - 1].toUpperCase();
  }

  const handleSearch = async () => {
    if (!url.trim()) return;
    if (!checkFreeLimit()) {
      setError("Free plan: 1 analysis per day. Upgrade to Pro for unlimited analyses.");
      setShowPricing(true);
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) { setError("Set your Anthropic API key first."); return; }
    const platform = detectPlatform(url);
    if (!platform) { setError("Paste a Polymarket or Kalshi URL."); return; }

    setSearching(true);
    setError(null);
    setResult(null);

    try {
      const otherPlatform = platform === "polymarket" ? "Kalshi" : "Polymarket";

      setSearchStep("Fetching market data...");
      let sourceData = null;

      if (platform === "polymarket") {
        const slug = extractPolySlug(url);
        if (!slug) { setError("Could not extract slug from URL."); return; }
        sourceData = await fetchPolymarketAll(slug);
      } else {
        const ticker = extractKalshiTicker(url);
        if (!ticker) { setError("Could not extract ticker from URL."); return; }
        sourceData = await fetchKalshiAll(ticker);
      }
      if (!sourceData) { setError("Could not fetch market data. Check the URL."); return; }

      // ── Step 1: try direct title → slug lookup (no AI needed) ──────────────
      const MONTH_EXPAND = {
        jan: "january", feb: "february", mar: "march", apr: "april",
        may: "may",     jun: "june",     jul: "july",  aug: "august",
        sep: "september", oct: "october", nov: "november", dec: "december",
      };

      function normalizeTitle(title) {
        // Expand abbreviated months: "Apr 2026" → "April"  (drop year)
        let t = title.replace(
          /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\b/gi,
          (_, mon) => MONTH_EXPAND[mon.toLowerCase()]
        );
        // Also expand bare abbreviations without year: "Apr" → "April"
        t = t.replace(
          /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b(?!\w)/gi,
          (_, mon) => MONTH_EXPAND[mon.toLowerCase()]
        );
        return t;
      }

      function titleToPolySlug(title) {
        return normalizeTitle(title)
          .toLowerCase()
          .trim()
          .replace(/\?+$/, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-");
      }

      let otherData = null;
      let aiResult = null;

      if (otherPlatform === "Polymarket") {
        setSearchStep("Looking up on Polymarket...");
        const directSlug = titleToPolySlug(sourceData.eventTitle);
        const directData = await fetchPolymarketAll(directSlug).catch(() => null);
        if (directData) {
          otherData = directData;
          aiResult = {
            found: true,
            matchQuality: "exact",
            explanation: `Direct match found on Polymarket via title lookup.`,
            slug: directSlug,
            url: `https://polymarket.com/event/${directSlug}`,
            title: directData.eventTitle,
          };
        }
      }

      // ── Step 2: AI web search fallback if direct lookup failed ───────────────
      if (!aiResult) {
        setSearchStep(`AI finding match on ${otherPlatform}...`);
        const srcEndDate = sourceData.endDate
          ? new Date(sourceData.endDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          : null;

        // Build a human-readable description for Claude's search
        const titleIsReadable = sourceData.eventTitle && !/^[A-Z0-9-]+$/.test(sourceData.eventTitle);
        const outcomeNames = sourceData.outcomes.slice(0, 10).map(o => o.title).join(", ");
        const resolutionHint = sourceData.resolutionDetails
          ? sourceData.resolutionDetails.slice(0, 300)
          : "";

        // Construct search query — use the readable title, or outcomes + resolution if title is a ticker
        const searchQuery = titleIsReadable
          ? sourceData.eventTitle
          : outcomeNames.length > 3
            ? outcomeNames
            : resolutionHint.split(/[.!?]/)[0] || sourceData.eventTitle;

        aiResult = await claudeCall(apiKey, `Find the equivalent prediction market on ${otherPlatform}.

Source: ${platform === "polymarket" ? "Polymarket" : "Kalshi"}
Title: "${sourceData.eventTitle}"
${!titleIsReadable ? `NOTE: The title above is a platform ticker/ID, NOT a human-readable name. Use the outcomes and resolution details below to understand what this market is about.` : ""}
Outcomes: ${outcomeNames}
${srcEndDate ? `End date: ${srcEndDate}` : ""}
${resolutionHint ? `Resolution rules: ${resolutionHint}` : ""}

Search: site:${otherPlatform === "Kalshi" ? "kalshi.com" : "polymarket.com"} ${searchQuery}

IMPORTANT: Extract the ticker/slug from the URL you find.
${otherPlatform === "Kalshi"
  ? `Kalshi URLs have this format: kalshi.com/markets/SERIES-TICKER/EVENT-SUBTITLE/MARKET
Extract the FULL event ticker (e.g., KXUCLGAME-26APR07RMABMU, not just KXUCLGAME).
The event ticker includes the date and team codes. Return it as "eventTicker".
Also return the series ticker (e.g., KXUCLGAME) as "seriesTicker".`
  : "Polymarket URLs: polymarket.com/event/SLUG → extract SLUG"}

MATCHING RULES:
- "exact": Same event, same outcome, same timeframe
- "similar": Same event, slightly different deadline (up to ~1 month)
- "none": Different event, different timeframe, or unrelated

Respond ONLY in valid JSON:
{
  "found": true or false,
  "title": "title on ${otherPlatform}",
  ${otherPlatform === "Kalshi" ? '"eventTicker": "full event ticker with date (e.g. KXUCLGAME-26APR07RMABMU)",\n  "seriesTicker": "series ticker (e.g. KXUCLGAME)"' : '"slug": "extracted from URL"'},
  "url": "full URL",
  "matchQuality": "exact or similar or none",
  "explanation": "1-2 sentences"
}`, 800, true);

        if (aiResult.found && !otherData) {
          setSearchStep(`Fetching ${otherPlatform} prices...`);
          let ticker = aiResult.eventTicker || aiResult.seriesTicker || null;
          let slug = aiResult.slug || null;
          if (!ticker && !slug && aiResult.url) {
            if (otherPlatform === "Kalshi") {
              const m = aiResult.url.match(/kalshi\.com\/markets\/([^?#]+)/i);
              if (m) {
                const segs = m[1].split("/").filter(Boolean);
                ticker = segs[segs.length - 1].toUpperCase();
              }
            } else {
              const m = aiResult.url.match(/polymarket\.com\/event\/([^/?#]+)/i);
              if (m) slug = m[1];
            }
          }
          try {
            if (otherPlatform === "Kalshi" && ticker) otherData = await fetchKalshiAll(ticker);
            else if (otherPlatform === "Polymarket" && slug) otherData = await fetchPolymarketAll(slug);
          } catch (fetchErr) {
            console.warn(`Could not fetch ${otherPlatform} data for ${ticker || slug}:`, fetchErr.message);
            otherData = null;
          }
        }
      }

      if (aiResult.found && !otherData) {
        setResult({
          found: false,
          explanation: `This market doesn't appear to exist on ${otherPlatform}. AI found a potential match but no live market data was available.`,
          sourceData,
          sourcePlatform: platform,
          sourceUrl: url,
        });
        return;
      }

      const polyData = platform === "polymarket" ? sourceData : otherData;
      const kalshiData = platform === "kalshi" ? sourceData : otherData;
      const matched = matchOutcomes(polyData?.outcomes || [], kalshiData?.outcomes || []);

      setSearchStep("Building analysis...");
      const analysis = await buildAnalysisFromData(apiKey, polyData, kalshiData, aiResult.matchQuality, matched);

      // Count as a successful analysis (uses free daily limit)
      if (aiResult.found) incrementFreeUsage();

      setResult({
        found: aiResult.found,
        matchQuality: aiResult.matchQuality,
        explanation: aiResult.explanation,
        analysis,
        polymarket: { title: polyData?.eventTitle || "", url: platform === "polymarket" ? url : aiResult.url, volume24h: polyData?.volume24h, volumeTotal: polyData?.volumeTotal },
        kalshi: { title: kalshiData?.eventTitle || "", url: platform === "kalshi" ? url : aiResult.url, volume24h: kalshiData?.volume24h, volumeTotal: kalshiData?.volumeTotal, endDate: kalshiData?.endDate },
        matchedOutcomes: matched,
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
      setSearchStep("");
    }
  };

  function matchOutcomes(polyOutcomes, kalshiOutcomes) {
    const results = [];
    const usedKalshi = new Set();

    const activePoly = polyOutcomes.filter((o) => !o.expired);
    const activeKalshi = kalshiOutcomes.filter((o) => !o.expired);
    const polyToUse = activePoly.length > 0 ? activePoly : polyOutcomes;
    const kalshiToUse = activeKalshi.length > 0 ? activeKalshi : kalshiOutcomes;

    for (const po of polyToUse) {
      const poNorm = norm(po.title);
      const poWords = poNorm.split(" ").filter(w => w.length > 1);

      let bestMatch = null, bestScore = 0;
      for (let i = 0; i < kalshiToUse.length; i++) {
        if (usedKalshi.has(i)) continue;
        const ko = kalshiToUse[i];
        const koNorm = norm(ko.title);

        let nameScore = 0;
        const koWords = koNorm.split(" ").filter(w => w.length > 1);
        if (koNorm === poNorm) nameScore = 100;
        else if (koNorm.includes(poNorm) || poNorm.includes(koNorm)) nameScore = 80;
        else if (koNorm.startsWith(poNorm) || poNorm.startsWith(koNorm)) nameScore = 70;
        else {
          // Fuzzy word matching: "munich" ~ "munchen", "fc bayern" ~ "bayern"
          const fuzzyHits = poWords.filter(pw =>
            koWords.some(kw => fuzzyWordMatch(pw, kw))
          ).length;
          const reverseHits = koWords.filter(kw =>
            poWords.some(pw => fuzzyWordMatch(kw, pw))
          ).length;
          // Use best ratio from either direction (handles "FC Bayern München" vs "Bayern Munich")
          const forwardRatio = poWords.length > 0 ? fuzzyHits / poWords.length : 0;
          const reverseRatio = koWords.length > 0 ? reverseHits / koWords.length : 0;
          nameScore = Math.max(forwardRatio, reverseRatio) * 60;
        }

        let dateBonus = 0;
        if (po.endDate && ko.endDate) {
          const pDate = new Date(po.endDate);
          const kDate = new Date(ko.endDate);
          const daysDiff = Math.abs((pDate - kDate) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 3) dateBonus = 15;
          else if (daysDiff <= 14) dateBonus = 10;
          else if (daysDiff <= 60) dateBonus = 5;
          if (daysDiff > 180) dateBonus = -20;
        }

        const totalScore = nameScore + dateBonus;
        if (totalScore > bestScore) { bestScore = totalScore; bestMatch = { idx: i, outcome: ko, score: totalScore }; }
      }

      if (bestMatch && bestMatch.score >= 30) {
        usedKalshi.add(bestMatch.idx);
        results.push({ poly: po, kalshi: bestMatch.outcome, matchScore: bestMatch.score });
      } else {
        results.push({ poly: po, kalshi: null, matchScore: 0 });
      }
    }

    for (let i = 0; i < kalshiOutcomes.length; i++) {
      if (!usedKalshi.has(i)) {
        results.push({ poly: null, kalshi: kalshiOutcomes[i], matchScore: 0 });
      }
    }

    return results.sort((a, b) => {
      const aMatched = a.poly && a.kalshi ? 1 : 0;
      const bMatched = b.poly && b.kalshi ? 1 : 0;
      if (aMatched !== bMatched) return bMatched - aMatched;
      const aPrice = parseFloat(a.poly?.yes || a.kalshi?.yesAsk || "0");
      const bPrice = parseFloat(b.poly?.yes || b.kalshi?.yesAsk || "0");
      return bPrice - aPrice;
    });
  }

  async function fetchPolymarketAll(slug) {
    // /events/slug/{slug} is the correct path-param endpoint (not query param ?slug=)
    const res = await fetch(`/api/events/slug/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
    const data = await res.json();
    // /events/slug/{slug} returns a single event object, not an array
    const events = Array.isArray(data) ? data : [data];
    if (!events.length || !events[0]?.markets) return null;
    const ev = events[0];
    const markets = ev.markets || [];
    const volume24h = parseFloat(ev.volume24hr) || markets.reduce((s, m) => s + (parseFloat(m.volume24hr) || 0), 0);
    const volumeTotal = parseFloat(ev.volume) || markets.reduce((s, m) => s + (parseFloat(m.volume) || 0), 0);
    const firstMarket = markets[0] || {};
    const description = firstMarket.description || ev.description || "";
    const endDate = firstMarket.endDate || ev.endDate || "";
    return {
      eventTitle: ev.title,
      volume24h, volumeTotal,
      resolutionDetails: description,
      endDate,
      outcomes: markets.filter(m => m.outcomePrices && m.outcomePrices !== "[]").map((m) => {
        let y = 0, n = 0;
        try {
          const p = JSON.parse(m.outcomePrices || "[]");
          y = parseFloat(p[0]) || 0;
          n = p.length >= 2 ? (parseFloat(p[1]) || 0) : (1 - y);
        } catch {}
        const mEndDate = m.endDate || ev.endDate || "";
        const isClosed = m.closed === true || m.active === false;
        const hasActivePrice = y > 0 && y < 1;
        const isExpired = isClosed || (!hasActivePrice && mEndDate && new Date(mEndDate) < new Date());
        return {
          title: m.groupItemTitle || m.question || "",
          yes: (y * 100).toFixed(1),
          no: (n * 100).toFixed(1),
          endDate: mEndDate,
          expired: isExpired,
        };
      }),
    };
  }

  async function fetchKalshiAll(seriesOrEventTicker) {
    // Determine if this is an event ticker (has date suffix like -26APR) or a series ticker
    const isEventTicker = /[A-Z]+-\d{2}[A-Z]{3}$|[A-Z]+-\d+$/.test(seriesOrEventTicker);
    // Extract series ticker = everything before the last dash segment (e.g. KXFEDDECISION from KXFEDDECISION-26APR)
    const seriesTicker = isEventTicker
      ? seriesOrEventTicker.replace(/-[^-]+$/, "")
      : seriesOrEventTicker;

    let res = await fetch(`/api/kalshi/markets?event_ticker=${seriesOrEventTicker}&limit=100`);
    let data = await res.json();
    let markets = data.markets || [];

    // If no markets found, treat as series ticker → fetch events → pick best matching event
    if (markets.length === 0) {
      const evRes = await fetch(`/api/kalshi/events?series_ticker=${seriesOrEventTicker}&status=open&limit=50`);
      const evData = await evRes.json();
      const events = evData.events || [];
      if (events.length > 0) {
        // Try to pick the event closest to today (most relevant upcoming event)
        const now = new Date();
        let bestEvent = events[0];
        let bestDiff = Infinity;
        for (const ev of events) {
          const closeTime = ev.close_time || ev.expiration_time || "";
          if (closeTime) {
            const diff = Math.abs(new Date(closeTime) - now);
            if (diff < bestDiff) { bestDiff = diff; bestEvent = ev; }
          }
        }
        res = await fetch(`/api/kalshi/markets?event_ticker=${bestEvent.event_ticker}&limit=100`);
        data = await res.json();
        markets = data.markets || [];
      }
    }
    if (!markets.length) return null;

    // Get event title — try multiple strategies since tickers don't describe the trade
    // IMPORTANT: prioritize the Events API (gives the broad event title like "Who will win...")
    // over market titles (which are outcome-specific like "Will Gabriel Attal win...")
    let eventTitle = seriesOrEventTicker; // worst-case fallback: the raw ticker

    // Strategy 1: Look up event by series ticker (best source — gives the broad event title)
    try {
      const evRes = await fetch(`/api/kalshi/events?series_ticker=${seriesTicker}&limit=100`);
      const evData = await evRes.json();
      const match = evData.events?.find(e => e.event_ticker === seriesOrEventTicker);
      if (match?.title) eventTitle = match.title;
      else if (evData.events?.[0]?.title) eventTitle = evData.events[0].title;
    } catch {}

    // Strategy 2: If still a ticker, try fetching by event_ticker directly
    if (/^[A-Z0-9-]+$/.test(eventTitle)) {
      try {
        const evRes = await fetch(`/api/kalshi/events?event_ticker=${seriesOrEventTicker}&limit=1`);
        const evData = await evRes.json();
        if (evData.events?.[0]?.title) eventTitle = evData.events[0].title;
      } catch {}
    }

    // Strategy 3: Use the event_title field from markets (NOT the market title — that's outcome-specific)
    if (/^[A-Z0-9-]+$/.test(eventTitle) && markets.length > 0) {
      const evTitle = markets[0]?.event_title;
      if (evTitle && evTitle.length > 5 && !/^[A-Z0-9-]+$/.test(evTitle)) {
        eventTitle = evTitle;
      }
    }

    // Strategy 4 (last resort): Use market title or rules if everything above failed
    if (/^[A-Z0-9-]+$/.test(eventTitle) && markets.length > 0) {
      const mTitle = markets[0]?.title || "";
      if (mTitle && mTitle.length > 5 && !/^[A-Z0-9-]+$/.test(mTitle)) {
        eventTitle = mTitle;
      } else {
        const rules = markets[0]?.rules_primary || "";
        const firstSentence = rules.split(/[.!?]/)[0]?.trim();
        if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
          eventTitle = firstSentence;
        }
      }
    }
    const volume24h = markets.reduce((s, m) => s + (parseFloat(m.volume_24h_fp) || 0), 0);
    const volumeTotal = markets.reduce((s, m) => s + (parseFloat(m.volume_fp) || 0), 0);
    const firstMarket = markets[0] || {};
    // Generalize rules: replace candidate-specific name with placeholder so AI understands
    // this is a multi-outcome market, not a binary bet on one candidate
    let rules = firstMarket.rules_primary || "";
    const firstOutcomeName = firstMarket.yes_sub_title || "";
    if (firstOutcomeName && markets.length > 1) {
      rules = rules.replaceAll(firstOutcomeName, "[each candidate]");
    }
    const expiration = firstMarket.expiration_time || firstMarket.close_time || "";
    return {
      eventTitle, volume24h, volumeTotal,
      resolutionDetails: rules,
      endDate: expiration,
      outcomes: markets.map((m) => {
        const exp = m.expiration_time || m.close_time || expiration || "";
        const hasActivePrice = parseFloat(m.yes_ask_dollars || 0) > 0 && parseFloat(m.yes_ask_dollars || 0) < 1;
        const isExpired = m.status === "closed" || (!hasActivePrice && exp && new Date(exp) < new Date());
        return {
          title: m.yes_sub_title || m.title || m.ticker,
          yesAsk: (parseFloat(m.yes_ask_dollars || 0) * 100).toFixed(1),
          yesBid: (parseFloat(m.yes_bid_dollars || 0) * 100).toFixed(1),
          noAsk: (parseFloat(m.no_ask_dollars || 0) * 100).toFixed(1),
          noBid: (parseFloat(m.no_bid_dollars || 0) * 100).toFixed(1),
          endDate: exp,
          expired: isExpired,
        };
      }),
    };
  }

  async function buildAnalysisFromData(apiKey, polyData, kalshiData, matchQuality, matchedOutcomes) {
    const polyRes = polyData?.resolutionDetails || "Not available";
    const polyEnd = polyData?.endDate || "Not available";
    const kalshiRes = kalshiData?.resolutionDetails || "Not available";
    const kalshiEnd = kalshiData?.endDate || "Not available";

    if (polyRes === "Not available" && kalshiRes === "Not available") {
      return {
        conditionsIdentical: matchQuality === "exact",
        deadlines: { polymarket: polyEnd, kalshi: kalshiEnd, comparison: "Resolution details not available from APIs." },
        resolution: { polymarket: "Not available", kalshi: "Not available", comparison: "Could not retrieve resolution criteria." },
      };
    }

    try {
      const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      const result = await claudeCall(apiKey, `You are comparing two prediction market bets. Today is ${today}.

Polymarket: "${polyData?.eventTitle || ""}"
Deadline: ${polyEnd}
Rules: ${polyRes.slice(0, 400)}

Kalshi: "${kalshiData?.eventTitle || ""}"
Deadline: ${kalshiEnd}
Rules: ${kalshiRes.slice(0, 400)}

IMPORTANT: Both platforms have MULTIPLE outcomes (candidates/teams). The rules shown are from ONE sub-market but the same resolution structure applies to ALL outcomes on each platform. Do NOT say Kalshi is "binary for one specific candidate" — both platforms offer bets on each candidate separately.

Rephrase the resolution criteria in your own words — do NOT copy raw rule text. Summarize the general resolution mechanism (e.g. "Resolves based on the official election result" not "Resolves to Yes only if [specific name]...").

Do NOT invent any numbers. Do NOT mention volume or liquidity.

Respond ONLY in valid JSON:
{
  "conditionsIdentical": true or false,
  "deadlines": {
    "polymarket": "deadline in plain english",
    "kalshi": "deadline in plain english",
    "comparison": "same deadline / X days apart / etc"
  },
  "resolution": {
    "polymarket": "how it resolves in 1 clean sentence",
    "kalshi": "how it resolves in 1 clean sentence",
    "comparison": "identical / or 1 sentence explaining the key difference"
  },
  "recommendation": "1-2 sentences. If identical: say conditions are the same, pick the platform with the best price for each outcome. If different: explain the key difference simply."
}`, 600);

      return result;
    } catch {
      return {
        conditionsIdentical: matchQuality === "exact",
        deadlines: { polymarket: polyEnd, kalshi: kalshiEnd, comparison: "Could not compare automatically." },
        resolution: { polymarket: "Check resolution rules on Polymarket.", kalshi: "Check resolution rules on Kalshi.", comparison: "Verify rules on both platforms before trading." },
        recommendation: "AI analysis unavailable. Please check resolution conditions manually on both platforms.",
      };
    }
  }

  async function claudeCall(apiKey, prompt, maxTokens, useWebSearch) {
    const body = { model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] };
    if (useWebSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }];
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("AI did not return valid JSON.");
    return JSON.parse(m[0]);
  }

  return (
    <div style={{ animation: "fadeInUp 0.4s var(--ease-smooth) both", maxWidth: 820, margin: "0 auto" }}>
      <div className="page-header">
        <div className="section-number">03</div>
        <h1>Odds Analyzer</h1>
        <p>Compare prediction market prices across platforms. Find arbitrage opportunities.</p>
      </div>

      {/* Warning */}
      <div style={{
        marginBottom: 24, padding: "16px 20px", borderRadius: 0,
        background: "var(--bg-deep)", border: "1px solid var(--border)", borderLeft: "2px solid var(--warning)",
        fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-body)",
      }}>
        <strong style={{ color: "var(--text-primary)" }}>Price differences usually reflect different resolution conditions</strong>: different deadlines, sources, or criteria.
        Always verify the resolution rules on both platforms before trading.
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
          Works best with popular markets (politics, sports). Some Polymarket bets may not exist on Kalshi. For best results, paste a Kalshi link — Polymarket has broader coverage, so matches are easier to find.
        </div>
      </div>

      {/* Input */}
      <SpotlightCard style={{
        background: "var(--bg-deep)",
        borderRadius: 0,
        padding: 24,
        marginBottom: 24,
      }}>
        <label style={labelStyle}>Market URL</label>
        <GlowingInput
          value={url}
          onChange={(v) => setUrl(v)}
          onSubmit={() => handleSearch()}
          loading={searching}
          placeholder="Paste a Polymarket or Kalshi link..."
          buttonText="Compare Prices"
          loadingText={searchStep || "Searching..."}
          style={{ marginBottom: 12 }}
        />
        {url.trim() && detectPlatform(url) && (
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {detectPlatform(url) === "polymarket" ? "Polymarket" : "Kalshi"} detected
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
              {"\u2192"} searching {detectPlatform(url) === "polymarket" ? "Kalshi" : "Polymarket"}
            </span>
          </div>
        )}
      </SpotlightCard>

      {/* Empty state — minimal */}
      {!result && !searching && !error && (
        <div style={{ textAlign: "center", padding: "20px 0", animation: "fadeInUp 0.4s ease both 0.15s" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-ghost)", letterSpacing: "0.02em" }}>
            Paste a market URL above to compare prices across platforms
          </p>
        </div>
      )}

      {error && <div style={errorStyle}>{error}</div>}

      {result && !result.found && (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: 24 }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4, fontFamily: "var(--font-display)" }}>No Match Found</p>
            <p style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-body)" }}>{result.explanation}</p>
          </div>
          {result.sourceData?.outcomes?.length > 0 && (
            <div style={{ padding: "0 24px 20px" }}>
              <div style={{ ...sLabel, marginBottom: 8, color: "var(--accent)" }}>
                {result.sourcePlatform === "polymarket" ? "Polymarket" : "Kalshi"}: {result.sourceData.eventTitle}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={{ ...thStyle, textAlign: "left" }}>Outcome</th><th style={thStyle}>YES</th></tr></thead>
                <tbody>
                  {result.sourceData.outcomes.slice(0, 10).map((o, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ ...tdStyle, fontWeight: 500, color: "var(--text-primary)" }}>{o.title}</td>
                      <td style={tdP}>{o.yes || o.yesAsk || "\u2014"}{"\u00A2"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.sourceUrl && (
                <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, marginTop: 12, display: "inline-flex" }}>
                  View on {result.sourcePlatform === "polymarket" ? "Polymarket" : "Kalshi"} {"\u2192"}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {result?.found && (
        <div style={cardStyle}>
          {/* Header */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
                padding: "3px 10px", borderRadius: 0, letterSpacing: "0.08em",
                background: result.matchQuality === "exact" ? "rgba(16,185,129,0.12)" : result.matchQuality === "similar" ? "rgba(245,158,11,0.12)" : "transparent",
                color: result.matchQuality === "exact" ? "var(--green)" : result.matchQuality === "similar" ? "var(--warning)" : "var(--text-muted)",
                textTransform: "uppercase",
                border: result.matchQuality === "exact" ? "none" : result.matchQuality === "similar" ? "none" : "1px solid var(--border)",
              }}>
                {result.matchQuality === "exact" ? "Exact" : result.matchQuality === "similar" ? "Similar" : "Related"}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                  {result.matchQuality === "exact" ? "Exact Match" : "Similar Match (Not Identical)"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-body)" }}>{result.explanation}</div>
              </div>
            </div>
            {result.matchQuality !== "exact" && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 0,
                background: "var(--bg-elevated)", borderLeft: "3px solid var(--warning)",
                fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-body)",
              }}>
                <strong style={{ color: "var(--text-primary)" }}>These bets are similar but NOT identical.</strong> Resolution conditions, deadlines or triggers may differ.
              </div>
            )}
          </div>

          {/* Market titles */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...sLabel, color: "var(--accent)" }}>Polymarket</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-body)" }}>{result.polymarket.title || "\u2014"}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...sLabel, color: "var(--text-muted)" }}>Kalshi</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-body)" }}>{result.kalshi.title || "\u2014"}</div>
            </div>
          </div>

          {/* All outcomes table */}
          <div style={{ padding: "20px 24px", overflowX: "auto" }}>
            <div style={{ ...sLabel, marginBottom: 12 }}>All Outcomes: Live Prices</div>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>Outcome</th>
                  <th colSpan={2} style={{ ...thStyle, color: "var(--accent)" }}>Polymarket</th>
                  <th colSpan={2} style={{ ...thStyle, color: "var(--text-muted)" }}>Kalshi</th>
                  <th style={thStyle}>Best YES</th>
                </tr>
                <tr>
                  <th style={{ ...thStyle, borderBottom: "1px solid var(--border)" }}></th>
                  <th style={{ ...thStyle, fontSize: 9, color: "var(--accent)", borderBottom: "1px solid var(--border)" }}>YES</th>
                  <th style={{ ...thStyle, fontSize: 9, color: "var(--text-ghost)", borderBottom: "1px solid var(--border)" }}>NO</th>
                  <th style={{ ...thStyle, fontSize: 9, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>YES</th>
                  <th style={{ ...thStyle, fontSize: 9, color: "var(--text-ghost)", borderBottom: "1px solid var(--border)" }}>NO</th>
                  <th style={{ ...thStyle, borderBottom: "1px solid var(--border)" }}></th>
                </tr>
              </thead>
              <tbody>
                {result.matchedOutcomes?.map((row, i) => {
                  const polyYes = parseFloat(row.poly?.yes) || 0;
                  const polyNo = parseFloat(row.poly?.no) || 0;
                  const kalshiYes = parseFloat(row.kalshi?.yesAsk) || 0;
                  const kalshiNo = parseFloat(row.kalshi?.noBid) || 0;
                  const best = !polyYes ? "kalshi" : !kalshiYes ? "poly" : polyYes < kalshiYes ? "poly" : kalshiYes < polyYes ? "kalshi" : "equal";

                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ ...tdStyle, maxWidth: 180 }}>
                        <div style={{ fontWeight: 500, fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)", fontFamily: "var(--font-body)" }}>
                          {row.poly?.title || row.kalshi?.title || "\u2014"}
                          {(row.poly?.expired || row.kalshi?.expired) && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 0, background: "rgba(239,68,68,0.12)", color: "var(--red)", fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>EXPIRED</span>
                          )}
                        </div>
                        {row.poly && row.kalshi && row.poly.title !== row.kalshi.title && (
                          <div style={{ fontSize: 10, color: "var(--text-ghost)", marginTop: 2, fontFamily: "var(--font-body)" }}>Kalshi: {row.kalshi.title}</div>
                        )}
                        {row.poly?.endDate && row.kalshi?.endDate && (
                          <div style={{ fontSize: 9, color: "var(--text-ghost)", marginTop: 1, fontFamily: "var(--font-mono)" }}>
                            {(() => {
                              const pD = new Date(row.poly.endDate);
                              const kD = new Date(row.kalshi.endDate);
                              const daysDiff = Math.round(Math.abs(pD - kD) / (1000 * 60 * 60 * 24));
                              return daysDiff > 3 ? `${daysDiff}d date gap` : null;
                            })()}
                          </div>
                        )}
                      </td>
                      <td style={tdP}>{row.poly ? <span>{row.poly.yes}{"\u00A2"}</span> : "\u2014"}</td>
                      <td style={{ ...tdP, color: "var(--text-ghost)" }}>{row.poly ? <span>{row.poly.no}{"\u00A2"}</span> : "\u2014"}</td>
                      <td style={tdP}>
                        {row.kalshi ? (
                          <div>
                            <span>{row.kalshi.yesAsk}{"\u00A2"}</span>
                            <div style={{ fontSize: 9, color: "var(--text-ghost)" }}>bid {row.kalshi.yesBid}{"\u00A2"}</div>
                          </div>
                        ) : "\u2014"}
                      </td>
                      <td style={{ ...tdP, color: "var(--text-ghost)" }}>
                        {row.kalshi ? (
                          <div>
                            <span>{row.kalshi.noAsk !== "0.0" ? row.kalshi.noAsk : "\u2014"}{row.kalshi.noAsk !== "0.0" ? "\u00A2" : ""}</span>
                            {row.kalshi.noBid !== "0.0" && row.kalshi.noBid !== row.kalshi.noAsk && (
                              <div style={{ fontSize: 9, color: "var(--text-ghost)" }}>bid {row.kalshi.noBid}{"\u00A2"}</div>
                            )}
                          </div>
                        ) : "\u2014"}
                      </td>
                      <td style={tdP}>
                        {best === "equal" || (!polyYes && !kalshiYes) ? <span style={{ color: "var(--text-ghost)", fontSize: 11 }}>{"\u2014"}</span> :
                         best === "poly" ? <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 11, fontFamily: "var(--font-mono)" }}>Poly</span> :
                         <span style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 11, fontFamily: "var(--font-mono)" }}>Kalshi</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Links */}
          <div style={{ padding: "0 24px 20px", display: "flex", gap: 10 }}>
            {result.polymarket.url && <a href={result.polymarket.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>Polymarket {"\u2192"}</a>}
            {result.kalshi.url && <a href={result.kalshi.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>Kalshi {"\u2192"}</a>}
          </div>

          {/* Arbitrage Education */}
          {result.matchedOutcomes?.length > 0 && (
            <ArbitrageEducation outcomes={result.matchedOutcomes} kalshiEndDate={result.kalshi?.endDate} conditionsDiffer={!result.analysis?.conditionsIdentical || result.matchQuality !== "exact"} />
          )}

          {/* AI Analysis */}
          {result.analysis && <AIAnalysis analysis={result.analysis} polyVol={result.polymarket} kalVol={result.kalshi} isExact={result.matchQuality === "exact"} />}

          <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-ghost)", textAlign: "center", fontFamily: "var(--font-body)" }}>
            Always verify resolution conditions before trading. Platforms may have different deadlines or criteria.
          </div>
        </div>
      )}


      {showPricing && (
        <PricingModal
          onClose={() => setShowPricing(false)}
          currentPlan={plan}
          onSelectPlan={(p) => { if (setPlan) setPlan(p); }}
        />
      )}
    </div>
  );
}

function ArbitrageEducation({ outcomes, kalshiEndDate, conditionsDiffer }) {
  const [open, setOpen] = useState(false);
  const [totalBudget, setTotalBudget] = useState("1000");

  // Find the best arbitrage pair across all matched outcomes
  let best = null;
  let bestEndDate = null;
  for (const row of outcomes) {
    if (!row.poly || !row.kalshi || row.poly.expired || row.kalshi.expired) continue;
    const polyYes = parseFloat(row.poly.yes) || 0;
    const polyNo = parseFloat(row.poly.no) || 0;
    const kalshiYes = parseFloat(row.kalshi.yesAsk) || 0;
    const kalshiNo = parseFloat(row.kalshi.noAsk) || parseFloat(row.kalshi.noBid) || 0;
    if (!polyYes || !kalshiYes || !kalshiNo) continue;

    const combo1 = polyYes + kalshiNo;
    const combo2 = kalshiYes + polyNo;
    const bestCombo = Math.min(combo1, combo2);
    const isCombo1 = combo1 <= combo2;

    if (!best || bestCombo < best.total) {
      best = {
        outcome: row.poly.title || row.kalshi.title,
        total: bestCombo,
        isCombo1,
        polyYes, polyNo, kalshiYes, kalshiNo,
        buyYesPlatform: isCombo1 ? "Polymarket" : "Kalshi",
        buyYesPrice: isCombo1 ? polyYes : kalshiYes,
        buyNoPlatform: isCombo1 ? "Kalshi" : "Polymarket",
        buyNoPrice: isCombo1 ? kalshiNo : polyNo,
      };
      bestEndDate = row.kalshi.endDate || kalshiEndDate || null;
    }
  }

  if (!best) return null;

  const budget = parseFloat(totalBudget) || 1000;

  // --- Days until resolution (for Kalshi APY) ---
  let daysToResolution = 0;
  if (bestEndDate) {
    const end = new Date(bestEndDate);
    const now = new Date();
    daysToResolution = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  }
  const KALSHI_APY = 0.0325;

  // --- Per-share math (in cents) ---
  const yP = best.buyYesPrice; // cents
  const nP = best.buyNoPrice;  // cents

  // Raw profit (no fees, no interest)
  const rawCostPerPair = yP + nP; // cents
  const rawProfitPerPair = 100 - rawCostPerPair; // cents

  // Fees per pair
  const POLY_FEE_RATE = 0.01;
  const KALSHI_FEE_CENTS = 2; // ~2¢ per contract
  const polyLegCents = best.buyYesPlatform === "Polymarket" ? yP : nP;
  const polyFeeCents = polyLegCents * POLY_FEE_RATE;
  const totalFeesPerPair = polyFeeCents + KALSHI_FEE_CENTS;

  // Kalshi APY interest: earned on the Kalshi leg's locked collateral
  // Kalshi locks $1 per contract (the max payout). Interest = $1 × APY × (days/365)
  const kalshiInterestPerPair = daysToResolution > 0 ? (100 * KALSHI_APY * (daysToResolution / 365)) : 0; // in cents

  const netProfitPerPair = rawProfitPerPair - totalFeesPerPair + kalshiInterestPerPair;

  // --- Budget allocation ---
  // Cost per pair in dollars (including fees)
  const costPerPairDollars = (rawCostPerPair + totalFeesPerPair) / 100;
  const shares = Math.floor(budget / costPerPairDollars);
  const yesLegCost = shares * (yP / 100);
  const noLegCost = shares * (nP / 100);
  const totalFeesDollars = shares * (totalFeesPerPair / 100);
  const totalCost = yesLegCost + noLegCost + totalFeesDollars;

  // --- Outcome-specific P&L ---
  // If YES wins: YES shares pay $1 each, NO shares worth $0
  //   Payout = shares × $1 (from YES leg)
  //   Lost = noLegCost (NO leg is worthless)
  // If NO wins: NO shares pay $1 each, YES shares worth $0
  //   Payout = shares × $1 (from NO leg)
  //   Lost = yesLegCost (YES leg is worthless)
  const kalshiInterestTotal = shares * (kalshiInterestPerPair / 100);
  const payoutPerOutcome = shares * 1.0;

  const profitIfYesWins = payoutPerOutcome - totalCost + kalshiInterestTotal;
  const profitIfNoWins = payoutPerOutcome - totalCost + kalshiInterestTotal;
  // Note: for hedged arb (equal shares both sides), profit is the same regardless of outcome
  // The difference only matters if we had unequal allocations

  const netProfitDollars = shares * (netProfitPerPair / 100);
  const netProfitPct = totalCost > 0 ? (netProfitDollars / totalCost * 100) : 0;
  const rawProfitDollars = shares * (rawProfitPerPair / 100);
  const isArb = rawProfitPerPair > 0;
  const isNetPositive = netProfitPerPair > 0;

  const cheaperPlatform = best.polyYes < best.kalshiYes ? "Polymarket" : "Kalshi";
  const priceDiffCents = Math.abs(best.polyYes - best.kalshiYes).toFixed(1);

  const resDate = bestEndDate ? new Date(bestEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div style={{ margin: "0 24px 20px" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "14px 18px", borderRadius: open ? "12px 12px 0 0" : 12,
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
        color: "var(--text-primary)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-body)",
      }}>
        <span>
          Arbitrage Calculator: {best.outcome}
          {isNetPositive && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "var(--green)", fontFamily: "var(--font-mono)" }}>
              +${netProfitDollars.toFixed(2)} net profit
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{open ? "\u25B2" : "\u25BC"}</span>
      </button>

      {open && (
        <div style={{ padding: 20, background: "var(--bg-elevated)", borderRadius: "0 0 12px 12px", border: "1px solid var(--border)", borderTop: "none" }}>
          {conditionsDiffer && (
            <div style={{ padding: "10px 14px", marginBottom: 16, borderRadius: 8, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", fontSize: 12, color: "var(--yellow, #eab308)", fontFamily: "var(--font-body)" }}>
              ⚠ Resolution conditions differ between platforms. Verify rules before trading.
            </div>
          )}
          {/* Budget input */}
          <div style={{ marginBottom: 20 }}>
            <div style={stepLabelStyle}>Total budget</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>$</span>
              <input
                type="text"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value.replace(/[^0-9.]/g, ""))}
                style={{
                  width: 120, padding: "8px 12px", borderRadius: 0, fontSize: 15, fontWeight: 600,
                  fontFamily: "var(--font-mono)", background: "var(--bg-deep)",
                  border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 4 }}>
                {["100", "1000", "5000", "10000"].map((v) => (
                  <button key={v} onClick={() => setTotalBudget(v)} style={{
                    padding: "6px 10px", borderRadius: 0, fontSize: 11, cursor: "pointer",
                    fontFamily: "var(--font-mono)", border: "1px solid var(--border)",
                    background: totalBudget === v ? "rgba(16,185,129,0.12)" : "var(--bg-deep)",
                    color: totalBudget === v ? "var(--green)" : "var(--text-muted)",
                  }}>
                    ${Number(v).toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Strategy + Allocation */}
          <div style={{ marginBottom: 16 }}>
            <div style={stepLabelStyle}>Strategy & Allocation</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, fontFamily: "var(--font-body)", marginBottom: 10 }}>
              Buy <b>{shares.toLocaleString()} shares</b> of <b>YES "{best.outcome}"</b> on{" "}
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{best.buyYesPlatform}</span>{" "}
              + <b>{shares.toLocaleString()} shares</b> of <b>NO</b> on{" "}
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{best.buyNoPlatform}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent)", marginBottom: 4, letterSpacing: "0.08em" }}>
                  {best.buyYesPlatform} (YES)
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                  ${yesLegCost.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {shares.toLocaleString()} × {yP}{"\u00A2"}
                </div>
              </div>
              <div style={{ padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.08em" }}>
                  {best.buyNoPlatform} (NO)
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                  ${noLegCost.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {shares.toLocaleString()} × {nP}{"\u00A2"}
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: Raw spread (before fees) */}
          <div style={{ marginBottom: 16 }}>
            <div style={stepLabelStyle}>1. Raw Spread (before fees)</div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
              fontSize: 13, fontFamily: "var(--font-mono)",
            }}>
              <div style={{ padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border)", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.08em" }}>COST/PAIR</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{rawCostPerPair.toFixed(1)}{"\u00A2"}</div>
              </div>
              <div style={{ padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border)", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.08em" }}>PAYOUT</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>100{"\u00A2"}</div>
              </div>
              <div style={{ padding: "10px 12px", background: "var(--bg-deep)", border: `1px solid ${rawProfitPerPair > 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.08em" }}>RAW PROFIT</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: rawProfitPerPair > 0 ? "var(--green)" : "var(--red)" }}>
                  {rawProfitPerPair > 0 ? "+" : ""}{rawProfitPerPair.toFixed(1)}{"\u00A2"}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, fontFamily: "var(--font-body)" }}>
              On ${budget.toLocaleString()}: <b style={{ color: rawProfitPerPair > 0 ? "var(--green)" : "var(--red)" }}>
                {rawProfitDollars > 0 ? "+" : ""}${rawProfitDollars.toFixed(2)}
              </b> raw profit ({shares.toLocaleString()} pairs)
            </div>
          </div>

          {/* Step 2: Fee breakdown */}
          <div style={{ marginBottom: 16 }}>
            <div style={stepLabelStyle}>2. Fees</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, fontFamily: "var(--font-body)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Polymarket taker (~1% on {polyLegCents.toFixed(1)}{"\u00A2"} leg)</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--red)" }}>-{polyFeeCents.toFixed(2)}{"\u00A2"}/pair</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Kalshi trading fee</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--red)" }}>-{KALSHI_FEE_CENTS}{"\u00A2"}/pair</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 4, marginTop: 4 }}>
                <span style={{ fontWeight: 500 }}>Total fees</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--red)", fontWeight: 600 }}>-{totalFeesPerPair.toFixed(2)}{"\u00A2"}/pair</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, fontFamily: "var(--font-body)" }}>
              On ${budget.toLocaleString()}: <b style={{ color: "var(--red)" }}>-${totalFeesDollars.toFixed(2)}</b> in fees
            </div>
          </div>

          {/* Step 3: Kalshi APY interest */}
          <div style={{ marginBottom: 16 }}>
            <div style={stepLabelStyle}>3. Kalshi Interest (3.25% APY)</div>
            {daysToResolution > 0 ? (
              <>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, fontFamily: "var(--font-body)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Resolution: {resDate} ({daysToResolution} days)</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--green)" }}>+{kalshiInterestPerPair.toFixed(2)}{"\u00A2"}/pair</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>
                    Kalshi pays 3.25% APY on locked collateral ($1/contract × {daysToResolution}d / 365d)
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, fontFamily: "var(--font-body)" }}>
                  On ${budget.toLocaleString()}: <b style={{ color: "var(--green)" }}>+${kalshiInterestTotal.toFixed(2)}</b> earned
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-ghost)", fontFamily: "var(--font-body)" }}>
                Resolution date unknown — cannot calculate interest
              </div>
            )}
          </div>

          {/* Step 4: Net P&L */}
          <div style={{ marginBottom: 16 }}>
            <div style={stepLabelStyle}>4. Net Profit</div>
            <div style={{
              padding: "14px 16px", background: "var(--bg-deep)",
              border: `1px solid ${isNetPositive ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}>
              {/* Calculation breakdown */}
              <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", lineHeight: 2, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Raw profit</span>
                  <span>{rawProfitPerPair > 0 ? "+" : ""}{rawProfitPerPair.toFixed(2)}{"\u00A2"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Fees</span>
                  <span style={{ color: "var(--red)" }}>-{totalFeesPerPair.toFixed(2)}{"\u00A2"}</span>
                </div>
                {daysToResolution > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Kalshi interest</span>
                    <span style={{ color: "var(--green)" }}>+{kalshiInterestPerPair.toFixed(2)}{"\u00A2"}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 4 }}>
                  <span style={{ fontWeight: 700 }}>Net per pair</span>
                  <span style={{ fontWeight: 700, color: isNetPositive ? "var(--green)" : "var(--red)" }}>
                    {netProfitPerPair > 0 ? "+" : ""}{netProfitPerPair.toFixed(2)}{"\u00A2"}
                  </span>
                </div>
              </div>

              {/* Guaranteed profit */}
              <div style={{ textAlign: "center", padding: "12px 0 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.08em" }}>
                  GUARANTEED PROFIT (ANY OUTCOME)
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: isNetPositive ? "var(--green)" : "var(--red)" }}>
                  {netProfitDollars > 0 ? "+" : ""}${netProfitDollars.toFixed(2)}
                </div>
                {isNetPositive && (
                  <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 4 }}>
                    ROI: {netProfitPct.toFixed(2)}%{daysToResolution > 0 && ` over ${daysToResolution} days (${(netProfitPct * 365 / daysToResolution).toFixed(1)}% annualized)`}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{
            padding: 14, borderRadius: 0, background: "var(--bg-deep)",
            border: "1px solid var(--border)", borderLeft: "2px solid var(--warning)",
          }}>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 }}>
              Important
            </div>
            <ul style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, paddingLeft: 16, fontFamily: "var(--font-body)" }}>
              <li>These prices are <b>best bid-ask at the time of lookup</b>. Large orders will move the price — check <b>order book depth</b> before trading.</li>
              <li>Low volume markets can't absorb large positions without significant <b>slippage</b>. Your actual fill price may differ.</li>
              <li>Verify that both markets have <b>identical resolution conditions</b> — similar-looking markets can resolve differently.</li>
            </ul>
          </div>

          {/* Simple price comparison for non-arb */}
          {!isArb && parseFloat(priceDiffCents) > 0.5 && (
            <div style={{
              marginTop: 14, padding: 14, borderRadius: 0, background: "var(--bg-deep)",
              border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 }}>
                No arbitrage, but prices differ
              </div>
              <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, margin: 0, fontFamily: "var(--font-body)" }}>
                YES is cheaper on <span style={{ color: "var(--accent)", fontWeight: 600 }}>{cheaperPlatform}</span> by <b>{priceDiffCents}{"\u00A2"}/share</b>.
                On a ${budget.toLocaleString()} position, that's <b>${Math.round(parseFloat(priceDiffCents) * shares / 100)} saved</b>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtVol(v) {
  if (!v || v === 0) return "\u2014";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function AIAnalysis({ analysis, polyVol, kalVol, isExact }) {
  const [open, setOpen] = useState(false);
  const d = analysis.deadlines;
  const r = analysis.resolution;
  const rec = analysis.recommendation;
  return (
    <div style={{ margin: "0 24px 20px", borderRadius: 0, overflow: "hidden", border: "1px solid var(--border)" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: "14px 18px", background: "var(--bg-elevated)", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-body)" }}>
        Condition Analysis
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div style={{ padding: "16px 16px 20px", background: "var(--bg-deep)" }}>
          {analysis.conditionsIdentical !== undefined && (
            <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 0, background: "var(--bg-elevated)", border: "1px solid var(--border)", fontSize: 12, fontFamily: "var(--font-body)" }}>
              {analysis.conditionsIdentical
                ? <span style={{ color: "var(--green)" }}>Resolution conditions are identical across platforms</span>
                : <span style={{ color: "var(--warning)" }}>Resolution conditions differ. Read details below.</span>}
            </div>
          )}

          {d && (
            <div style={{ marginBottom: 16 }}>
              <div style={aL}>Deadlines</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div style={ac}><div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 4, letterSpacing: "0.08em" }}>POLYMARKET</div><div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>{d.polymarket || "\u2014"}</div></div>
                <div style={ac}><div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, letterSpacing: "0.08em" }}>KALSHI</div><div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>{d.kalshi || "\u2014"}</div></div>
              </div>
              {d.comparison && <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>{d.comparison}</div>}
            </div>
          )}
          {r && (
            <div style={{ marginBottom: 16 }}>
              <div style={aL}>Resolution Criteria</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div style={ac}><div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 4, letterSpacing: "0.08em" }}>POLYMARKET</div><div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>{r.polymarket || "\u2014"}</div></div>
                <div style={ac}><div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, letterSpacing: "0.08em" }}>KALSHI</div><div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>{r.kalshi || "\u2014"}</div></div>
              </div>
              {r.comparison && <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>{r.comparison}</div>}
            </div>
          )}

          {(polyVol?.volume24h > 0 || kalVol?.volume24h > 0) && (
            <div style={{ marginBottom: 16 }}>
              <div style={aL}>Volume (Live)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div style={ac}>
                  <div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 4, letterSpacing: "0.08em" }}>POLYMARKET</div>
                  {polyVol?.volume24h > 0
                    ? <><div style={{ fontSize: 15, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{fmtVol(polyVol.volume24h)} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>24h</span></div>
                      {polyVol?.volumeTotal > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtVol(polyVol.volumeTotal)} total</div>}</>
                    : <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No data</div>}
                </div>
                <div style={ac}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, letterSpacing: "0.08em" }}>KALSHI</div>
                  {kalVol?.volume24h > 0
                    ? <><div style={{ fontSize: 15, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{fmtVol(kalVol.volume24h)} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>24h</span></div>
                      {kalVol?.volumeTotal > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtVol(kalVol.volumeTotal)} total</div>}</>
                    : <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No data</div>}
                </div>
              </div>
              {polyVol?.volume24h > 0 && kalVol?.volume24h > 0 && (() => {
                const more = polyVol.volume24h > kalVol.volume24h ? "Polymarket" : "Kalshi";
                const ratio = Math.max(polyVol.volume24h, kalVol.volume24h) / Math.min(polyVol.volume24h, kalVol.volume24h);
                return <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>{more} is {ratio.toFixed(1)}x more liquid</div>;
              })()}
            </div>
          )}

          {rec && (
            <div style={{ padding: 14, borderRadius: 0, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
              <div style={aL}>Recommendation</div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, fontFamily: "var(--font-body)" }}>{rec}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 6 };
const inputStyle = { width: "100%", height: 56, padding: "0 16px", borderRadius: 0, border: "1px solid var(--border)", background: "var(--bg-deep)", color: "var(--text-primary)", fontSize: 13, fontFamily: "var(--font-mono)", outline: "none", marginBottom: 12, boxSizing: "border-box", transition: "border-color 150ms ease, box-shadow 150ms ease" };
const cardStyle = { borderRadius: 0, background: "var(--bg-deep)", overflow: "hidden", border: "1px solid var(--border)" };
const errorStyle = { padding: 14, borderRadius: 0, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--red)", fontSize: 13, marginBottom: 20, fontFamily: "var(--font-mono)" };
const thStyle = { padding: "8px 10px", fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.08em", textAlign: "center", borderBottom: "1px solid var(--border)", fontWeight: 500 };
const tdStyle = { padding: "10px 10px", fontSize: 13, fontFamily: "var(--font-body)" };
const tdP = { padding: "10px 10px", fontSize: 13, fontFamily: "var(--font-mono)", textAlign: "center", color: "var(--text-primary)" };
const linkStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 0, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", textDecoration: "none", fontSize: 12, fontFamily: "var(--font-mono)", transition: "all 150ms ease" };
const sLabel = { fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.08em" };
const aL = { fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--accent)", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 };
const ac = { padding: "10px 12px", borderRadius: 0, background: "var(--bg-elevated)", border: "1px solid var(--border)" };
const stepLabelStyle = { fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 };
