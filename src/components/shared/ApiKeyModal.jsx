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
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: 32,
          width: 440,
          maxWidth: "90vw",
        }}
      >
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          Connect Claude API
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Enter your Anthropic API key to enable live AI analysis. Without a key, the app will use simulated analysis.
          Your key is stored locally in your browser.
        </p>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "var(--bg-primary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            outline: "none",
            marginBottom: 20,
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
          autoFocus
        />
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!key.trim()}>Save Key</button>
        </div>
        {hasApiKey() && (
          <button
            onClick={() => { setApiKey(""); onSave?.(); onClose(); }}
            style={{
              marginTop: 16,
              background: "none",
              border: "none",
              color: "var(--negative)",
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
