export default function BotScoreGauge({ score, classification }) {
  const radius = 80;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  // Color based on classification
  const color =
    classification === "Likely Bot" ? "#8b5cf6" :
    classification === "Likely Human" ? "#3b82f6" :
    classification === "Uncertain" ? "#ffaa00" :
    "var(--text-muted)";

  const glowColor =
    classification === "Likely Bot" ? "rgba(139, 92, 246, 0.3)" :
    classification === "Likely Human" ? "rgba(59, 130, 246, 0.3)" :
    "rgba(255, 170, 0, 0.3)";

  return (
    <div
      className="glass-card"
      style={{
        padding: 32,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ position: "relative", width: radius * 2 + stroke * 2, height: radius * 2 + stroke * 2 }}>
        <svg
          width={radius * 2 + stroke * 2}
          height={radius * 2 + stroke * 2}
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Background circle */}
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          {/* Progress arc */}
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 1s var(--ease-out)",
              filter: `drop-shadow(0 0 8px ${glowColor})`,
            }}
          />
        </svg>

        {/* Center content */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 42,
              fontWeight: 700,
              color,
              lineHeight: 1,
            }}
          >
            {score}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginTop: 4,
            }}
          >
            / 100
          </span>
        </div>
      </div>

      {/* Classification label */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 20px",
          background: `${color}15`,
          border: `1px solid ${color}30`,
          borderRadius: 100,
        }}
      >
        <span style={{ fontSize: 16 }}>
          {classification === "Likely Bot" ? "\uD83E\uDD16" : classification === "Likely Human" ? "\uD83D\uDC64" : "\u2753"}
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 700,
            color,
          }}
        >
          {classification}
        </span>
      </div>
    </div>
  );
}
