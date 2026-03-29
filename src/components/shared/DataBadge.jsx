export default function DataBadge({ status = "demo", label, style }) {
  const configs = {
    live: {
      color: "var(--green)",
      bg: "var(--green-glow)",
      text: label || "LIVE",
    },
    cached: {
      color: "var(--warning)",
      bg: "var(--warning-dim)",
      text: label || "CACHED",
    },
    demo: {
      color: "var(--red)",
      bg: "var(--red-glow)",
      text: label || "DEMO",
    },
  };

  const cfg = configs[status] || configs.demo;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 0,
        background: cfg.bg,
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        color: cfg.color,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        lineHeight: 1.6,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {cfg.text}
    </span>
  );
}
