import React, { useState, useRef, useEffect } from "react";
import { fetchAllKalshiMarkets } from "../../utils/api";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_SEARCHES_PER_HOUR = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 min cache

function getApiKey() {
  return localStorage.getItem("polyalpha_api_key") || "";
}

function getSearchCount() {
  const data = JSON.parse(localStorage.getItem("pf_searches") || "{}");
  const hourAgo = Date.now() - 3600_000;
  const recent = (data.timestamps || []).filter((t) => t > hourAgo);
  return recent.length;
}

function recordSearch() {
  const data = JSON.parse(localStorage.getItem("pf_searches") || "{}");
  const hourAgo = Date.now() - 3600_000;
  const timestamps = [...(data.timestamps || []).filter((t) => t > hourAgo), Date.now()];
  localStorage.setItem("pf_searches", JSON.stringify({ timestamps }));
}

export default function PriceFinder() {
  const [platform, setPlatform] = useState("polymarket");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [searchesUsed, setSearchesUsed] = useState(getSearchCount());
  const cacheRef = useRef(new Map());

  // Update search count display
  useEffect(() => {
    const id = setInterval(() => setSearchesUsed(getSearchCount()), 10_000);
    return () => clearInterval(id);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Set your Anthropic API key first (top-right corner).");
      return;
    }

    if (searchesUsed >= MAX_SEARCHES_PER_HOUR) {
      setError(`Rate limited: ${MAX_SEARCHES_PER_HOUR} searches per hour. Try again later.`);
      return;
    }

    // Check cache
    const cacheKey = `${platform}:${query.toLowerCase().trim()}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setResult(cached.data);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Fetch all Kalshi markets
      const { markets: kalshiMarkets } = await fetchAllKalshiMarkets(1000);
      if (kalshiMarkets.length === 0) {
        throw new Error("Could not fetch Kalshi markets. Try again.");
      }

      // Step 2: Build condensed market list for Claude
      // Group by event to reduce token count
      const eventMap = {};
      for (const m of kalshiMarkets) {
        const ek = m.event_ticker;
        if (!eventMap[ek]) {
          eventMap[ek] = {
            event: m.eventTitle,
            ticker: ek,
            markets: [],
          };
        }
        eventMap[ek].markets.push({
          ticker: m.ticker,
          sub: m.yes_sub_title || "",
          yb: m.yes_bid_dollars || "0",
          ya: m.yes_ask_dollars || "0",
          nb: m.no_bid_dollars || "0",
          vol: m.volume_24h_fp || m.volume_fp || "0",
        });
      }

      // Only send events with some volume or relevance (reduce tokens)
      const eventList = Object.values(eventMap).slice(0, 300);

      // Step 3: Ask Claude to find the match
      const prompt = `I want to find the best price for a prediction market bet across platforms.

My current platform: ${platform === "polymarket" ? "Polymarket" : "Kalshi"}
The bet I'm looking at: "${query}"

Below are all currently open Kalshi events and their markets (JSON). Each event has sub-markets with yes_bid (yb), yes_ask (ya), no_bid (nb), and 24h volume (vol) in dollars.

${JSON.stringify(eventList, null, 0)}

Find the Kalshi market(s) that match or are closest to my bet. Consider:
- Exact same question = "exact" match
- Same topic but different timeframe/threshold = "similar" match
- Related but different question = "related" match

Respond ONLY in JSON, no markdown, no backticks:
{
  "matches": [
    {
      "kalshiTicker": "TICKER",
      "kalshiEventTitle": "event title",
      "kalshiOutcome": "yes subtitle if any",
      "matchQuality": "exact" | "similar" | "related",
      "explanation": "why this matches (1 sentence)",
      "yesBid": 0.XX,
      "yesAsk": 0.XX,
      "noBid": 0.XX
    }
  ],
  "noMatch": false,
  "suggestion": "if no match, suggest what to search for instead"
}

Return up to 5 matches, best first. If nothing matches at all, set noMatch to true.`;

      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error: ${res.status}`);
      }

      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse AI response.");

      const parsed = JSON.parse(jsonMatch[0]);

      // Enrich with Kalshi URLs and arbitrage detection
      const enrichedMatches = (parsed.matches || []).map((m) => {
        const eventTicker = m.kalshiTicker?.split("-").slice(0, -1).join("-") || "";
        const seriesTicker = kalshiMarkets.find((km) => km.ticker === m.kalshiTicker)?.series_ticker || eventTicker;
        return {
          ...m,
          kalshiUrl: `https://kalshi.com/markets/${seriesTicker.toLowerCase()}`,
          yesBid: parseFloat(m.yesBid) || 0,
          yesAsk: parseFloat(m.yesAsk) || 0,
          noBid: parseFloat(m.noBid) || 0,
        };
      });

      const resultData = {
        query,
        platform,
        matches: enrichedMatches,
        noMatch: parsed.noMatch || enrichedMatches.length === 0,
        suggestion: parsed.suggestion || "",
        timestamp: Date.now(),
      };

      recordSearch();
      setSearchesUsed(getSearchCount());
      cacheRef.current.set(cacheKey, { data: resultData, ts: Date.now() });
      setResult(resultData);
    } catch (err) {
      console.error("Price Finder error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const remaining = MAX_SEARCHES_PER_HOUR - searchesUsed;

  return (
    <div style={{ animation: "fadeInUp 0.4s var(--ease-out)" }}>
      {/* Search Box */}
      <section className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>&#128269;</span>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, margin: 0 }}>
            Cross-Platform Price Finder
          </h2>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 20px 0" }}>
          Search for a bet and find the best price across prediction markets
        </p>

        {/* Platform selector */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Your platform
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "polymarket", label: "Polymarket" },
              { id: "kalshi", label: "Kalshi" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                style={{
                  padding: "6px 16px",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  background: platform === p.id ? "rgba(0,212,170,0.12)" : "rgba(255,255,255,0.04)",
                  color: platform === p.id ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${platform === p.id ? "rgba(0,212,170,0.3)" : "var(--border-subtle)"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. Will Bitcoin exceed $150,000 by June 2026?"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: 14,
                padding: "12px 16px",
                fontFamily: "var(--font-body)",
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            style={{
              padding: "12px 24px",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-body)",
              background: loading ? "rgba(0,212,170,0.1)" : "var(--accent)",
              color: loading ? "var(--accent)" : "#000",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor: loading ? "wait" : "pointer",
              opacity: !query.trim() ? 0.4 : 1,
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Searching..." : "Find Best Price"}
          </button>
        </div>

        {/* Rate limit */}
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {remaining}/{MAX_SEARCHES_PER_HOUR} searches remaining this hour
          {result?.timestamp && (
            <span style={{ marginLeft: 12 }}>
              Prices as of {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: 16,
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          background: "rgba(255,68,102,0.08)",
          border: "1px solid rgba(255,68,102,0.2)",
          color: "var(--negative)",
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <section className="glass-card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}>
            Searching across prediction markets...
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            Fetching Kalshi markets and matching with AI
          </div>
        </section>
      )}

      {/* Results */}
      {result && !loading && (
        <ResultsPanel result={result} />
      )}

      {/* How it works */}
      <div style={{
        marginTop: 24,
        padding: 16,
        borderRadius: "var(--radius-md)",
        background: "rgba(0,212,170,0.04)",
        border: "1px solid rgba(0,212,170,0.12)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
          HOW IT WORKS
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          1. Fetches all open markets from Kalshi's public API.{" "}
          2. AI analyzes your query and finds matching or similar bets.{" "}
          3. Shows side-by-side price comparison with match quality.{" "}
          <strong style={{ color: "var(--text-secondary)" }}>Always verify resolution conditions</strong> — similar markets on different platforms often have different deadlines or criteria.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RESULTS PANEL
// ============================================================

function ResultsPanel({ result }) {
  if (result.noMatch) {
    return (
      <section className="glass-card" style={{ padding: 24 }}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>
            No matching market found on Kalshi
          </div>
          {result.suggestion && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Suggestion: {result.suggestion}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="glass-card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
          Results for: "{result.query}"
        </h3>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {result.matches.length} match{result.matches.length !== 1 ? "es" : ""} found on Kalshi
        </div>
      </div>

      {/* Results table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["Market", "Match", "YES Bid", "YES Ask", "NO Bid", ""].map((h) => (
                <th key={h} style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.matches.map((m, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td style={{ padding: "10px 12px", maxWidth: 350 }}>
                  <div style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                    {m.kalshiEventTitle}
                  </div>
                  {m.kalshiOutcome && (
                    <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 2 }}>
                      {m.kalshiOutcome}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>
                    {m.explanation}
                  </div>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <MatchBadge quality={m.matchQuality} />
                </td>
                <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  {m.yesBid > 0 ? `${(m.yesBid * 100).toFixed(1)}¢` : "—"}
                </td>
                <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  {m.yesAsk > 0 ? `${(m.yesAsk * 100).toFixed(1)}¢` : "—"}
                </td>
                <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)" }}>
                  {m.noBid > 0 ? `${(m.noBid * 100).toFixed(1)}¢` : "—"}
                </td>
                <td style={{ padding: "10px 8px" }}>
                  <a
                    href={m.kalshiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "5px 12px",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      background: "rgba(0,150,255,0.1)",
                      color: "#4da6ff",
                      border: "1px solid rgba(0,150,255,0.2)",
                      borderRadius: 6,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Kalshi →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Best price summary */}
      {result.matches.length > 0 && result.matches[0].matchQuality === "exact" && (
        <div style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 6,
          background: "rgba(0,212,170,0.06)",
          border: "1px solid rgba(0,212,170,0.15)",
        }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
            Best YES price on Kalshi:{" "}
            <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
              {result.matches[0].yesAsk > 0 ? `${(result.matches[0].yesAsk * 100).toFixed(1)}¢` : `${(result.matches[0].yesBid * 100).toFixed(1)}¢ bid`}
            </strong>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Compare with your {result.platform === "polymarket" ? "Polymarket" : "Kalshi"} price to see which platform offers a better deal. Always check resolution conditions.
          </div>
        </div>
      )}

      {/* Warning */}
      <div style={{
        marginTop: 12,
        padding: "8px 12px",
        borderRadius: 6,
        background: "rgba(255,170,0,0.06)",
        border: "1px solid rgba(255,170,0,0.12)",
        fontSize: 11,
        color: "var(--warning)",
      }}>
        Prices are indicative. Resolution conditions may differ between platforms — always verify before trading.
      </div>
    </section>
  );
}

function MatchBadge({ quality }) {
  const styles = {
    exact: { bg: "rgba(0,212,170,0.1)", color: "var(--accent)", label: "Exact" },
    similar: { bg: "rgba(255,170,0,0.1)", color: "var(--warning)", label: "Similar" },
    related: { bg: "rgba(255,255,255,0.05)", color: "var(--text-muted)", label: "Related" },
  };
  const s = styles[quality] || styles.related;
  return (
    <span style={{
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      fontWeight: 600,
      padding: "3px 8px",
      borderRadius: 4,
      background: s.bg,
      color: s.color,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    }}>
      {s.label}
    </span>
  );
}
