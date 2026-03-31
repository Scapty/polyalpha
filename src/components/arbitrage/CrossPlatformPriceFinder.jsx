import { useState, useEffect } from "react";
import { findBestPrice, getSearchesRemaining } from "../../utils/crossPlatformFinder";
import { hasApiKey } from "../../utils/aiAgent";

const PLATFORMS = ["Polymarket", "Kalshi", "Other"];

export default function CrossPlatformPriceFinder() {
  const [basePlatform, setBasePlatform] = useState("Polymarket");
  const [marketTitle, setMarketTitle] = useState("");
  const [yesPrice, setYesPrice] = useState("");
  const [noPrice, setNoPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(getSearchesRemaining());

  useEffect(() => {
    const id = setInterval(() => setRemaining(getSearchesRemaining()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Auto-calculate NO price when YES price changes
  function handleYesChange(val) {
    setYesPrice(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && num < 1) {
      setNoPrice((1 - num).toFixed(2));
    }
  }

  async function handleSearch() {
    if (!marketTitle.trim()) return;

    const yp = parseFloat(yesPrice) || 0.5;
    const np = parseFloat(noPrice) || 1 - yp;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await findBestPrice({
        marketTitle: marketTitle.trim(),
        yesPrice: yp.toFixed(2),
        noPrice: np.toFixed(2),
        basePlatform,
      });
      setResult(data);
      setRemaining(getSearchesRemaining());
    } catch (err) {
      if (err.message === "API_KEY_REQUIRED") {
        setError("Set your Anthropic API key (header button) to use this feature.");
      } else if (err.message === "RATE_LIMITED") {
        setError("Rate limit reached. Try again in a few minutes.");
      } else if (err.message === "KALSHI_UNAVAILABLE") {
        setError("Could not reach Kalshi API. Try again shortly.");
      } else if (err.message === "POLYMARKET_UNAVAILABLE") {
        setError("Could not reach Polymarket API. Try again shortly.");
      } else {
        setError(err.message || "Search failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const match = result?.match;
  const comparison = result?.comparison;
  const arbitrage = result?.arbitrage;
  const similarMarkets = result?.similarMarkets || [];
  const targetPlatform = result?.targetPlatform || (basePlatform === "Polymarket" ? "Kalshi" : "Polymarket");

  return (
    <section className="glass-card" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{
          fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8, margin: 0,
        }}>
          Cross-Platform Price Finder
        </h2>
        <span style={{
          fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)",
          padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)",
        }}>
          {remaining}/{10} searches remaining
        </span>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 20px 0" }}>
        Find the best price for your bet across prediction markets
      </p>

      {/* Input Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {/* Platform selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 100 }}>Your platform</label>
          <div style={{ display: "flex", gap: 6 }}>
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setBasePlatform(p)}
                style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 12,
                  fontFamily: "var(--font-body)", cursor: "pointer",
                  border: basePlatform === p ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                  background: basePlatform === p ? "rgba(0,212,170,0.1)" : "rgba(255,255,255,0.03)",
                  color: basePlatform === p ? "var(--accent)" : "var(--text-muted)",
                  transition: "all 0.15s ease",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Market title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 100 }}>Market title</label>
          <input
            type="text"
            placeholder="e.g. Will Bitcoin exceed $150,000 by June 2026?"
            value={marketTitle}
            onChange={(e) => setMarketTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 13,
              fontFamily: "var(--font-body)",
              background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)", outline: "none",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
          />
        </div>

        {/* Prices */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 100 }}>Prices</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>YES $</span>
              <input
                type="text"
                placeholder="0.42"
                value={yesPrice}
                onChange={(e) => handleYesChange(e.target.value)}
                style={{
                  width: 70, padding: "8px 10px", borderRadius: 6, fontSize: 13,
                  fontFamily: "var(--font-mono)", textAlign: "center",
                  background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)", outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>NO $</span>
              <input
                type="text"
                placeholder="0.58"
                value={noPrice}
                onChange={(e) => setNoPrice(e.target.value)}
                style={{
                  width: 70, padding: "8px 10px", borderRadius: 6, fontSize: 13,
                  fontFamily: "var(--font-mono)", textAlign: "center",
                  background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)", outline: "none",
                }}
              />
            </div>
          </div>
        </div>

        {/* Search button */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <div style={{ minWidth: 100 }} />
          <button
            onClick={handleSearch}
            disabled={loading || !marketTitle.trim() || !hasApiKey()}
            style={{
              padding: "10px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              fontFamily: "var(--font-body)", cursor: loading ? "wait" : "pointer",
              background: loading ? "rgba(0,212,170,0.2)" : "var(--accent)",
              color: loading ? "var(--accent)" : "var(--bg-primary)",
              border: "none",
              opacity: (!marketTitle.trim() || !hasApiKey()) ? 0.4 : 1,
              transition: "all 0.2s ease",
            }}
          >
            {loading ? "Searching..." : "Find Best Price"}
          </button>
          {loading && (
            <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              Fetching {basePlatform === "Polymarket" ? "Kalshi" : "Polymarket"} markets & matching with AI...
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 8, marginBottom: 16,
          background: "rgba(255,68,102,0.08)", border: "1px solid rgba(255,68,102,0.2)",
          fontSize: 13, color: "var(--negative)",
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ animation: "fadeInUp 0.3s var(--ease-out)" }}>
          {/* Results header */}
          <div style={{
            padding: "12px 16px", borderRadius: "8px 8px 0 0",
            background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Results for: <strong style={{ color: "var(--text-primary)" }}>"{truncate(marketTitle, 60)}"</strong>
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              {result.marketsScanned || result.kalshiMarketsScanned || result.polymarketMarketsScanned} {targetPlatform} markets scanned
              {result.searchedAt && ` · ${new Date(result.searchedAt).toLocaleTimeString()}`}
            </span>
          </div>

          {/* Match found — Comparison table */}
          {match?.found && comparison && (
            <div style={{ padding: 16 }}>
              {/* Match quality badge + explanation */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <MatchBadge quality={match.matchQuality} />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{match.explanation}</span>
              </div>

              {/* Key differences callout for non-exact matches */}
              {match.matchQuality !== "exact" && match.keyDifferences && (
                <div style={{
                  padding: "10px 14px", borderRadius: 8, marginBottom: 14,
                  background: match.matchQuality === "similar"
                    ? "rgba(59,130,246,0.06)" : "rgba(255,170,0,0.06)",
                  border: `1px solid ${match.matchQuality === "similar"
                    ? "rgba(59,130,246,0.15)" : "rgba(255,170,0,0.15)"}`,
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                    fontFamily: "var(--font-mono)", marginBottom: 4,
                    color: match.matchQuality === "similar" ? "var(--human-blue)" : "var(--warning)",
                  }}>
                    Key differences
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {match.keyDifferences}
                  </div>
                  {match.recommendation && (
                    <div style={{
                      marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)",
                      fontSize: 12, color: "var(--text-muted)", fontStyle: "italic",
                    }}>
                      {match.recommendation}
                    </div>
                  )}
                </div>
              )}

              {/* Comparison table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      {["Platform", "YES Price", "NO Price", "Volume 24h", "Status"].map((h) => (
                        <th key={h} style={{
                          padding: "8px 12px", textAlign: "left", color: "var(--text-muted)",
                          fontWeight: 500, fontFamily: "var(--font-body)", fontSize: 11,
                          textTransform: "uppercase", letterSpacing: "0.05em",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* User's platform row */}
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{basePlatform}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        ${yesPrice}
                        {comparison.bestYesPlatform === basePlatform && <BestTag />}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        ${noPrice}
                        {comparison.bestNoPlatform === basePlatform && <BestTag />}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                        —
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 6px",
                          borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "var(--text-muted)",
                        }}>
                          Your market
                        </span>
                      </td>
                    </tr>
                    {/* Target platform row */}
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{targetPlatform}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        {comparison.targetYesBid != null
                          ? `$${Number(comparison.targetYesBid).toFixed(2)}`
                          : comparison.kalshiYesBid != null
                            ? `$${Number(comparison.kalshiYesBid).toFixed(2)}`
                            : comparison.polymarketYes != null
                              ? `$${Number(comparison.polymarketYes).toFixed(2)}`
                              : "—"}
                        {comparison.bestYesPlatform === targetPlatform && <BestTag />}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        {comparison.targetNoBid != null
                          ? `$${Number(comparison.targetNoBid).toFixed(2)}`
                          : comparison.kalshiNoBid != null
                            ? `$${Number(comparison.kalshiNoBid).toFixed(2)}`
                            : comparison.polymarketNo != null
                              ? `$${Number(comparison.polymarketNo).toFixed(2)}`
                              : "—"}
                        {comparison.bestNoPlatform === targetPlatform && <BestTag />}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                        {(comparison.targetVolume24h || comparison.kalshiVolume24h || comparison.polymarketVolume24h)
                          ? formatVol(comparison.targetVolume24h || comparison.kalshiVolume24h || comparison.polymarketVolume24h)
                          : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {comparison.savingsPerShare > 0 ? (
                          <span style={{
                            fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 6px",
                            borderRadius: 4, background: "rgba(0,212,170,0.1)", color: "var(--accent)",
                          }}>
                            Better!
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 6px",
                            borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "var(--text-muted)",
                          }}>
                            Similar
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Best price summary */}
              <div style={{
                marginTop: 16, display: "flex", flexDirection: "column", gap: 6,
                fontSize: 13, color: "var(--text-secondary)",
              }}>
                <div>
                  Best YES price: <strong style={{ color: "var(--accent)" }}>{comparison.bestYesPlatform}</strong>
                  {comparison.savingsPerShare > 0 && (
                    <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                      {" "}(save ${comparison.savingsPerShare.toFixed(2)}/share)
                    </span>
                  )}
                </div>
                <div>
                  Best NO price: <strong style={{ color: "var(--accent)" }}>{comparison.bestNoPlatform}</strong>
                </div>
              </div>

              {/* Target market title */}
              {(match.targetTitle || match.kalshiTitle || match.polymarketTitle) && (
                <div style={{
                  marginTop: 12, padding: "8px 12px", borderRadius: 6,
                  background: "rgba(255,255,255,0.02)", fontSize: 12, color: "var(--text-dim)",
                }}>
                  {targetPlatform} market: <span style={{ color: "var(--text-muted)" }}>
                    {match.targetEvent || match.kalshiEvent || match.targetTitle || match.kalshiTitle || match.polymarketTitle}
                  </span>
                  {(match.targetTicker || match.kalshiTicker || match.polymarketId) && (
                    <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
                      ({match.targetTicker || match.kalshiTicker || match.polymarketId})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Arbitrage Alert */}
          {arbitrage?.detected && (
            <div style={{
              margin: "0 16px 16px", padding: "14px 16px", borderRadius: 8,
              background: "rgba(0,212,170,0.06)", border: "1px solid rgba(0,212,170,0.2)",
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 6,
                fontFamily: "var(--font-display)",
              }}>
                Cross-Platform Arbitrage Detected!
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {arbitrage.strategy}
              </div>
              {arbitrage.totalCost != null && arbitrage.profitPercent != null && (
                <div style={{
                  marginTop: 8, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)",
                }}>
                  Total cost: ${arbitrage.totalCost.toFixed(2)} → Guaranteed $1.00 payout ={" "}
                  <strong>{arbitrage.profitPercent.toFixed(1)}% profit</strong>
                </div>
              )}
            </div>
          )}

          {/* No match — message */}
          {match && !match.found && similarMarkets.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: "var(--text-dim)" }}>
              This market may not have an equivalent on {targetPlatform}.
            </div>
          )}

          {/* Similar/alternative markets — always shown when available */}
          {similarMarkets.length > 0 && (
            <div style={{ padding: 16, borderTop: match?.found ? "1px solid var(--border-subtle)" : "none" }}>
              <div style={{
                fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 10,
              }}>
                {match?.found ? "Other similar markets" : "Closest matches found"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {similarMarkets.map((m, i) => (
                  <div key={m.ticker || i} style={{
                    padding: "12px 14px", borderRadius: 8,
                    background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <MatchBadge quality={m.matchQuality || "related"} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                        {m.event || m.title}
                      </span>
                    </div>
                    {m.whyShown && (
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, lineHeight: 1.4 }}>
                        {m.whyShown}
                      </div>
                    )}
                    {m.keyDifference && (
                      <div style={{
                        fontSize: 12, color: "var(--warning)", marginBottom: 4,
                        display: "flex", alignItems: "baseline", gap: 4,
                      }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, flexShrink: 0 }}>DIFF</span>
                        <span>{m.keyDifference}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-dim)" }}>
                      {m.yesBid != null && (
                        <span style={{ fontFamily: "var(--font-mono)" }}>YES: ${Number(m.yesBid).toFixed(2)}</span>
                      )}
                      {m.ticker && (
                        <span style={{ fontFamily: "var(--font-mono)" }}>{m.ticker}</span>
                      )}
                      {/* Legacy field support */}
                      {!m.whyShown && m.relevance && (
                        <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{m.relevance}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No API key hint */}
      {!hasApiKey() && !loading && !result && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: "rgba(255,170,0,0.05)", border: "1px solid rgba(255,170,0,0.15)",
          fontSize: 12, color: "var(--warning)",
        }}>
          Set your Anthropic API key using the button in the header to enable cross-platform price search.
        </div>
      )}
    </section>
  );
}

// --- Sub-components ---

function MatchBadge({ quality }) {
  const config = {
    exact: { label: "Exact Match", bg: "rgba(0,212,170,0.12)", color: "var(--accent)" },
    similar: { label: "Similar Match", bg: "rgba(59,130,246,0.12)", color: "var(--human-blue)" },
    related: { label: "Related", bg: "rgba(255,170,0,0.12)", color: "var(--warning)" },
    none: { label: "No Match", bg: "rgba(255,255,255,0.06)", color: "var(--text-dim)" },
  };
  const c = config[quality] || config.none;
  return (
    <span style={{
      fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
      padding: "3px 8px", borderRadius: 4, background: c.bg, color: c.color,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {c.label}
    </span>
  );
}

function BestTag() {
  return (
    <span style={{
      marginLeft: 6, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
      padding: "1px 5px", borderRadius: 3, background: "rgba(0,212,170,0.15)",
      color: "var(--accent)", verticalAlign: "middle",
    }}>
      BEST
    </span>
  );
}

// --- Helpers ---

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function formatVol(v) {
  if (!v) return "$0";
  const num = Number(v);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}
