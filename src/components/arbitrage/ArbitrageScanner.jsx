import React, { useState } from "react";
import GlowingInput from "../shared/GlowingInput";
import SpotlightCard from "../shared/SpotlightCard";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
function getApiKey() { return localStorage.getItem("polyalpha_api_key") || ""; }

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
    const m = input.match(/polymarket\.com\/event\/([^/?#]+)/i);
    if (m) return m[1];
    const m2 = input.match(/polymarket\.com\/markets\/([^/?#]+)/i);
    if (m2) return m2[1];
    return null;
  }

  function extractKalshiTicker(input) {
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

      let otherData = null;
      if (aiResult.found) {
        setSearchStep(`Fetching ${otherPlatform} prices...`);
        let ticker = aiResult.seriesTicker || aiResult.eventTicker || null;
        let slug = aiResult.slug || null;
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
        if (koNorm === poNorm) nameScore = 100;
        else if (koNorm.includes(poNorm) || poNorm.includes(koNorm)) nameScore = 80;
        else if (koNorm.startsWith(poNorm) || poNorm.startsWith(koNorm)) nameScore = 70;
        else {
          const wordHits = poWords.filter(w => koNorm.includes(w)).length;
          nameScore = poWords.length > 0 ? (wordHits / poWords.length) * 60 : 0;
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
    const res = await fetch(`/api/events?slug=${slug}`);
    const data = await res.json();
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
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", gap: 24 }}>
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
                  const kalshiNo = parseFloat(row.kalshi?.noBid) || (kalshiYes ? 100 - kalshiYes : 0);
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
                        {row.kalshi ? <span>{row.kalshi.noBid || (100 - kalshiYes).toFixed(1)}{"\u00A2"}</span> : "\u2014"}
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
          {result.matchQuality === "exact" && result.analysis?.conditionsIdentical && result.matchedOutcomes?.length > 0 && (
            <ArbitrageEducation outcomes={result.matchedOutcomes} />
          )}

          {/* AI Analysis */}
          {result.analysis && <AIAnalysis analysis={result.analysis} polyVol={result.polymarket} kalVol={result.kalshi} isExact={result.matchQuality === "exact"} />}

          <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-ghost)", textAlign: "center", fontFamily: "var(--font-body)" }}>
            Always verify resolution conditions before trading. Platforms may have different deadlines or criteria.
          </div>
        </div>
      )}
    </div>
  );
}

function ArbitrageEducation({ outcomes }) {
  const [open, setOpen] = useState(false);

  let best = null;
  for (const row of outcomes) {
    if (!row.poly || !row.kalshi || row.poly.expired || row.kalshi.expired) continue;
    const polyYes = parseFloat(row.poly.yes) || 0;
    const polyNo = parseFloat(row.poly.no) || 0;
    const kalshiYes = parseFloat(row.kalshi.yesAsk) || 0;
    const kalshiNo = row.kalshi.noBid ? parseFloat(row.kalshi.noBid) : (kalshiYes ? 100 - kalshiYes : 0);
    if (!polyYes || !kalshiYes) continue;

    const combo1 = polyYes + kalshiNo;
    const combo2 = kalshiYes + polyNo;
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

  const polyFeeRate = 0.01;
  const kalshiFeePerContract = 2;
  const polyLegPrice = best.isCombo1 ? best.polyYes : best.polyNo;
  const kalshiLegPrice = best.isCombo1 ? best.kalshiNo : best.kalshiYes;
  const polyFee = (polyLegPrice * polyFeeRate).toFixed(1);
  const totalAfterFees = (parseFloat(polyLegPrice) + parseFloat(polyFee) + parseFloat(kalshiLegPrice) + kalshiFeePerContract).toFixed(1);
  const profitAfterFees = (100 - parseFloat(totalAfterFees)).toFixed(1);
  const stillProfitable = parseFloat(profitAfterFees) > 0;

  const priceDiff = Math.abs(best.polyYes - best.kalshiYes).toFixed(1);
  const cheaperPlatform = best.polyYes < best.kalshiYes ? "Polymarket" : "Kalshi";
  const cheaperPrice = Math.min(best.polyYes, best.kalshiYes);
  const savingsOn1000 = Math.round(parseFloat(priceDiff) * 1000 / cheaperPrice);

  return (
    <div style={{ margin: "0 24px 20px" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "14px 18px", borderRadius: open ? "12px 12px 0 0" : 12,
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
        color: "var(--text-primary)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-body)",
      }}>
        Price Comparison: {best.outcome}
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{open ? "\u25B2" : "\u25BC"}</span>
      </button>

      {open && (
        <div style={{ padding: 20, background: "var(--bg-elevated)", borderRadius: "0 0 12px 12px", border: "1px solid var(--border)", borderTop: "none" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={stepLabelStyle}>
              Step 1: The Opportunity
            </div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, fontFamily: "var(--font-body)" }}>
              Buy <b>YES "{best.outcome}"</b> on <span style={{ color: "var(--accent)", fontWeight: 600 }}>{best.buyYesPlatform}</span> at <b>{best.buyYesPrice}{"\u00A2"}</b> +
              Buy <b>NO</b> on <span style={{ color: "var(--accent)", fontWeight: 600 }}>{best.buyNoPlatform}</span> at <b>{best.buyNoPrice}{"\u00A2"}</b>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
              Total: <b>{best.total.toFixed(1)}{"\u00A2"}</b> {"\u2192"} Payout: <b>100{"\u00A2"}</b> {"\u2192"} Profit: <span style={{ color: "var(--green)", fontWeight: 600 }}>{best.profitRaw}{"\u00A2"} ({best.profitPct}%)</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={stepLabelStyle}>
              Step 2: Fees
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, fontFamily: "var(--font-body)" }}>
              <div style={{ marginBottom: 4 }}>Polymarket taker fee (~1%): +{polyFee}{"\u00A2"}</div>
              <div style={{ marginBottom: 4 }}>Kalshi trading fee: +{kalshiFeePerContract}{"\u00A2"} per contract</div>
              <div style={{ marginTop: 8, fontWeight: 500, color: "var(--text-primary)" }}>
                After fees: {totalAfterFees}{"\u00A2"} total {"\u2192"} Profit: <span style={{ color: stillProfitable ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{profitAfterFees}{"\u00A2"} {!stillProfitable && "(negative)"}</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={stepLabelStyle}>
              Step 3: Capital Lockup
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, fontFamily: "var(--font-body)" }}>
              {stillProfitable
                ? `Even with ${profitAfterFees}\u00A2 profit per share, your capital is locked until the event resolves. Professional bots close these gaps in milliseconds.`
                : `The fees eliminate the profit. Retail arbitrage doesn't work in prediction markets: margins are too thin and fees eat everything.`}
            </p>
          </div>

          <div style={{ padding: 14, borderRadius: 0, background: "var(--bg-deep)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 }}>
              Practical Takeaway
            </div>
            <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, margin: 0, fontFamily: "var(--font-body)" }}>
              If you want to bet on <b>{best.outcome}</b>, buy on <span style={{ color: "var(--accent)", fontWeight: 600 }}>{cheaperPlatform}</span> at <b>{cheaperPrice}{"\u00A2"}</b>.
              You save <b>{priceDiff}{"\u00A2"}/share</b> {"\u2014"} on a $1,000 bet, that's <b>${savingsOn1000} extra profit</b>.
            </p>
          </div>
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
