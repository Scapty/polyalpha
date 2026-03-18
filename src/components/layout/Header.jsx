import { useState } from "react";
import { hasApiKey } from "../../utils/aiAgent";
import ApiKeyModal from "../shared/ApiKeyModal";

const tabs = [
  { id: "wallet-stalker", label: "Wallet Stalker" },
  { id: "bot-leaderboard", label: "Bot Leaderboard" },
  { id: "arbitrage-scanner", label: "Arbitrage Scanner" },
];

export default function Header({ activeTab, onTabChange }) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [hasKey, setHasKey] = useState(hasApiKey());

  return (
    <>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 60,
          background: "rgba(10, 11, 13, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-subtle)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, color: "var(--accent)", lineHeight: 1 }}>◈</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
            PolyAlpha
          </span>
        </div>

        {/* Tabs */}
        <nav style={{ display: "flex", gap: 4 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                position: "relative",
                padding: "8px 20px",
                background: activeTab === tab.id ? "rgba(255,255,255,0.05)" : "transparent",
                border: "none",
                borderRadius: "var(--radius-sm)",
                color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: 13.5,
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.2s var(--ease-out)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -1,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 20,
                    height: 2,
                    background: "var(--accent)",
                    borderRadius: 1,
                  }}
                />
              )}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setShowKeyModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: hasKey ? "var(--accent-dim)" : "transparent",
              border: `1px solid ${hasKey ? "rgba(0,212,170,0.15)" : "var(--border-subtle)"}`,
              borderRadius: "var(--radius-sm)",
              color: hasKey ? "var(--accent)" : "var(--text-muted)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: hasKey ? "var(--accent)" : "var(--text-muted)" }} />
            {hasKey ? "API Connected" : "Set API Key"}
          </button>
        </div>
      </header>

      {showKeyModal && (
        <ApiKeyModal
          onClose={() => setShowKeyModal(false)}
          onSave={() => setHasKey(hasApiKey())}
        />
      )}
    </>
  );
}
