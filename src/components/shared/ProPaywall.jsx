import { motion } from "framer-motion";
import { Lock, Crown, Sparkles } from "lucide-react";

const ACCENT = "#2DD4A8";
const GOLD = "#F5A623";

/**
 * Wraps children in a blurred overlay with an upgrade prompt.
 *
 * Props:
 *  - locked: boolean — if true, shows the paywall overlay
 *  - requiredPlan: "pro" | "elite"
 *  - featureName: string — what feature is locked (e.g. "Copy Trading Simulator")
 *  - onUpgrade: () => void — opens pricing modal
 *  - children: the content to blur
 *  - blurAmount: number (default 6)
 */
export default function ProPaywall({
  locked,
  requiredPlan = "pro",
  featureName = "This feature",
  onUpgrade,
  children,
  blurAmount = 6,
}) {
  if (!locked) return children;

  const isElite = requiredPlan === "elite";
  const color = isElite ? GOLD : ACCENT;
  const Icon = isElite ? Sparkles : Crown;
  const planLabel = isElite ? "Elite" : "Pro";

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* Blurred content */}
      <div
        style={{
          filter: `blur(${blurAmount}px)`,
          pointerEvents: "none",
          userSelect: "none",
          opacity: 0.5,
        }}
      >
        {children}
      </div>

      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(10, 10, 10, 0.65)",
          zIndex: 10,
          gap: 12,
        }}
      >
        {/* Lock icon */}
        <div style={{
          width: 48, height: 48,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${color}`,
          background: `rgba(${isElite ? "245,166,35" : "45,212,168"}, 0.08)`,
        }}>
          <Icon size={22} color={color} />
        </div>

        {/* Text */}
        <div style={{ textAlign: "center" }}>
          <p style={{
            fontFamily: "var(--font-display)", fontSize: 16,
            fontWeight: 600, color: "var(--text-primary)",
            marginBottom: 4,
          }}>
            {featureName}
          </p>
          <p style={{
            fontSize: 12, color: "var(--text-secondary)",
            fontFamily: "var(--font-body)",
          }}>
            Available on the <span style={{ color, fontWeight: 600 }}>{planLabel}</span> plan
          </p>
        </div>

        {/* Upgrade button */}
        <button
          onClick={onUpgrade}
          style={{
            marginTop: 4,
            padding: "10px 28px",
            background: color,
            border: "none",
            color: "#000",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
            transition: "all 200ms ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Upgrade to {planLabel}
        </button>

        {/* Badge */}
        <span style={{
          fontSize: 9, fontFamily: "var(--font-mono)",
          color: "var(--text-ghost)", letterSpacing: "0.08em",
          textTransform: "uppercase", marginTop: 2,
        }}>
          {isElite ? "$49/mo" : "$19/mo"} · Cancel anytime
        </span>
      </motion.div>
    </div>
  );
}
