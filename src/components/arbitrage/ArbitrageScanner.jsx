import React, { useState } from "react";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
function getApiKey() { return localStorage.getItem("polyalpha_api_key") || ""; }

// Normalize strings for fuzzy matching
const norm = (s) => s.toLowerCase().replace(/[.\-']/g, "").replace(/\s+/g, " ").trim();

export default function ArbitrageScanner() {
  const [url, setUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchStep, setSearchStep] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function detectPlatform(input) {
    const lower = input.trim().toLowerCase();
    if (lower.includes("polymarket.com")) return "polymarket";
    if (lower.includes("kalshi.com")) return "kalshi";
    return null;
  }

  function extractPolySlug(input) {
    // Match: polymarket.com/event/SLUG or polymarket.com/event/SLUG/sub-path
    const m = input.match(/polymarket\.com\/event\/([^/?#]+)/i);
    if (m) return m[1];
    // Match: polymarket.com/markets/SLUG (some URLs use /markets/ instead of /event/)
    const m2 = input.match(/polymarket\.com\/markets\/([^/?#]+)/i);
    if (m2) return m2[1];
    return null;
  }

  function extractKalshiTicker(input) {
    // Match: kalshi.com/markets/TICKER or kalshi.com/markets/TICKER/sub/path
    const m = input.match(/kalshi\.com\/markets\/([^/?#]+)/i);
    return m ? m[1].toUpperCase() : null;
  }

  const handleSearch = async () => {
    if (!url.trim()) return;
    const apiKey = getApiKey();
    if (!apiKey) { setError("Set your Anthropic API key first."); return; }
    const platform = detectPlatform(url);
    if (!platform) { setError("Paste a Polymarket or Kalshi URL."); return; }

    setSearching(true);
    setError(null);
    setResult(null);

    try {
      const otherPlatform = platform === "polymarket" ? "Kalshi" : "Polymarket";

      // ═══ STEP 1: Fetch ALL outcomes from source ═══
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

      // ═══ STEP 2: Claude finds the match on the other platform (MATCHING ONLY) ═══
      setSearchStep(`AI finding match on ${otherPlatform}...`);
      const aiResult = await claudeCall(apiKey, `Find the equivalent prediction market on ${otherPlatform}.

Source: ${platform === "polymarket" ? "Polymarket" : "Kalshi"}
Title: "${sourceData.eventTitle}"
Outcomes: ${sourceData.outcomes.slice(0, 10).map(o => o.title).join(", ")}

Search: site:${otherPlatform === "Kalshi" ? "kalshi.com" : "polymarket.com"} ${sourceData.eventTitle}

IMPORTANT: Extract the ticker/slug from the URL you find.
${otherPlatform === "Kalshi"
  ? "Kalshi URLs: kalshi.com/markets/TICKER/... → extract TICKER (e.g., KXMLB, KXPRESPERSON)"
  : "Polymarket URLs: polymarket.com/event/SLUG → extract SLUG"}

MATCHING RULES — BE STRICT ON DATES:
- "exact": Same event, same outcome, same timeframe (within ~2 weeks)
- "similar": Same event but slightly different deadline (up to ~1 month apart). Same underlying asset/topic.
- "none": Use this if:
  • Deadlines are more than 1 month apart (e.g., "end of March" vs "Dec 31" = NONE, not similar)
  • Different underlying event (e.g., different sport, different election)
  • Completely unrelated markets
- DATE IS CRITICAL: "Bitcoin by March 31" vs "Bitcoin by December 31" are NOT the same bet. The timeframe fundamentally changes the probability and price. Mark as "none".
- When deadlines are close (within a few weeks), use "similar" and the AI analysis will explain the difference.

Respond ONLY in valid JSON, nothing else:
{
  "found": true or false,
  "title": "title on ${otherPlatform}",
  "${otherPlatform === "Kalshi" ? "seriesTicker" : "slug"}": "extracted from URL",
  "url": "full URL",
  "matchQuality": "exact or similar or none",
  "explanation": "1-2 sentences"
}`, 800, true);

      // ═══ STEP 3: Fetch ALL outcomes from the other platform ═══
      let otherData = null;
      if (aiResult.found) {
        setSearchStep(`Fetching ${otherPlatform} prices...`);
        let ticker = aiResult.seriesTicker || aiResult.eventTicker || null;
        let slug = aiResult.slug || null;
        // Fallback: extract from URL
        if (!ticker && !slug && aiResult.url) {
          if (otherPlatform === "Kalshi") {
            const m = aiResult.url.match(/kalshi\.com\/markets\/([^/?#]+)/i);
            if (m) ticker = m[1].toUpperCase();
          } else {
            const m = aiResult.url.match(/polymarket\.com\/event\/([^/?#]+)/i);
            if (m) slug = m[1];
          }
        }
        if (otherPlatform === "Kalshi" && ticker) otherData = await fetchKalshiAll(ticker);
        else if (otherPlatform === "Polymarket" && slug) otherData = await fetchPolymarketAll(slug);
      }

      // ═══ STEP 4: Verify match is real ═══
      // If Claude said "found" but we couldn't fetch data, it's a false match
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

      // ═══ STEP 5: Build analysis from REAL API data (not Claude guesses) ═══
      setSearchStep("Building analysis...");
      const analysis = await buildAnalysisFromData(apiKey, polyData, kalshiData, aiResult.matchQuality, matched);

      setResult({
        found: aiResult.found,
        matchQuality: aiResult.matchQuality,
        explanation: aiResult.explanation,
        analysis,
        polymarket: { title: polyData?.eventTitle || "", url: platform === "polymarket" ? url : aiResult.url, volume24h: polyData?.volume24h, volumeTotal: polyData?.volumeTotal },
        kalshi: { title: kalshiData?.eventTitle || "", url: platform === "kalshi" ? url : aiResult.url, volume24h: kalshiData?.volume24h, volumeTotal: kalshiData?.volumeTotal },
        matchedOutcomes: matched,
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
      setSearchStep("");
    }
  };

  // ─── Match outcomes between platforms ───
  function matchOutcomes(polyOutcomes, kalshiOutcomes) {
    const results = [];
    const usedKalshi = new Set();

    // Filter out expired outcomes — only keep active ones
    const activePoly = polyOutcomes.filter((o) => !o.expired);
    const activeKalshi = kalshiOutcomes.filter((o) => !o.expired);

    // If all poly outcomes are expired, fall back to all (for display purposes)
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

        // Name matching score
        let nameScore = 0;
        if (koNorm === poNorm) nameScore = 100;
        else if (koNorm.includes(poNorm) || poNorm.includes(koNorm)) nameScore = 80;
        else if (koNorm.startsWith(poNorm) || poNorm.startsWith(koNorm)) nameScore = 70;
        else {
          const wordHits = poWords.filter(w => koNorm.includes(w)).length;
          nameScore = poWords.length > 0 ? (wordHits / poWords.length) * 60 : 0;
        }

        // Date proximity bonus: if both have dates, prefer closer dates
        let dateBonus = 0;
        if (po.endDate && ko.endDate) {
          const pDate = new Date(po.endDate);
          const kDate = new Date(ko.endDate);
          const daysDiff = Math.abs((pDate - kDate) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 3) dateBonus = 15;       // Same/very close date
          else if (daysDiff <= 14) dateBonus = 10;  // Within 2 weeks
          else if (daysDiff <= 60) dateBonus = 5;   // Within 2 months
          // Penalty for very different dates (>6 months)
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

    // Add unmatched Kalshi outcomes
    for (let i = 0; i < kalshiOutcomes.length; i++) {
      if (!usedKalshi.has(i)) {
        results.push({ poly: null, kalshi: kalshiOutcomes[i], matchScore: 0 });
      }
    }

    // Sort: matched first (by poly price desc), then unmatched
    return results.sort((a, b) => {
      const aMatched = a.poly && a.kalshi ? 1 : 0;
      const bMatched = b.poly && b.kalshi ? 1 : 0;
      if (aMatched !== bMatched) return bMatched - aMatched;
      const aPrice = parseFloat(a.poly?.yes || a.kalshi?.yesAsk || "0");
      const bPrice = parseFloat(b.poly?.yes || b.kalshi?.yesAsk || "0");
      return bPrice - aPrice;
    });
  }

  // ─── Fetch ALL Polymarket outcomes ───
  async function fetchPolymarketAll(slug) {
    const res = await fetch(`/api/events?slug=${slug}`);
    const data = await res.json();
    const events = Array.isArray(data) ? data : [data];
    if (!events.length || !events[0]?.markets) return null;
    const ev = events[0];
    const markets = ev.markets || [];
    // Use event-level volume if available (more accurate), fallback to sum of markets
    const volume24h = parseFloat(ev.volume24hr) || markets.reduce((s, m) => s + (parseFloat(m.volume24hr) || 0), 0);
    const volumeTotal = parseFloat(ev.volume) || markets.reduce((s, m) => s + (parseFloat(m.volume) || 0), 0);
    // Get resolution info from the first market's description
    const firstMarket = markets[0] || {};
    const description = firstMarket.description || ev.description || "";
    const endDate = firstMarket.endDate || ev.endDate || "";
    return {
      eventTitle: ev.title,
      volume24h, volumeTotal,
      resolutionDetails: description,
      endDate,
      outcomes: markets.filter(m => m.outcomePrices && m.outcomePrices !== "[]").map((m) => {
        let y = 0;
        try { const p = JSON.parse(m.outcomePrices || "[]"); y = parseFloat(p[0]) || 0; } catch {}
        const mEndDate = m.endDate || ev.endDate || "";
        const isClosed = m.closed === true || m.active === false;
        const isExpired = mEndDate ? new Date(mEndDate) < new Date() : false;
        return {
          title: m.groupItemTitle || m.question || "",
          yes: (y * 100).toFixed(1),
          no: ((1 - y) * 100).toFixed(1),
          endDate: mEndDate,
          expired: isExpired || isClosed,
        };
      }),
    };
  }

  // ─── Fetch ALL Kalshi outcomes ───
  async function fetchKalshiAll(seriesOrEventTicker) {
    let res = await fetch(`/api/kalshi/markets?event_ticker=${seriesOrEventTicker}&status=open&limit=100`);
    let data = await res.json();
    let markets = data.markets || [];
    if (markets.length === 0) {
      const evRes = await fetch(`/api/kalshi/events?series_ticker=${seriesOrEventTicker}&status=open&limit=5`);
      const evData = await evRes.json();
      if (evData.events?.[0]) {
        res = await fetch(`/api/kalshi/markets?event_ticker=${evData.events[0].event_ticker}&status=open&limit=100`);
        data = await res.json();
        markets = data.markets || [];
      }
    }
    if (!markets.length) return null;
    let eventTitle = seriesOrEventTicker;
    try {
      const evRes = await fetch(`/api/kalshi/events?series_ticker=${seriesOrEventTicker}&status=open&limit=1`);
      const evData = await evRes.json();
      if (evData.events?.[0]?.title) eventTitle = evData.events[0].title;
    } catch {}
    const volume24h = markets.reduce((s, m) => s + (parseFloat(m.volume_24h_fp) || 0), 0);
    const volumeTotal = markets.reduce((s, m) => s + (parseFloat(m.volume_fp) || 0), 0);
    console.log(`[OddsAnalyzer] Kalshi ${seriesOrEventTicker}: ${markets.length} markets, vol24h=$${volume24h.toFixed(0)}, volTotal=$${volumeTotal.toFixed(0)}`);
    // Get resolution info from the first market
    const firstMarket = markets[0] || {};
    const rules = firstMarket.rules_primary || "";
    const expiration = firstMarket.expiration_time || firstMarket.close_time || "";
    return {
      eventTitle, volume24h, volumeTotal,
      resolutionDetails: rules,
      endDate: expiration,
      outcomes: markets.map((m) => {
        const exp = m.expiration_time || m.close_time || expiration || "";
        const isExpired = exp ? new Date(exp) < new Date() : false;
        return {
          title: m.yes_sub_title || m.title || m.ticker,
          yesAsk: (parseFloat(m.yes_ask_dollars || 0) * 100).toFixed(1),
          yesBid: (parseFloat(m.yes_bid_dollars || 0) * 100).toFixed(1),
          noBid: (parseFloat(m.no_bid_dollars || 0) * 100).toFixed(1),
          endDate: exp,
          expired: isExpired,
        };
      }),
    };
  }

  // ─── Build analysis from REAL API data ───
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

    // Build arbitrage data from matched outcomes — EXCLUDE expired
    const arbitrageExamples = (matchedOutcomes || [])
      .filter((r) => r.poly && r.kalshi && !r.poly.expired && !r.kalshi.expired)
      .slice(0, 5)
      .map((r) => {
        const polyYes = parseFloat(r.poly.yes) || 0;
        const kalshiYesAsk = parseFloat(r.kalshi.yesAsk) || 0;
        const kalshiNoBid = parseFloat(r.kalshi.noBid) || 0;
        const polyNo = parseFloat(r.poly.no) || 0;
        // Check: buy YES on cheaper + buy NO on cheaper < 100?
        const combo1 = Math.min(polyYes, kalshiYesAsk) + Math.min(polyNo, kalshiNoBid || (100 - kalshiYesAsk));
        // Date difference between platforms for this outcome
        let dateDiffDays = 0;
        if (r.poly.endDate && r.kalshi.endDate) {
          dateDiffDays = Math.round(Math.abs(new Date(r.poly.endDate) - new Date(r.kalshi.endDate)) / (1000 * 60 * 60 * 24));
        }
        return {
          outcome: r.poly.title, polyYes, polyNo, kalshiYes: kalshiYesAsk,
          kalshiNo: kalshiNoBid || (100 - kalshiYesAsk), totalCost: combo1,
          polyEndDate: r.poly.endDate || "unknown", kalshiEndDate: r.kalshi.endDate || "unknown",
          dateDiffDays,
        };
      });

    // Calculate time until resolution
    let timeToResolve = "";
    const endDates = [polyEnd, kalshiEnd].filter((d) => d && d !== "Not available");
    if (endDates.length > 0) {
      try {
        const d = new Date(endDates[0]);
        const now = new Date();
        const months = Math.round((d - now) / (1000 * 60 * 60 * 24 * 30));
        timeToResolve = months > 0 ? `${months} months` : "< 1 month";
      } catch {}
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

These are multi-outcome events. The rules shown are from one sub-market but the same structure applies to all outcomes. Ignore specific names/numbers in the rules.

Answer these 3 simple questions:
1. Are these the SAME bet? (same event, same resolution trigger)
2. Are the deadlines the same or different?
3. Are there any meaningful price differences worth noting?

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
    "polymarket": "how it resolves in 1 sentence",
    "kalshi": "how it resolves in 1 sentence",
    "comparison": "identical / or 1 sentence explaining the difference"
  },
  "recommendation": "1-2 sentences. If identical: say they are the same bet, compare based on which has better price. If different: explain the key difference simply."
}`, 600);

      return result;
    } catch {
      return {
        conditionsIdentical: matchQuality === "exact",
        deadlines: { polymarket: polyEnd, kalshi: kalshiEnd, comparison: "Could not analyze." },
        resolution: { polymarket: polyRes.slice(0, 100), kalshi: kalshiRes.slice(0, 100), comparison: "Could not analyze." },
      };
    }
  }

  // ─── Claude call ───
  async function claudeCall(apiKey, prompt, maxTokens, useWebSearch) {
    const body = { model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] };
    if (useWebSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
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

  // ═══ RENDER ═══
  return (
    <div style={{ animation: "fadeInUp 0.5s var(--ease-out)", maxWidth: 820, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 20 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, margin: "0 0 8px" }}>Odds Analyzer</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>Paste a market link — compare every outcome across platforms</p>
      </div>

      {/* Warning banner */}
      <div style={{
        marginBottom: 28, padding: "12px 16px", borderRadius: 12,
        background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.25)",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <div style={{ fontSize: 13, color: "#ffcc00", lineHeight: 1.5 }}>
          <strong>Price differences usually reflect different resolution conditions</strong> — different deadlines, sources, or criteria.
          This is <em>not</em> arbitrage. Always verify the resolution rules on both platforms before trading.
        </div>
      </div>

      {/* INPUT */}
      <div style={formStyle}>
        <label style={labelStyle}>Market URL</label>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Paste a Polymarket or Kalshi link..." style={{ ...inputStyle, fontSize: 13 }} />
        {url.trim() && detectPlatform(url) && (
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", textTransform: "uppercase" }}>
              {detectPlatform(url) === "polymarket" ? "Polymarket" : "Kalshi"} detected
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→ searching {detectPlatform(url) === "polymarket" ? "Kalshi" : "Polymarket"}</span>
          </div>
        )}
        <button onClick={handleSearch} disabled={searching || !url.trim()} style={{
          width: "100%", marginTop: 4, padding: "14px 0", borderRadius: 14, border: "none",
          background: searching ? "rgba(0,212,170,0.15)" : "var(--accent)",
          color: searching ? "var(--accent)" : "#000",
          fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700,
          cursor: searching ? "not-allowed" : "pointer",
        }}>
          {searching ? searchStep : "Compare Prices"}
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {result && !result.found && (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "24px 24px 16px" }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>❌</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Match Found</div>
            <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{result.explanation}</div>
          </div>
          {result.sourceData?.outcomes?.length > 0 && (
            <div style={{ padding: "0 24px 20px" }}>
              <div style={{ ...sLabel, marginBottom: 8, color: "var(--accent)" }}>
                {result.sourcePlatform === "polymarket" ? "Polymarket" : "Kalshi"} — {result.sourceData.eventTitle}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={{ ...thStyle, textAlign: "left" }}>Outcome</th><th style={thStyle}>YES</th></tr></thead>
                <tbody>
                  {result.sourceData.outcomes.slice(0, 10).map((o, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{o.title}</td>
                      <td style={tdP}>{o.yes || o.yesAsk || "—"}¢</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.sourceUrl && (
                <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, marginTop: 12, display: "inline-flex" }}>
                  View on {result.sourcePlatform === "polymarket" ? "Polymarket" : "Kalshi"} →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {result?.found && (
        <div style={cardStyle}>
          {/* Header */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>{result.matchQuality === "exact" ? "✅" : "⚠️"}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{result.matchQuality === "exact" ? "Exact Match" : "Similar Match — Not Identical"}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{result.explanation}</div>
              </div>
            </div>
            {result.matchQuality !== "exact" && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 10,
                background: "rgba(255,170,0,0.1)", border: "1px solid rgba(255,170,0,0.25)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <div style={{ fontSize: 12, color: "#ffcc00", lineHeight: 1.4 }}>
                  <strong>These bets are similar but NOT identical.</strong> Resolution conditions, deadlines or triggers may differ.
                  Check the AI Analysis below before trading. Price comparison is shown but these are different bets.
                </div>
              </div>
            )}
          </div>

          {/* Market titles */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...sLabel, color: "var(--accent)" }}>Polymarket</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{result.polymarket.title || "—"}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...sLabel, color: "#a78bfa" }}>Kalshi</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{result.kalshi.title || "—"}</div>
            </div>
          </div>

          {/* ═══ ALL OUTCOMES TABLE ═══ */}
          <div style={{ padding: "20px 24px", overflowX: "auto" }}>
            <div style={{ ...sLabel, marginBottom: 12 }}>All Outcomes — Live Prices</div>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>Outcome</th>
                  <th colSpan={2} style={{ ...thStyle, color: "var(--accent)", borderBottom: "2px solid rgba(0,212,170,0.2)" }}>Polymarket</th>
                  <th colSpan={2} style={{ ...thStyle, color: "#a78bfa", borderBottom: "2px solid rgba(167,139,250,0.2)" }}>Kalshi</th>
                  <th style={thStyle}>Best YES</th>
                </tr>
                <tr>
                  <th style={{ ...thStyle, borderBottom: "1px solid rgba(255,255,255,0.08)" }}></th>
                  <th style={{ ...thStyle, fontSize: 9, color: "var(--accent)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>YES</th>
                  <th style={{ ...thStyle, fontSize: 9, color: "rgba(0,212,170,0.5)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>NO</th>
                  <th style={{ ...thStyle, fontSize: 9, color: "#a78bfa", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>YES</th>
                  <th style={{ ...thStyle, fontSize: 9, color: "rgba(167,139,250,0.5)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>NO</th>
                  <th style={{ ...thStyle, borderBottom: "1px solid rgba(255,255,255,0.08)" }}></th>
                </tr>
              </thead>
              <tbody>
                {result.matchedOutcomes?.map((row, i) => {
                  const polyYes = parseFloat(row.poly?.yes) || 0;
                  const polyNo = parseFloat(row.poly?.no) || 0;
                  const kalshiYes = parseFloat(row.kalshi?.yesAsk) || 0;
                  const kalshiNo = parseFloat(row.kalshi?.noBid) || (kalshiYes ? 100 - kalshiYes : 0);
                  const best = !polyYes ? "kalshi" : !kalshiYes ? "poly" : polyYes < kalshiYes ? "poly" : kalshiYes < polyYes ? "kalshi" : "equal";
                  // Arbitrage check
                  const combo = polyYes && kalshiNo ? polyYes + kalshiNo : null;
                  const combo2 = kalshiYes && polyNo ? kalshiYes + polyNo : null;
                  // Only show arb tag for EXACT matches
                  const hasArb = result.matchQuality === "exact" && ((combo && combo < 99.5) || (combo2 && combo2 < 99.5));

                  return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ ...tdStyle, maxWidth: 180 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                          {row.poly?.title || row.kalshi?.title || "—"}
                          {(row.poly?.expired || row.kalshi?.expired) && (
                            <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 4, background: "rgba(255,68,68,0.2)", color: "#ff6b6b", fontWeight: 700 }}>EXPIRED</span>
                          )}
                        </div>
                        {row.poly && row.kalshi && row.poly.title !== row.kalshi.title && (
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Kalshi: {row.kalshi.title}</div>
                        )}
                        {row.poly?.endDate && row.kalshi?.endDate && (
                          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>
                            {(() => {
                              const pD = new Date(row.poly.endDate);
                              const kD = new Date(row.kalshi.endDate);
                              const daysDiff = Math.round(Math.abs(pD - kD) / (1000 * 60 * 60 * 24));
                              return daysDiff > 3 ? `⚠ ${daysDiff}d date gap` : null;
                            })()}
                          </div>
                        )}
{}
                      </td>
                      <td style={tdP}>{row.poly ? <span>{row.poly.yes}¢</span> : "—"}</td>
                      <td style={{ ...tdP, color: "rgba(255,255,255,0.4)" }}>{row.poly ? <span>{row.poly.no}¢</span> : "—"}</td>
                      <td style={tdP}>
                        {row.kalshi ? (
                          <div>
                            <span>{row.kalshi.yesAsk}¢</span>
                            <div style={{ fontSize: 9, color: "var(--text-muted)" }}>bid {row.kalshi.yesBid}¢</div>
                          </div>
                        ) : "—"}
                      </td>
                      <td style={{ ...tdP, color: "rgba(255,255,255,0.4)" }}>
                        {row.kalshi ? <span>{row.kalshi.noBid || (100 - kalshiYes).toFixed(1)}¢</span> : "—"}
                      </td>
                      <td style={tdP}>
                        {best === "equal" || (!polyYes && !kalshiYes) ? <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span> :
                         best === "poly" ? <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 11 }}>Poly</span> :
                         <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: 11 }}>Kalshi</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Links */}
          <div style={{ padding: "0 24px 20px", display: "flex", gap: 10 }}>
            {result.polymarket.url && <a href={result.polymarket.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>Polymarket →</a>}
            {result.kalshi.url && <a href={result.kalshi.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>Kalshi →</a>}
          </div>

          {/* Arbitrage Education — only for exact matches with identical conditions */}
          {result.matchQuality === "exact" && result.analysis?.conditionsIdentical && result.matchedOutcomes?.length > 0 && (
            <ArbitrageEducation outcomes={result.matchedOutcomes} />
          )}

          {/* AI Analysis */}
          {result.analysis && <AIAnalysis analysis={result.analysis} polyVol={result.polymarket} kalVol={result.kalshi} isExact={result.matchQuality === "exact"} />}

          <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "rgba(255,170,0,0.6)", textAlign: "center" }}>
            Always verify resolution conditions before trading — platforms may have different deadlines or criteria.
          </div>
        </div>
      )}
    </div>
  );
}

function ArbitrageEducation({ outcomes }) {
  const [open, setOpen] = useState(false);

  // Find the best arbitrage combo across all outcomes
  let best = null;
  for (const row of outcomes) {
    if (!row.poly || !row.kalshi || row.poly.expired || row.kalshi.expired) continue;
    const polyYes = parseFloat(row.poly.yes) || 0;
    const polyNo = parseFloat(row.poly.no) || 0;
    const kalshiYes = parseFloat(row.kalshi.yesAsk) || 0;
    const kalshiNo = row.kalshi.noBid ? parseFloat(row.kalshi.noBid) : (kalshiYes ? 100 - kalshiYes : 0);
    if (!polyYes || !kalshiYes) continue;

    const combo1 = polyYes + kalshiNo; // Buy YES Poly + NO Kalshi
    const combo2 = kalshiYes + polyNo; // Buy YES Kalshi + NO Poly
    const bestCombo = Math.min(combo1, combo2);
    const isCombo1 = combo1 <= combo2;

    if (bestCombo < 100 && (!best || bestCombo < best.total)) {
      best = {
        outcome: row.poly.title || row.kalshi.title,
        total: bestCombo,
        profitRaw: (100 - bestCombo).toFixed(1),
        profitPct: ((100 - bestCombo) / bestCombo * 100).toFixed(1),
        isCombo1,
        polyYes, polyNo, kalshiYes, kalshiNo,
        buyYesPlatform: isCombo1 ? "Polymarket" : "Kalshi",
        buyYesPrice: isCombo1 ? polyYes : kalshiYes,
        buyNoPlatform: isCombo1 ? "Kalshi" : "Polymarket",
        buyNoPrice: isCombo1 ? kalshiNo : polyNo,
      };
    }
  }

  if (!best) return null;

  // Fee calculations
  const polyFeeRate = 0.01; // ~1% taker
  const kalshiFeePerContract = 2; // 2¢ per contract
  const polyLegPrice = best.isCombo1 ? best.polyYes : best.polyNo;
  const kalshiLegPrice = best.isCombo1 ? best.kalshiNo : best.kalshiYes;
  const polyFee = (polyLegPrice * polyFeeRate).toFixed(1);
  const totalAfterFees = (parseFloat(polyLegPrice) + parseFloat(polyFee) + parseFloat(kalshiLegPrice) + kalshiFeePerContract).toFixed(1);
  const profitAfterFees = (100 - parseFloat(totalAfterFees)).toFixed(1);
  const stillProfitable = parseFloat(profitAfterFees) > 0;

  // Savings calculation (buying cheaper)
  const priceDiff = Math.abs(best.polyYes - best.kalshiYes).toFixed(1);
  const cheaperPlatform = best.polyYes < best.kalshiYes ? "Polymarket" : "Kalshi";
  const cheaperPrice = Math.min(best.polyYes, best.kalshiYes);
  const savingsOn1000 = Math.round(parseFloat(priceDiff) * 1000 / cheaperPrice);

  return (
    <div style={{ margin: "0 24px 20px" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "14px 18px", borderRadius: 12,
        background: "rgba(255,170,0,0.06)", border: "1px solid rgba(255,170,0,0.2)",
        cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
        color: "#ffaa00",
      }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          💰 Price Comparison — {best.outcome}
        </span>
        <span style={{ fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: 18, background: "rgba(255,170,0,0.03)", borderRadius: "0 0 12px 12px", border: "1px solid rgba(255,170,0,0.1)", borderTop: "none" }}>
          {/* Step 1: The opportunity */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#ffaa00", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>
              Step 1 — The Opportunity
            </div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7 }}>
              Buy <b>YES "{best.outcome}"</b> on <span style={{ color: best.buyYesPlatform === "Polymarket" ? "var(--accent)" : "#a78bfa", fontWeight: 700 }}>{best.buyYesPlatform}</span> at <b>{best.buyYesPrice}¢</b> +
              Buy <b>NO</b> on <span style={{ color: best.buyNoPlatform === "Polymarket" ? "var(--accent)" : "#a78bfa", fontWeight: 700 }}>{best.buyNoPlatform}</span> at <b>{best.buyNoPrice}¢</b>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>
                Total: <b>{best.total.toFixed(1)}¢</b> → Guaranteed payout: <b>100¢</b> → Profit: <span style={{ color: "var(--accent)", fontWeight: 700 }}>{best.profitRaw}¢ ({best.profitPct}%)</span>
              </div>
            </div>
          </div>

          {/* Step 2: The fees */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#ffaa00", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>
              Step 2 — But wait, fees...
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              <div style={{ marginBottom: 4 }}>• Polymarket taker fee (~1%): <b>+{polyFee}¢</b></div>
              <div style={{ marginBottom: 4 }}>• Kalshi trading fee: <b>+{kalshiFeePerContract}¢</b> per contract</div>
              <div style={{ marginTop: 8, fontWeight: 600, color: "var(--text-primary)" }}>
                After fees: {totalAfterFees}¢ total → Profit: <span style={{ color: stillProfitable ? "var(--accent)" : "#ff6b6b", fontWeight: 700 }}>{profitAfterFees}¢ {!stillProfitable && "(negative!)"}</span>
              </div>
            </div>
          </div>

          {/* Step 3: The real problem */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#ffaa00", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>
              Step 3 — The real problem
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              {stillProfitable
                ? `Even with ${profitAfterFees}¢ profit per share, your capital is locked until the event resolves. A savings account earns 4-5%/year risk-free. Professional bots also close these gaps in milliseconds — by the time you execute, the prices may have moved.`
                : `The fees completely eliminate the profit. This is why retail arbitrage doesn't work in prediction markets — the margins are too thin and fees eat everything.`}
            </div>
          </div>

          {/* Conclusion */}
          <div style={{ padding: 14, borderRadius: 10, background: "rgba(0,212,170,0.06)", border: "1px solid rgba(0,212,170,0.15)" }}>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, fontWeight: 600 }}>
              💡 The smart move
            </div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7 }}>
              Forget arbitrage. If you want to bet on <b>{best.outcome}</b>, buy on <span style={{ color: cheaperPlatform === "Polymarket" ? "var(--accent)" : "#a78bfa", fontWeight: 700 }}>{cheaperPlatform}</span> at <b>{cheaperPrice}¢</b> instead of {cheaperPlatform === "Polymarket" ? "Kalshi" : "Polymarket"} at {Math.max(best.polyYes, best.kalshiYes)}¢.
              You save <b>{priceDiff}¢/share</b> — on a $1,000 bet, that's <b>${savingsOn1000} extra profit</b> if you're right.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtVol(v) {
  if (!v || v === 0) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// RiskBadge removed

function AIAnalysis({ analysis, polyVol, kalVol, isExact }) {
  const [open, setOpen] = useState(false);
  const d = analysis.deadlines;
  const r = analysis.resolution;
  const rec = analysis.recommendation;
  return (
    <div style={{ margin: "0 24px 20px", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.04)" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: "14px 18px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#a78bfa" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>🤖 AI Analysis</span>
        <span style={{ fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 18px" }}>
          {/* Conditions status */}
          {analysis.conditionsIdentical !== undefined && (
            <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 8, background: analysis.conditionsIdentical ? "rgba(0,212,170,0.06)" : "rgba(255,170,0,0.06)", border: `1px solid ${analysis.conditionsIdentical ? "rgba(0,212,170,0.15)" : "rgba(255,170,0,0.15)"}`, fontSize: 12 }}>
              {analysis.conditionsIdentical
                ? <span style={{ color: "var(--accent)" }}>✅ Resolution conditions are identical across platforms</span>
                : <span style={{ color: "#ffaa00" }}>⚠️ Resolution conditions differ — read details below</span>}
            </div>
          )}

          {d && (
            <div style={{ marginBottom: 18 }}>
              <div style={aL}>Deadlines</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div style={ac}><div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>POLYMARKET</div><div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{d.polymarket || "—"}</div></div>
                <div style={ac}><div style={{ fontSize: 10, color: "#a78bfa", fontFamily: "var(--font-mono)", marginBottom: 4 }}>KALSHI</div><div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{d.kalshi || "—"}</div></div>
              </div>
              {d.comparison && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{d.comparison}</div>}
            </div>
          )}
          {r && (
            <div style={{ marginBottom: 18 }}>
              <div style={aL}>Resolution Criteria</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div style={ac}><div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>POLYMARKET</div><div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.polymarket || "—"}</div></div>
                <div style={ac}><div style={{ fontSize: 10, color: "#a78bfa", fontFamily: "var(--font-mono)", marginBottom: 4 }}>KALSHI</div><div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.kalshi || "—"}</div></div>
              </div>
              {r.comparison && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{r.comparison}</div>}
            </div>
          )}

          {/* Volume - real data only */}
          {(polyVol?.volume24h > 0 || kalVol?.volume24h > 0) && (
            <div style={{ marginBottom: 18 }}>
              <div style={aL}>Liquidity & Volume (Live)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div style={ac}>
                  <div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>POLYMARKET</div>
                  {polyVol?.volume24h > 0
                    ? <><div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{fmtVol(polyVol.volume24h)} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>24h</span></div>
                      {polyVol?.volumeTotal > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtVol(polyVol.volumeTotal)} total</div>}</>
                    : <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No data</div>}
                </div>
                <div style={ac}>
                  <div style={{ fontSize: 10, color: "#a78bfa", fontFamily: "var(--font-mono)", marginBottom: 4 }}>KALSHI</div>
                  {kalVol?.volume24h > 0
                    ? <><div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{fmtVol(kalVol.volume24h)} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>24h</span></div>
                      {kalVol?.volumeTotal > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtVol(kalVol.volumeTotal)} total</div>}</>
                    : <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No data</div>}
                </div>
              </div>
              {polyVol?.volume24h > 0 && kalVol?.volume24h > 0 && (() => {
                const more = polyVol.volume24h > kalVol.volume24h ? "Polymarket" : "Kalshi";
                const ratio = Math.max(polyVol.volume24h, kalVol.volume24h) / Math.min(polyVol.volume24h, kalVol.volume24h);
                return <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{more} is {ratio.toFixed(1)}x more liquid</div>;
              })()}
            </div>
          )}

          {/* Recommendation */}
          {rec && (
            <div style={{ padding: 14, borderRadius: 12, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
              <div style={aL}>💡 Recommendation</div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>{rec}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const formStyle = { borderRadius: 20, background: "rgba(31,32,35,0.95)", backdropFilter: "blur(20px)", border: "1.5px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 30px rgba(0,0,0,0.24)", padding: 28, marginBottom: 32 };
const labelStyle = { display: "block", fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: 1, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", fontSize: 14, fontFamily: "var(--font-mono)", outline: "none", marginBottom: 16, boxSizing: "border-box" };
const cardStyle = { borderRadius: 20, background: "rgba(31,32,35,0.95)", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.08)" };
const errorStyle = { padding: 16, borderRadius: 12, background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff6b6b", fontSize: 14, marginBottom: 24, fontFamily: "var(--font-mono)" };
const thStyle = { padding: "8px 10px", fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: 1, textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 };
const tdStyle = { padding: "10px 10px", fontSize: 13 };
const tdP = { padding: "10px 10px", fontSize: 13, fontFamily: "var(--font-mono)", textAlign: "center", color: "var(--text-primary)" };
const linkStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", textDecoration: "none", fontSize: 13, fontFamily: "var(--font-mono)" };
const sLabel = { fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: 1 };
const aL = { fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#a78bfa", letterSpacing: 0.5, marginBottom: 6, fontWeight: 600 };
const ac = { padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" };
