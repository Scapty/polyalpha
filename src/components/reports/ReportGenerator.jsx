import { useState } from "react";

const reportTypes = [
  { id: "weekly", icon: "📊", label: "Weekly Market Pulse", desc: "Overview of the hottest markets, biggest movers, and consensus shifts" },
  { id: "deep", icon: "🎯", label: "Deep Dive", desc: "In-depth analysis of a single market or theme" },
  { id: "macro", icon: "🌍", label: "Macro Sentiment", desc: "What prediction markets say about the economy, geopolitics, and crypto" },
  { id: "bot", icon: "🤖", label: "Bot vs Human Alpha", desc: "Performance comparison and strategy analysis report" },
  { id: "custom", icon: "✏️", label: "Custom", desc: "Write your own prompt or angle" },
];

const tones = [
  "Professional / Bloomberg-style",
  "Conversational / Substack-style",
  "Academic / Research paper",
  "Executive Brief / C-suite",
];

const defaultSections = [
  "Market Overview & Key Numbers",
  "Biggest Movers",
  "AI Analysis & Edge Detection",
  "Bot vs Human Performance",
  "Key Risks & Watchlist",
  "Data Methodology Note",
];

export default function ReportGenerator({ onGenerate, markets, loading }) {
  const [reportType, setReportType] = useState("weekly");
  const [tone, setTone] = useState(tones[0]);
  const [sections, setSections] = useState([...defaultSections]);

  const toggleSection = (s) => {
    setSections((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleGenerate = () => {
    const type = reportTypes.find((r) => r.id === reportType);
    onGenerate({
      reportType: type?.label || "Weekly Market Pulse",
      tone,
      markets: markets.slice(0, 15),
      sections,
    });
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Intelligence Report Generator
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
          Generate professional, publishable prediction market intelligence reports powered by AI
        </p>
      </div>

      {/* Report Type */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ display: "block", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Report Type
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {reportTypes.map((rt) => (
            <button
              key={rt.id}
              onClick={() => setReportType(rt.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                background: reportType === rt.id ? "var(--accent-dim)" : "var(--bg-surface)",
                border: `1px solid ${reportType === rt.id ? "rgba(0,212,170,0.2)" : "var(--border-subtle)"}`,
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                transition: "all 0.2s var(--ease-out)",
                textAlign: "left",
                width: "100%",
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>{rt.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: reportType === rt.id ? "var(--accent)" : "var(--text-primary)", fontFamily: "var(--font-body)" }}>
                  {rt.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {rt.desc}
                </div>
              </div>
              {reportType === rt.id && (
                <span style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 16 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ display: "block", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Tone & Style
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tones.map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              style={{
                padding: "8px 18px",
                background: tone === t ? "var(--accent-dim)" : "transparent",
                border: `1px solid ${tone === t ? "rgba(0,212,170,0.2)" : "var(--border-subtle)"}`,
                borderRadius: 100,
                color: tone === t ? "var(--accent)" : "var(--text-muted)",
                fontSize: 12.5,
                fontFamily: "var(--font-body)",
                fontWeight: tone === t ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.2s var(--ease-out)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div style={{ marginBottom: 36 }}>
        <label style={{ display: "block", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Include Sections
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {defaultSections.map((s) => (
            <label
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "var(--bg-surface)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              <input
                type="checkbox"
                checked={sections.includes(s)}
                onChange={() => toggleSection(s)}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: "var(--accent)",
                  cursor: "pointer",
                }}
              />
              <span style={{ fontSize: 13, color: sections.includes(s) ? "var(--text-primary)" : "var(--text-muted)" }}>
                {s}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Data info */}
      <div
        style={{
          padding: "12px 16px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 14 }}>📈</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Using data from <strong style={{ color: "var(--text-secondary)" }}>{markets.length} active markets</strong> loaded in the Markets tab
        </span>
      </div>

      {/* Generate Button */}
      <button
        className="btn-primary"
        onClick={handleGenerate}
        disabled={loading || sections.length === 0}
        style={{ width: "100%", padding: "14px 24px", fontSize: 15, fontWeight: 700 }}
      >
        {loading ? (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#0a0b0d", animation: "spin 0.6s linear infinite" }} />
            Generating...
          </span>
        ) : (
          "Generate Report"
        )}
      </button>
    </div>
  );
}
