import { useState } from "react";
import { setApiKey, hasApiKey } from "../../utils/aiAgent";

export default function ApiKeyModal({ onClose, onSave }) {
  const [key, setKey] = useState("");

  const handleSave = () => {
    if (key.trim()) {
      setApiKey(key.trim());
      onSave?.();
      onClose();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-deep)",
          border: "1px solid var(--border)",
          borderRadius: 0,
          padding: 32,
          width: 420,
          maxWidth: "90vw",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, color: "var(--text-bright)", textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: 8 }}>
          Connect API
        </h3>
        <p style={{ fontSize: 13, fontFamily: "var(--font-body)", color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Enter your Anthropic API key to enable live analysis. Your key is stored locally in your browser.
        </p>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          style={{
            width: "100%",
            height: 48,
            padding: "0 16px",
            background: "var(--bg-deep)",
            border: "1px solid var(--border)",
            borderRadius: 0,
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            outline: "none",
            marginBottom: 20,
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--accent)";
            e.target.style.boxShadow = "0 0 20px var(--accent-glow)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--border)";
            e.target.style.boxShadow = "none";
          }}
          autoFocus
        />
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!key.trim()}>Save key</button>
        </div>
        {hasApiKey() && (
          <button
            onClick={() => { setApiKey(""); onSave?.(); onClose(); }}
            style={{
              marginTop: 16,
              background: "none",
              border: "none",
              color: "var(--red)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            Remove saved key
          </button>
        )}
      </div>
    </div>
  );
}
