import React, { useState, useRef, useEffect } from "react";
import { fetchAllKalshiMarkets } from "../../utils/api";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_SEARCHES_PER_HOUR = 10;
const CACHE_TTL = 5 * 60 * 1000;

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
      const { markets: kalshiMarkets } = await fetchAllKalshiMarkets(1000);
      if (kalshiMarkets.length === 0) {
        throw new Error("Could not fetch Kalshi markets. Try again.");
      }

      const eventMap = {};
      for (const m of kalshiMarkets) {
        const ek = m.event_ticker;
        if (!eventMap[ek]) {
          eventMap[ek] = { event: m.eventTitle, ticker: ek, markets: [] };
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

      const eventList = Object.values(eventMap).slice(0, 300);

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
    <div style={{ animation: "fadeInUp 0.3s ease both" }}>
      {/* Search */}
      <section style={{
        background: "var(--bg-deep)",
        border: "1px solid var(--border)",
        borderRadius: 0,
        padding: 24,
        marginBottom: 24,
      }}>
        <h2 style={{
          fontSize: 16,
          fontWeight: 600,
          fontFamily: "var(--font-display)",
          color: "var(--text-primary)",
          marginBottom: 4,
        }}>
          Cross-Platform Price Finder
        </h2>
        <p style={{
          color: "var(--text-muted)",
          fontSize: 13,
          fontFamily: "var(--font-body)",
          margin: "0 0 20px 0",
        }}>
          Search for a bet and find the best price across prediction markets
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
            display: "block",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            Your platform
          </label>
          <div style={{ display: "flex", gap: 4 }}>
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
                  background: platform === p.id ? "var(--accent)" : "var(--bg-deep)",
                  color: platform === p.id ? "#fff" : "var(--text-muted)",
                  border: "1px solid transparent",
                  borderRadius: 0,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. Will Bitcoin exceed $150,000 by June 2026?"
            style={{
              flex: 1,
              height: 48,
              padding: "0 16px",
              background: "var(--bg-deep)",
              border: "1px solid var(--border)",
              borderRadius: 0,
              color: "var(--text-primary)",
              fontSize: 14,
              fontFamily: "var(--font-body)",
              outline: "none",
              transition: "border-color 150ms ease",
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="btn-primary"
            style={{ height: 48, padding: "0 24px", whiteSpace: "nowrap" }}
          >
            {loading ? "Searching..." : "Find Best Price"}
          </button>
        </div>

        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: "var(--text-ghost)",
          fontFamily: "var(--font-mono)",
        }}>
          {remaining}/{MAX_SEARCHES_PER_HOUR} searches remaining this hour
          {result?.timestamp && (
            <span style={{ marginLeft: 12 }}>
              Prices as of {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </section>

      {error && (
        <div style={{
          marginBottom: 16,
          padding: "12px 16px",
          borderRadius: 0,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "var(--red)",
          fontSize: 13,
          fontFamily: "var(--font-body)",
        }}>
          {error}
        </div>
      )}

      {loading && (
        <section style={{
          background: "var(--bg-deep)",
          border: "1px solid var(--border)",
          borderRadius: 0,
          padding: 40,
          textAlign: "center",
        }}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
            Searching across prediction markets...
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Fetching Kalshi markets and matching with AI
          </p>
        </section>
      )}

      {result && !loading && (
        <ResultsPanel result={result} />
      )}

      <div style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 0,
        background: "var(--bg-deep)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--accent)",
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--accent)",
          marginBottom: 4,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          How it works
        </div>
        <p style={{
          fontSize: 13,
          color: "var(--text-muted)",
          fontFamily: "var(--font-body)",
          lineHeight: 1.6,
          margin: 0,
        }}>
          1. Fetches all open markets from Kalshi's public API.{" "}
          2. AI analyzes your query and finds matching or similar bets.{" "}
          3. Shows side-by-side price comparison with match quality.{" "}
          <strong style={{ color: "var(--text-secondary)" }}>Always verify resolution conditions.</strong>
        </p>
      </div>
    </div>
  );
}

function ResultsPanel({ result }) {
  if (result.noMatch) {
    return (
      <section style={{
        background: "var(--bg-deep)",
        border: "1px solid var(--border)",
        borderRadius: 0,
        padding: 24,
      }}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{
            fontSize: 15,
            fontWeight: 500,
            fontFamily: "var(--font-display)",
            color: "var(--text-primary)",
            marginBottom: 4,
          }}>
            No matching market found on Kalshi
          </p>
          {result.suggestion && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Suggestion: {result.suggestion}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section style={{
      background: "var(--bg-deep)",
      border: "1px solid var(--border)",
      borderRadius: 0,
      padding: 24,
    }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "var(--font-display)",
          margin: 0,
          color: "var(--text-primary)",
        }}>
          Results for: "{result.query}"
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {result.matches.length} match{result.matches.length !== 1 ? "es" : ""} found on Kalshi
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Market", "Match", "YES Bid", "YES Ask", "NO Bid", ""].map((h) => (
                <th key={h} style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
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
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 12px", maxWidth: 350 }}>
                  <div style={{
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "var(--font-body)",
                  }}>
                    {m.kalshiEventTitle}
                  </div>
                  {m.kalshiOutcome && (
                    <div style={{
                      fontSize: 12,
                      color: "var(--accent-bright)",
                      marginTop: 2,
                    }}>
                      {m.kalshiOutcome}
                    </div>
                  )}
                  <div style={{
                    fontSize: 11,
                    color: "var(--text-ghost)",
                    marginTop: 3,
                  }}>
                    {m.explanation}
                  </div>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <MatchBadge quality={m.matchQuality} />
                </td>
                <td style={{
                  padding: "10px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}>
                  {m.yesBid > 0 ? `${(m.yesBid * 100).toFixed(1)}\u00A2` : "\u2014"}
                </td>
                <td style={{
                  padding: "10px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}>
                  {m.yesAsk > 0 ? `${(m.yesAsk * 100).toFixed(1)}\u00A2` : "\u2014"}
                </td>
                <td style={{
                  padding: "10px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  color: "var(--text-muted)",
                }}>
                  {m.noBid > 0 ? `${(m.noBid * 100).toFixed(1)}\u00A2` : "\u2014"}
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
                      background: "var(--accent-glow)",
                      color: "var(--accent-bright)",
                      border: "none",
                      borderRadius: 0,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Kalshi {"\u2192"}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.matches.length > 0 && result.matches[0].matchQuality === "exact" && (
        <div style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 0,
          background: "var(--bg-elevated)",
          borderLeft: "3px solid var(--accent)",
        }}>
          <p style={{
            fontSize: 13,
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            margin: 0,
          }}>
            Best YES price on Kalshi:{" "}
            <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent-bright)" }}>
              {result.matches[0].yesAsk > 0 ? `${(result.matches[0].yesAsk * 100).toFixed(1)}\u00A2` : `${(result.matches[0].yesBid * 100).toFixed(1)}\u00A2 bid`}
            </strong>
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Compare with your {result.platform === "polymarket" ? "Polymarket" : "Kalshi"} price. Always check resolution conditions.
          </p>
        </div>
      )}

      <div style={{
        marginTop: 12,
        padding: "8px 12px",
        borderRadius: 0,
        background: "var(--bg-elevated)",
        fontSize: 11,
        color: "var(--text-muted)",
        fontFamily: "var(--font-body)",
      }}>
        Prices are indicative. Resolution conditions may differ between platforms. Always verify before trading.
      </div>
    </section>
  );
}

function MatchBadge({ quality }) {
  const styles = {
    exact: { bg: "rgba(16,185,129,0.12)", color: "var(--green)", label: "Exact" },
    similar: { bg: "rgba(245,158,11,0.12)", color: "var(--warning)", label: "Similar" },
    related: { bg: "var(--bg-elevated)", color: "var(--text-muted)", label: "Related" },
  };
  const s = styles[quality] || styles.related;
  return (
    <span style={{
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      fontWeight: 600,
      padding: "3px 8px",
      borderRadius: 0,
      background: s.bg,
      color: s.color,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    }}>
      {s.label}
    </span>
  );
}
