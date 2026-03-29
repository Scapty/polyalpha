export default function WalletInput({ address, onAddressChange, onSubmit, loading }) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        placeholder="Paste a Polymarket wallet address (0x...)"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && address.trim() && onSubmit()}
        style={{
          width: "100%",
          height: 56,
          padding: "0 160px 0 20px",
          background: "var(--bg-deep)",
          border: "1px solid var(--border)",
          borderRadius: 0,
          color: "var(--text-primary)",
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          outline: "none",
          transition: "border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out)",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--accent)";
          e.target.style.boxShadow = "0 0 0 1px var(--accent)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--border)";
          e.target.style.boxShadow = "none";
        }}
      />
      <button
        className="btn-primary"
        onClick={onSubmit}
        disabled={!address.trim() || loading}
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          height: 48,
          padding: "0 28px",
          whiteSpace: "nowrap",
        }}
      >
        {loading ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 14, height: 14, borderRadius: "50%",
              border: "2px solid rgba(10,10,10,0.2)",
              borderTopColor: "var(--bg-void)",
              animation: "spin 0.6s linear infinite",
            }} />
            Scanning
          </span>
        ) : (
          "Analyze"
        )}
      </button>
    </div>
  );
}
