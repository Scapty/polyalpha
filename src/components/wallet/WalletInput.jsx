import { famousWallets } from "../../data/famousWallets";

export default function WalletInput({ address, onAddressChange, onSubmit, loading }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Input row */}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <svg
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.3 }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
            <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
          </svg>
          <input
            type="text"
            placeholder="Paste a Polymarket wallet address (0x...)"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && address.trim() && onSubmit()}
            style={{
              width: "100%",
              padding: "12px 14px 12px 42px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
          />
        </div>
        <button
          className="btn-primary"
          onClick={onSubmit}
          disabled={!address.trim() || loading}
          style={{ padding: "12px 24px", whiteSpace: "nowrap" }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "2px solid rgba(0,0,0,0.2)",
                  borderTopColor: "#0a0b0d",
                  animation: "spin 0.6s linear infinite",
                }}
              />
              Scanning...
            </span>
          ) : (
            "Analyze Wallet"
          )}
        </button>
      </div>

      {/* Famous wallets */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          Famous Wallets
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {famousWallets.map((w) => (
            <button
              key={w.address}
              onClick={() => {
                onAddressChange(w.address);
                // Auto-submit after brief delay for UX
                setTimeout(() => onSubmit(w.address), 100);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: w.type === "Bot" ? "rgba(139,92,246,0.06)" : "rgba(59,130,246,0.06)",
                border: `1px solid ${w.type === "Bot" ? "rgba(139,92,246,0.15)" : "rgba(59,130,246,0.15)"}`,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                transition: "all 0.2s var(--ease-out)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = w.type === "Bot" ? "rgba(139,92,246,0.12)" : "rgba(59,130,246,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = w.type === "Bot" ? "rgba(139,92,246,0.06)" : "rgba(59,130,246,0.06)";
              }}
            >
              <span style={{ fontSize: 12 }}>
                {w.type === "Bot" ? "🤖" : "👤"}
              </span>
              <div style={{ textAlign: "left" }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: w.type === "Bot" ? "var(--bot-purple)" : "var(--human-blue)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {w.label}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                  {w.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
