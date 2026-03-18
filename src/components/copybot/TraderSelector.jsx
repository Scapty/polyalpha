import { leaderboardData } from "../../data/mockTraders";
import { formatUSD } from "../../utils/format";

export default function TraderSelector({ selectedTrader, onSelect }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12,
        }}
      >
        Select a Trader to Copy
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {leaderboardData.map((trader) => {
          const isSelected = selectedTrader?.name === trader.name;
          const isBot = trader.type === "Bot";
          const borderColor = isSelected
            ? "var(--accent)"
            : isBot ? "rgba(139,92,246,0.15)" : "rgba(59,130,246,0.15)";

          return (
            <button
              key={trader.name}
              onClick={() => onSelect(trader)}
              style={{
                padding: "14px 16px",
                background: isSelected ? "rgba(0,212,170,0.06)" : "var(--bg-surface)",
                border: `1px solid ${borderColor}`,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                transition: "all 0.2s var(--ease-out)",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = borderColor;
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{trader.avatar}</span>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {trader.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {trader.strategy}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>P&L</div>
                  <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)" }}>
                    {formatUSD(trader.pnl)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>Win%</div>
                  <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: isBot ? "#8b5cf6" : "#3b82f6" }}>
                    {trader.winRate}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>Type</div>
                  <span className={`badge ${isBot ? "badge-purple" : "badge-blue"}`} style={{ fontSize: 9 }}>
                    {trader.type}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
