import { useState, useEffect } from "react";
import { findBestPrice, getSearchesRemaining } from "../../utils/crossPlatformFinder";
import { hasApiKey } from "../../utils/aiAgent";

const PLATFORMS = ["Polymarket", "Kalshi"];

const STEPS = [
  { id: 1, label: "Extract identity" },
  { id: 2, label: "Generate search terms" },
  { id: 3, label: "Search target platform" },
  { id: 4, label: "AI matching" },
  { id: 5, label: "Arbitrage analysis" },
];

export default function CrossPlatformPriceFinder() {
  const [basePlatform, setBasePlatform] = useState("Polymarket");
  const [marketTitle, setMarketTitle] = useState("");
  const [yesPrice, setYesPrice] = useState("");
  const [noPrice, setNoPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepMessage, setStepMessage] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(getSearchesRemaining());

  useEffect(() => {
    const id = setInterval(() => setRemaining(getSearchesRemaining()), 10_000);
    return () => clearInterval(id);
  }, []);

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
    setCurrentStep(0);
    setStepMessage("");

    try {
      const data = await findBestPrice({
        marketTitle: marketTitle.trim(),
        yesPrice: yp.toFixed(2),
        noPrice: np.toFixed(2),
        basePlatform,
        onProgress: (step, message) => {
          setCurrentStep(step);
          setStepMessage(message);
        },
      });
      setResult(data);
      setRemaining(getSearchesRemaining());
    } catch (err) {
      if (err.message === "API_KEY_REQUIRED") {
        setError("Set your Anthropic API key (header button) to use this feature.");
      } else if (err.message === "RATE_LIMITED") {
        setError("Rate limit reached. Try again in a few minutes.");
      } else {
        setError(err.message || "Search failed. Please try again.");
      }
    } finally {
      setLoading(false);
      setCurrentStep(0);
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
        </div>
      </div>

      {/* Step Progress Indicator */}
      {loading && (
        <div style={{
          padding: "14px 16px", borderRadius: 8, marginBottom: 16,
          background: "rgba(0,212,170,0.04)", border: "1px solid rgba(0,212,170,0.1)",
        }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {STEPS.map((step) => (
              <div key={step.id} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: currentStep >= step.id
                  ? "var(--accent)"
                  : "rgba(255,255,255,0.06)",
                transition: "background 0.3s ease",
              }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", background: "var(--accent)",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              Step {currentStep}/5: {stepMessage}
            </span>
          </div>
        </div>
      )}

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
              {result.marketsScanned} candidates checked
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

              {/* Warning for similar matches */}
              {match.matchQuality === "similar" && (
                <div style={{
                  padding: "10px 14px", borderRadius: 8, marginBottom: 14,
                  background: "rgba(255,170,0,0.06)", border: "1px solid rgba(255,170,0,0.15)",
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                    fontFamily: "var(--font-mono)", marginBottom: 4, color: "var(--warning)",
                  }}>
                    Verify before trading
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    These markets are similar but may have different resolution criteria.
                    {match.keyDifferences && ` ${match.keyDifferences}`}
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

              {/* Side-by-side comparison table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      {["Platform", "YES Price", "NO Price", "Best Price"].map((h) => (
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
                    {/* Source platform row */}
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                        {basePlatform}
                        <span style={{
                          marginLeft: 6, fontSize: 9, fontFamily: "var(--font-mono)",
                          padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.06)",
                          color: "var(--text-dim)", verticalAlign: "middle",
                        }}>YOUR BET</span>
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        ${parseFloat(yesPrice).toFixed(2)}
                        {comparison.bestYesPlatform === basePlatform && <BestTag />}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        ${parseFloat(noPrice).toFixed(2)}
                        {comparison.bestNoPlatform === basePlatform && <BestTag />}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {comparison.bestYesPlatform === basePlatform ? (
                          <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                            Cheaper YES
                          </span>
                        ) : comparison.bestNoPlatform === basePlatform ? (
                          <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                            Cheaper NO
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>
                        )}
                      </td>
                    </tr>
                    {/* Target platform row */}
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{targetPlatform}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        {comparison.targetYesBid != null
                          ? `$${Number(comparison.targetYesBid).toFixed(2)}`
                          : "—"}
                        {comparison.targetYesAsk && comparison.targetYesAsk !== comparison.targetYesBid && (
                          <span style={{ color: "var(--text-dim)", fontSize: 10, marginLeft: 4 }}>
                            (ask: ${Number(comparison.targetYesAsk).toFixed(2)})
                          </span>
                        )}
                        {comparison.bestYesPlatform === targetPlatform && <BestTag />}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        {comparison.targetNoBid != null
                          ? `$${Number(comparison.targetNoBid).toFixed(2)}`
                          : "—"}
                        {comparison.targetNoAsk && comparison.targetNoAsk !== comparison.targetNoBid && (
                          <span style={{ color: "var(--text-dim)", fontSize: 10, marginLeft: 4 }}>
                            (ask: ${Number(comparison.targetNoAsk).toFixed(2)})
                          </span>
                        )}
                        {comparison.bestNoPlatform === targetPlatform && <BestTag />}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {comparison.bestYesPlatform === targetPlatform ? (
                          <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                            Cheaper YES
                          </span>
                        ) : comparison.bestNoPlatform === targetPlatform ? (
                          <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                            Cheaper NO
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Target market info */}
              {(match.targetTitle || match.targetEvent) && (
                <div style={{
                  marginTop: 12, padding: "8px 12px", borderRadius: 6,
                  background: "rgba(255,255,255,0.02)", fontSize: 12, color: "var(--text-dim)",
                }}>
                  {targetPlatform} market: <span style={{ color: "var(--text-muted)" }}>
                    {match.targetEvent || match.targetTitle}
                  </span>
                  {match.targetTicker && (
                    <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
                      ({match.targetTicker})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Arbitrage Panel */}
          {match?.found && comparison && arbitrage && (
            <ArbitragePanel
              arbitrage={arbitrage}
              basePlatform={basePlatform}
              targetPlatform={targetPlatform}
            />
          )}

          {/* No match */}
          {match && !match.found && similarMarkets.length === 0 && (
            <div style={{
              padding: 16, fontSize: 13, color: "var(--text-dim)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div>No matching market found on {targetPlatform}. This bet may be unique to {basePlatform}.</div>
              {result.searchTerms && (
                <div style={{
                  fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)",
                  padding: "8px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)",
                }}>
                  Searched for: {result.searchTerms.primary_keywords?.join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Similar markets */}
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
                        {m.title}
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
                    {m.ticker && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                        {m.ticker}
                      </div>
                    )}
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

// --- Arbitrage Panel ---

function ArbitragePanel({ arbitrage, basePlatform, targetPlatform }) {
  const [open, setOpen] = useState(true);

  const grossCents = (arbitrage.grossProfit * 100).toFixed(1);
  const netCents = (arbitrage.netProfit * 100).toFixed(1);
  const feesCents = (arbitrage.totalFees * 100).toFixed(2);
  const totalCostCents = (arbitrage.bestComboTotal * 100).toFixed(1);
  const yesP = arbitrage.buyYesPrice * 100;
  const noP = arbitrage.buyNoPrice * 100;

  const isProfit = arbitrage.detected;
  const grossPositive = arbitrage.grossProfit > 0;

  // Single-side savings
  const priceDiffCents = Math.abs(yesP - noP) > 0.5 ? Math.abs(yesP - noP) : 0;

  const buttonBg = isProfit
    ? "rgba(0,212,170,0.06)"
    : grossPositive
      ? "rgba(255,170,0,0.04)"
      : "rgba(255,255,255,0.02)";
  const buttonBorder = isProfit
    ? "rgba(0,212,170,0.15)"
    : grossPositive
      ? "rgba(255,170,0,0.1)"
      : "var(--border-subtle)";

  return (
    <div style={{ margin: "0 16px 16px" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: open ? "8px 8px 0 0" : 8,
          background: buttonBg, border: `1px solid ${buttonBorder}`,
          cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
          color: "var(--text-primary)", fontSize: 13, fontWeight: 600,
          fontFamily: "var(--font-body)", textAlign: "left",
        }}
      >
        <span>
          Arbitrage Analysis
          {isProfit && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
              +{netCents}¢ net profit per share
            </span>
          )}
          {!isProfit && grossPositive && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "var(--warning)", fontFamily: "var(--font-mono)" }}>
              {grossCents}¢ spread (fees eat profit)
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          padding: "16px 18px", background: "rgba(255,255,255,0.02)",
          borderRadius: "0 0 8px 8px", border: `1px solid ${buttonBorder}`, borderTop: "none",
        }}>
          {/* Step 1: The Spread */}
          <StepLabel>Step 1 — The Spread</StepLabel>
          <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, marginBottom: 12 }}>
            Buy <strong>YES</strong> on <strong style={{ color: "var(--accent)" }}>{arbitrage.buyYesPlatform}</strong> at{" "}
            <strong>{yesP.toFixed(1)}¢</strong> + Buy <strong>NO</strong> on{" "}
            <strong style={{ color: "var(--accent)" }}>{arbitrage.buyNoPlatform}</strong> at{" "}
            <strong>{noP.toFixed(1)}¢</strong>
          </div>
          <div style={{
            fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", marginBottom: 16,
          }}>
            Total cost: <strong>{totalCostCents}¢</strong> → Payout: <strong>100¢</strong> →{" "}
            Gross profit:{" "}
            <span style={{ color: grossPositive ? "var(--accent)" : "var(--negative)", fontWeight: 600 }}>
              {grossPositive ? "+" : ""}{grossCents}¢
              {grossPositive && ` (${((arbitrage.grossProfit / arbitrage.bestComboTotal) * 100).toFixed(1)}%)`}
            </span>
          </div>

          {/* Step 2: Fees */}
          <StepLabel>Step 2 — Fees</StepLabel>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 4 }}>
            <div style={{ marginBottom: 3 }}>
              Polymarket taker fee (~4%): ~{(arbitrage.totalFees * 50).toFixed(2)}¢ est.
            </div>
            <div style={{ marginBottom: 3 }}>
              Kalshi taker fee (~7%): ~{(arbitrage.totalFees * 50).toFixed(2)}¢ est.
            </div>
          </div>
          <div style={{
            marginTop: 8, marginBottom: 16, fontSize: 13, fontFamily: "var(--font-mono)",
            fontWeight: 500, color: "var(--text-primary)",
          }}>
            Total fees: ~{feesCents}¢ → After fees:{" "}
            <span style={{ color: isProfit ? "var(--accent)" : "var(--negative)", fontWeight: 700 }}>
              {arbitrage.netProfit > 0 ? "+" : ""}{netCents}¢{!isProfit && " (negative)"}
            </span>
          </div>

          {/* Step 3: Reality Check */}
          <StepLabel>Step 3 — Reality Check</StepLabel>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 16 }}>
            {isProfit
              ? `With ${netCents}¢ net profit per share, a $1,000 position yields ~$${arbitrage.profitOn1000} guaranteed. However, capital is locked until resolution and bots close these gaps in milliseconds.`
              : `Fees eliminate the profit (${netCents}¢ net). This is common — prediction market spreads are thin and fees eat the margin.`}
            {" "}Kalshi also pays <strong style={{ color: "var(--human-blue)" }}>3.25% APY</strong> on locked collateral.
          </div>

          {/* Practical Takeaway */}
          <div style={{
            padding: "12px 14px", borderRadius: 6, background: "rgba(0,0,0,0.2)",
            border: "1px solid var(--border-subtle)",
          }}>
            <div style={{
              fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
              color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.07em",
              marginBottom: 6,
            }}>
              Practical Takeaway
            </div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>
              {isProfit ? (
                <>
                  Arbitrage opportunity detected: buy YES on{" "}
                  <strong style={{ color: "var(--accent)" }}>{arbitrage.buyYesPlatform}</strong> +
                  NO on <strong style={{ color: "var(--accent)" }}>{arbitrage.buyNoPlatform}</strong>.
                  Net profit: <strong>{netCents}¢/share</strong> (~${arbitrage.profitOn1000} on $1,000).
                  Act fast — these spreads close quickly.
                </>
              ) : priceDiffCents > 0.5 ? (
                <>
                  No arbitrage, but prices differ. Buy YES on the cheaper platform to save{" "}
                  <strong>{priceDiffCents.toFixed(1)}¢/share</strong>.
                </>
              ) : (
                "Prices are essentially identical across platforms. Trade wherever is most convenient."
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StepLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
      color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em",
      marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

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

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}
