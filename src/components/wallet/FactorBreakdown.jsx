/**
 * FactorBreakdown — Factor bars (weighted scoring) or eliminatory badge + AI reasoning
 *
 * Props:
 *   classification  - "Bot" | "Human" | "Insufficient Data" | null
 *   reasoning       - AI explanation string
 *   keySignals      - string[]
 *   factors         - { speed, activity, volume, sizeUniformity, behavior } | null
 *   eliminatedBy    - string (rule label) | null
 *   metrics         - raw metrics object
 *   loading         - bool: AI call in progress
 *   usingFallback   - bool
 *   hasApiKey       - bool
 */

const FACTOR_ORDER = ["orderVolume", "tradingBehavior", "sizeUniformity", "activityPattern"];
const FACTOR_LABELS = {
  orderVolume:     "Trade Frequency",
  tradingBehavior: "Trading Behavior",
  sizeUniformity:  "Size Uniformity",
  activityPattern: "Activity Pattern",
};

function barColor(score) {
  if (score >= 65) return "var(--red, #ef4444)";
  if (score >= 40) return "var(--warning, #f59e0b)";
  return "var(--green, #10b981)";
}

export default function FactorBreakdown({
  classification,
  reasoning,
  keySignals,
  factors,
  eliminatedBy,
  metrics,
  loading,
  usingFallback,
  hasApiKey,
}) {
  const shimmer = {
    background:
      "linear-gradient(90deg, var(--bg-elevated) 25%, rgba(255,255,255,0.04) 50%, var(--bg-elevated) 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    borderRadius: 0,
  };

  return (
    <div
      style={{
        background: "var(--bg-deep)",
        border: "1px solid var(--border, rgba(255,255,255,0.06))",
        borderRadius: 0,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          AI Analysis
        </h3>
        {loading && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--accent-bright)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            Analyzing…
          </span>
        )}
        {usingFallback && !loading && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {hasApiKey ? "Fallback rules" : "Add API key for AI"}
          </span>
        )}
      </div>

      {/* ── Eliminatory badge ── */}
      {!loading && eliminatedBy && (
        <div
          style={{
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 0,
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--red, #ef4444)",
              marginBottom: 2,
            }}
          >
            Eliminated by hard rule
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            {eliminatedBy}
          </div>
        </div>
      )}

      {/* ── Factor bars ── */}
      {!loading && factors && !eliminatedBy && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              marginBottom: 2,
            }}
          >
            Scoring factors
          </div>
          {FACTOR_ORDER.map((key) => {
            const f = factors[key];
            if (!f) return null;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Label */}
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    width: 120,
                    flexShrink: 0,
                  }}
                >
                  {FACTOR_LABELS[key]}
                </span>
                {/* Bar */}
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 0,
                    background: "var(--bg-elevated)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${f.score}%`,
                      height: "100%",
                      background: barColor(f.score),
                      borderRadius: 0,
                      transition: "width 400ms ease",
                    }}
                  />
                </div>
                {/* Score */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: barColor(f.score),
                    width: 44,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {f.score}/100
                </span>
                {/* Value */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-ghost)",
                    width: 100,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {f.value}
                </span>
                {/* Weight */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-ghost)",
                    width: 28,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {f.weight}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Shimmer for factors while loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[90, 75, 82, 60, 70].map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ ...shimmer, height: 10, width: 120, flexShrink: 0 }} />
              <div style={{ ...shimmer, height: 6, flex: 1 }} />
              <div style={{ ...shimmer, height: 10, width: 44, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}

      {/* ── AI Reasoning ── */}
      <div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ ...shimmer, height: 14, width: "90%" }} />
            <div style={{ ...shimmer, height: 14, width: "75%" }} />
            <div style={{ ...shimmer, height: 14, width: "82%" }} />
          </div>
        ) : reasoning ? (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.65,
              margin: 0,
              fontStyle: "italic",
            }}
          >
            "{reasoning}"
          </p>
        ) : (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {hasApiKey
              ? "Classification unavailable"
              : "Set your Anthropic API key in the header to get AI-powered analysis."}
          </p>
        )}
      </div>

      {/* ── Key signals ── */}
      {(loading || (keySignals && keySignals.length > 0)) && (
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            Key signals
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ ...shimmer, height: 12, width: "60%" }} />
              <div style={{ ...shimmer, height: 12, width: "45%" }} />
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {keySignals.map((signal, i) => (
                <li
                  key={i}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "var(--accent-bright)", marginTop: 1, flexShrink: 0 }}>·</span>
                  {signal}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Raw metrics grid ── */}
      {metrics && !metrics.insufficient && (
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            Trading metrics
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
            {[
              { label: "Fills", value: metrics.apiCapReached ? `${metrics.tradeCount}+` : metrics.tradeCount },
              { label: "Est. orders", value: `${metrics.estimatedOrders} (${metrics.estimatedOrdersPerDay}/day)` },
              { label: "Unique markets", value: metrics.totalUniqueMarkets },
              { label: "Size CV", value: metrics.sizeCV ?? "N/A" },
              { label: "Sleep gap", value: `${metrics.maxSleepGapHours}h` },
              { label: "Avg hrs/day", value: `${metrics.avgHoursPerDay}` },
              { label: "Both-sides", value: `${metrics.bothSidesPct}%` },
              { label: "ST crypto", value: `${metrics.shortTermCryptoPct}%` },
              metrics.winRate !== null
                ? { label: "Win rate", value: `${metrics.winRate}%` }
                : null,
            ]
              .filter(Boolean)
              .map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)" }}>
                    {label}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {value}
                  </span>
                </div>
              ))}
          </div>

          {metrics.categories && Object.keys(metrics.categories).length > 0 && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(metrics.categories)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([cat, pct]) => (
                  <span
                    key={cat}
                    style={{
                      padding: "3px 10px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 0,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {cat} {pct}%
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
