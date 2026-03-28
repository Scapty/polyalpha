/**
 * DataBadge — Reusable data source indicator
 * Shows 🟢 LIVE / 🟡 CACHED / 🔴 DEMO with consistent styling
 */
export default function DataBadge({ status = "demo", label, style }) {
  const configs = {
    live: {
      color: "#00d4aa",
      bg: "rgba(0,212,170,0.10)",
      border: "rgba(0,212,170,0.25)",
      text: label || "LIVE",
      dot: "🟢",
    },
    cached: {
      color: "#ffaa00",
      bg: "rgba(255,170,0,0.10)",
      border: "rgba(255,170,0,0.25)",
      text: label || "CACHED",
      dot: "🟡",
    },
    demo: {
      color: "#ff4466",
      bg: "rgba(255,68,102,0.10)",
      border: "rgba(255,68,102,0.25)",
      text: label || "DEMO",
      dot: "🔴",
    },
  };

  const cfg = configs[status] || configs.demo;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 100,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        fontSize: 9,
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        color: cfg.color,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        lineHeight: 1.6,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span style={{ fontSize: 7, lineHeight: 1 }}>{cfg.dot}</span>
      {cfg.text}
    </span>
  );
}
