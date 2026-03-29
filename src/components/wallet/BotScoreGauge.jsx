export default function BotScoreGauge({ score, classification, confidence, strategy }) {
  const radius = 70;
  const stroke = 10;
  const svgWidth = radius * 2 + stroke * 2;
  const svgHeight = radius + stroke * 2 + 10;
  const cx = radius + stroke;
  const cy = radius + stroke;

  const displayScore = score ?? 0;
  const halfCircumference = Math.PI * radius;
  const progress = (displayScore / 100) * halfCircumference;

  const isBot = classification === "Bot";
  const isHuman = classification === "Human";

  const color = isBot ? "var(--purple)" : isHuman ? "var(--blue)" : "var(--text-muted)";
  const pillBg = isBot ? "rgba(139,92,246,0.12)" : isHuman ? "rgba(59,130,246,0.12)" : "var(--bg-elevated, #1A1A24)";
  const pillColor = isBot ? "var(--purple)" : isHuman ? "var(--blue)" : "var(--text-muted, #555568)";

  const lowColor = "#3B82F6";
  const midColor = "#8B5CF6";
  const highColor = "#EF4444";

  let stopColor1, stopColor2;
  if (displayScore < 40) { stopColor1 = lowColor; stopColor2 = midColor; }
  else if (displayScore < 70) { stopColor1 = midColor; stopColor2 = midColor; }
  else { stopColor1 = midColor; stopColor2 = highColor; }

  const gradientId = "gaugeGradient";

  return (
    <div
      style={{
        background: "var(--bg-deep)",
        border: "1px solid var(--border)",
        borderRadius: 0,
        padding: 32,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ position: "relative", width: svgWidth, height: svgHeight }}>
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={stopColor1} />
              <stop offset="100%" stopColor={stopColor2} />
            </linearGradient>
          </defs>
          <path
            d={`M ${stroke} ${cy} A ${radius} ${radius} 0 0 1 ${svgWidth - stroke} ${cy}`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M ${stroke} ${cy} A ${radius} ${radius} 0 0 1 ${svgWidth - stroke} ${cy}`}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={halfCircumference}
            strokeDashoffset={halfCircumference - progress}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 0, right: 0, bottom: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 56,
              fontWeight: 700,
              color: "var(--text-primary, #F0F0F5)",
              lineHeight: 1,
            }}
          >
            {score !== null && score !== undefined ? score : "—"}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 11,
              color: "var(--text-muted, #555568)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginTop: 4,
            }}
          >
            / 100
          </span>
        </div>
      </div>

      {/* Classification pill */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 16px",
          background: pillBg,
          borderRadius: 0,
          fontFamily: "var(--font-body, 'Inter', sans-serif)",
          fontSize: 13,
          fontWeight: 600,
          color: pillColor,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        {classification || "Analyzing…"}
      </span>

      {confidence != null && confidence > 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-secondary)",
            textAlign: "center",
          }}
        >
          {confidence}% confidence
        </div>
      )}

      {strategy && strategy !== "unknown" && (
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "center",
            fontStyle: "italic",
            maxWidth: 200,
            lineHeight: 1.4,
          }}
        >
          {strategy}
        </div>
      )}
    </div>
  );
}
