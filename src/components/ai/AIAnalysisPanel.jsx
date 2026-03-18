import { useState, useEffect } from "react";
import { analyzeMarket } from "../../utils/aiAgent";
import { parseOutcomePrices, formatVolume } from "../../utils/format";
import DataBadge from "../shared/DataBadge";

export default function AIAnalysisPanel({ market, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const { yes, no } = parseOutcomePrices(market);
  const yesPct = Math.round(yes * 100);
  const noPct = Math.round(no * 100);

  useEffect(() => {
    runAnalysis();
  }, [market]);

  async function runAnalysis() {
    setLoading(true);
    setAnalysis(null);
    const result = await analyzeMarket(
      market,
      yesPct,
      noPct,
      market.volume24hr || market.volume || 0,
      market.liquidity || 0
    );
    setAnalysis(result);
    setLoading(false);
  }

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, 250);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={closing ? "" : "animate-fade-in"}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 2000,
          opacity: closing ? 0 : 1,
          transition: "opacity 0.25s",
        }}
      />

      {/* Panel */}
      <div
        className={closing ? "slide-panel-exit" : "slide-panel-enter"}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 520,
          maxWidth: "100vw",
          background: "var(--bg-primary)",
          borderLeft: "1px solid var(--border-subtle)",
          zIndex: 2001,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🧠</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>
              AI Market Analysis
            </span>
            {analysis && (
              <DataBadge status={analysis.isDemo ? "demo" : "live"} label={analysis.isDemo ? "SIMULATED" : "AI + WEB SEARCH"} />
            )}
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 18,
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {/* Market question */}
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              fontWeight: 600,
              lineHeight: 1.4,
              marginBottom: 20,
              color: "var(--text-primary)",
            }}
          >
            {market.question}
          </h3>

          {/* Polymarket Price — always shown, this is REAL data */}
          <div
            style={{
              padding: 20,
              background: "var(--bg-surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Polymarket Price
              <DataBadge status="live" label="LIVE" />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
              <div>
                <span
                  style={{
                    fontSize: 36,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  {yesPct}%
                </span>
                <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 6 }}>YES</span>
              </div>
              <div style={{ width: 1, height: 30, background: "var(--border-subtle)" }} />
              <div>
                <span
                  style={{
                    fontSize: 20,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color: "var(--negative)",
                  }}
                >
                  {noPct}%
                </span>
                <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 6 }}>NO</span>
              </div>
              {(market.volume24hr || market.volume) && (
                <>
                  <div style={{ width: 1, height: 30, background: "var(--border-subtle)" }} />
                  <div>
                    <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                      {formatVolume(market.volume24hr || market.volume)}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>24h vol</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <LoadingState />
          ) : analysis ? (
            <AnalysisContent analysis={analysis} />
          ) : null}
        </div>

        {/* Disclaimer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-body)",
            flexShrink: 0,
          }}
        >
          ⚠️ Educational purposes only. Not financial advice. Polymarket prices are real-time from the Gamma API.
        </div>
      </div>
    </>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 20 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "3px solid var(--border-subtle)",
          borderTopColor: "var(--bot-purple)",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
          Agent analyzing with web search...
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 280, lineHeight: 1.5 }}>
          Searching for recent news and evaluating market data
        </p>
      </div>
    </div>
  );
}

function AnalysisContent({ analysis }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
      {/* Summary */}
      {analysis.summary && (
        <div>
          <h4 style={sectionHeaderStyle}>Summary</h4>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
            {analysis.summary}
          </p>
        </div>
      )}

      {/* Key Factors */}
      {analysis.factors && analysis.factors.length > 0 && (
        <div>
          <h4 style={sectionHeaderStyle}>Key Factors</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analysis.factors.map((factor, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 16px",
                  background: "var(--bg-surface)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  animation: `slideInRight 0.3s var(--ease-out) ${i * 80}ms both`,
                }}
              >
                <span style={{ fontSize: 14, color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }}>
                  {i + 1}.
                </span>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  {factor}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Assessment */}
      {analysis.assessment && (
        <div>
          <h4 style={sectionHeaderStyle}>Price Assessment</h4>
          <div
            style={{
              padding: "16px 20px",
              background: "rgba(139,92,246,0.05)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(139,92,246,0.12)",
            }}
          >
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)", margin: 0, whiteSpace: "pre-line" }}>
              {analysis.assessment}
            </p>
          </div>
        </div>
      )}

      {/* Web Search Citations */}
      {analysis.citations && analysis.citations.length > 0 && (
        <div>
          <h4 style={sectionHeaderStyle}>Sources</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {analysis.citations.map((cite, i) => (
              <a
                key={i}
                href={cite.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "var(--bg-surface)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: 12,
                  color: "var(--accent)",
                  textDecoration: "none",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
              >
                <span style={{ fontSize: 12 }}>🔗</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cite.title}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const sectionHeaderStyle = {
  fontFamily: "var(--font-display)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 10,
};
