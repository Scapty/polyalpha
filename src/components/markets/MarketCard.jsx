import { parseOutcomePrices, formatVolume } from "../../utils/format";
import { getMarketCategory } from "../../utils/api";

export default function MarketCard({ market, index, onAnalyze }) {
  const { yes, no } = parseOutcomePrices(market);
  const yesPct = Math.round(yes * 100);
  const noPct = Math.round(no * 100);
  const volume = market.volume24hr || market.volume || 0;
  const category = getMarketCategory(market);
  const isHighConviction = yesPct > 75 || yesPct < 25;

  return (
    <div
      className="glass-card"
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        animationDelay: `${index * 40}ms`,
        animation: "fadeInUp 0.5s var(--ease-out) both",
      }}
    >
      {/* Top row: category + badges */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {category}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {isHighConviction && (
            <span className="badge badge-yellow" style={{ fontSize: 10 }}>HIGH CONVICTION</span>
          )}
        </div>
      </div>

      {/* Question */}
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.45,
          color: "var(--text-primary)",
          minHeight: 44,
        }}
      >
        {market.question}
      </h3>

      {/* Prices */}
      <div style={{ display: "flex", gap: 12 }}>
        <div
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "rgba(0, 212, 170, 0.06)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(0, 212, 170, 0.1)",
          }}
        >
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Yes
          </div>
          <div style={{ fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent)" }}>
            {yesPct}¢
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "rgba(255, 68, 102, 0.06)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(255, 68, 102, 0.1)",
          }}
        >
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            No
          </div>
          <div style={{ fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--negative)" }}>
            {noPct}¢
          </div>
        </div>
      </div>

      {/* Probability bar */}
      <div className="prob-bar">
        <div
          className="prob-bar-fill"
          style={{
            width: `${yesPct}%`,
            background: `linear-gradient(90deg, var(--accent), ${yesPct > 50 ? "rgba(0,212,170,0.5)" : "rgba(255,68,102,0.5)"})`,
          }}
        />
      </div>

      {/* Bottom row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
          Vol: {formatVolume(volume)}
        </span>
        <button
          onClick={() => onAnalyze(market)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            background: "rgba(139, 92, 246, 0.08)",
            border: "1px solid rgba(139, 92, 246, 0.15)",
            borderRadius: "var(--radius-sm)",
            color: "var(--bot-purple)",
            fontSize: 12,
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s var(--ease-out)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(139, 92, 246, 0.15)";
            e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(139, 92, 246, 0.08)";
            e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.15)";
          }}
        >
          🧠 AI Analyze
        </button>
      </div>
    </div>
  );
}
