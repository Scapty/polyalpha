import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Zap, Crown, Sparkles } from "lucide-react";

const ACCENT = "#2DD4A8";
const PURPLE = "#8B5CF6";
const GOLD = "#F5A623";

const tiers = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Zap,
    color: "var(--text-secondary)",
    borderColor: "var(--border)",
    features: [
      "1 wallet analysis per day",
      "Bot Leaderboard — top 5 traders",
      "Odds Analyzer — no alerts",
      "Basic bot vs human tags",
    ],
    cta: "Downgrade to Free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    period: "/month",
    icon: Crown,
    color: ACCENT,
    borderColor: ACCENT,
    popular: true,
    features: [
      "Unlimited wallet analyses",
      "Full leaderboard — top 50 traders",
      "Smart Money Alerts — track 5 wallets",
      "Copy Trading Simulator unlocked",
      "Trader accuracy scores",
      "Email alerts on key trades",
    ],
    cta: "Upgrade to Pro",
  },
  {
    id: "elite",
    name: "Elite",
    price: "$49",
    period: "/month",
    icon: Sparkles,
    color: GOLD,
    borderColor: GOLD,
    features: [
      "Everything in Pro, plus:",
      "Cross-platform arbitrage alerts",
      "Real-time Alpha Signals feed",
      "API access — 1,000 calls/day",
      "Priority bot detection engine",
      "Export data to CSV & Excel",
      "SMS + Telegram notifications",
    ],
    cta: "Upgrade to Elite",
  },
];

export default function PricingModal({ onClose, currentPlan, onSelectPlan }) {
  const [selected, setSelected] = useState(null);

  const planRank = { free: 0, pro: 1, elite: 2 };

  const handleSelect = (tierId) => {
    if (tierId === currentPlan) return;
    setSelected(tierId);
    onSelectPlan(tierId);
    setTimeout(() => onClose(), 600);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 2000,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--bg-void, #0A0A0A)",
            border: "1px solid var(--border)",
            maxWidth: 920,
            width: "100%",
            maxHeight: "90vh",
            overflow: "auto",
            padding: "40px 32px",
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", padding: 4,
            }}
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: ACCENT, letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}>
              Pricing
            </span>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: 32,
              fontWeight: 700, color: "var(--text-primary)",
              marginTop: 8, letterSpacing: "-0.02em",
            }}>
              Unlock the Full Alpha
            </h2>
            <p style={{
              fontSize: 14, color: "var(--text-secondary)",
              marginTop: 8, maxWidth: 460, margin: "8px auto 0",
            }}>
              Choose the plan that matches your trading edge. Upgrade or downgrade anytime.
            </p>
          </div>

          {/* Tier cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}>
            {tiers.map((tier) => {
              const Icon = tier.icon;
              const isCurrent = currentPlan === tier.id;
              const justSelected = selected === tier.id;

              return (
                <motion.div
                  key={tier.id}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: "relative",
                    background: "var(--bg-deep, #111)",
                    border: `1px solid ${tier.popular ? tier.borderColor : "var(--border)"}`,
                    padding: "28px 24px",
                    display: "flex", flexDirection: "column",
                    transition: "border-color 200ms ease",
                  }}
                >
                  {/* Popular badge */}
                  {tier.popular && (
                    <div style={{
                      position: "absolute", top: -1, left: "50%", transform: "translateX(-50%) translateY(-50%)",
                      background: ACCENT, color: "#000",
                      fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700,
                      padding: "3px 12px", letterSpacing: "0.1em", textTransform: "uppercase",
                    }}>
                      Most Popular
                    </div>
                  )}

                  {/* Icon + Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <Icon size={18} color={tier.color} />
                    <span style={{
                      fontFamily: "var(--font-display)", fontSize: 16,
                      fontWeight: 600, color: tier.color,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      {tier.name}
                    </span>
                  </div>

                  {/* Price */}
                  <div style={{ marginBottom: 24 }}>
                    <span style={{
                      fontFamily: "var(--font-display)", fontSize: 40,
                      fontWeight: 700, color: "var(--text-primary)",
                      letterSpacing: "-0.03em",
                    }}>
                      {tier.price}
                    </span>
                    <span style={{
                      fontSize: 14, color: "var(--text-muted)",
                      fontFamily: "var(--font-body)",
                    }}>
                      {tier.period}
                    </span>
                  </div>

                  {/* Features */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, marginBottom: 24 }}>
                    {tier.features.map((f) => (
                      <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <Check size={14} color={tier.color} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          {f}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  {(() => {
                    const isDowngrade = planRank[tier.id] < planRank[currentPlan];
                    const isUpgrade = planRank[tier.id] > planRank[currentPlan];
                    const ctaLabel = justSelected
                      ? (isDowngrade ? "✓ Downgraded" : "✓ Upgraded!")
                      : isCurrent
                        ? "Current Plan"
                        : isDowngrade
                          ? `Downgrade to ${tier.name}`
                          : tier.cta;
                    const isActive = !isCurrent;
                    const highlight = isActive && (tier.popular || isUpgrade);

                    return (
                      <button
                        onClick={() => handleSelect(tier.id)}
                        disabled={isCurrent}
                        style={{
                          width: "100%",
                          padding: "12px 0",
                          background: isCurrent
                            ? "transparent"
                            : justSelected
                              ? "rgba(45, 212, 168, 0.2)"
                              : highlight
                                ? ACCENT
                                : "transparent",
                          color: isCurrent
                            ? "var(--text-muted)"
                            : justSelected
                              ? ACCENT
                              : highlight
                                ? "#000"
                                : isDowngrade
                                  ? "var(--text-secondary)"
                                  : "var(--text-primary)",
                          border: isCurrent
                            ? "1px solid var(--border)"
                            : justSelected
                              ? `1px solid ${ACCENT}`
                              : highlight
                                ? `1px solid ${ACCENT}`
                                : "1px solid var(--border)",
                          fontSize: 12,
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          cursor: isCurrent ? "default" : "pointer",
                          transition: "all 200ms ease",
                        }}
                        onMouseEnter={(e) => {
                          if (isActive) {
                            e.currentTarget.style.background = highlight ? "#26c99a" : "rgba(255,255,255,0.04)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isActive) {
                            e.currentTarget.style.background = highlight ? ACCENT : "transparent";
                          }
                        }}
                      >
                        {ctaLabel}
                      </button>
                    );
                  })()}
                </motion.div>
              );
            })}
          </div>

          {/* Footer note */}
          <p style={{
            textAlign: "center", fontSize: 11, color: "var(--text-ghost)",
            fontFamily: "var(--font-mono)", marginTop: 24,
            letterSpacing: "0.04em",
          }}>
            Demo mode — no payment required. Select a plan to preview premium features.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
