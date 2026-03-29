import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";

const tabs = [
  { id: "wallet-stalker", label: "Wallet Stalker", num: "01" },
  { id: "agent-tracker", label: "Agent Tracker", num: "02" },
  { id: "arbitrage-scanner", label: "Odds Analyzer", num: "03" },
];

const ACCENT = "#2DD4A8";

export default function Header({ activeTab, onTabChange, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const activeLabel = tabs.find((t) => t.id === activeTab)?.label || "Navigate";
  const activeNum = tabs.find((t) => t.id === activeTab)?.num || "";

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  return (
    <>
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: 56,
        background: "rgba(10, 10, 10, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(24px, 3vw, 48px)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500,
            letterSpacing: "-0.02em", textTransform: "uppercase",
          }}>
            <span style={{ color: "var(--text-primary)" }}>Dex</span>
            <span style={{ color: "var(--accent)" }}>io</span>
          </span>
        </div>

        {/* Nav trigger — dropdown */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 18px",
              background: menuOpen ? "rgba(45, 212, 168, 0.06)" : "transparent",
              border: menuOpen ? "1px solid rgba(45, 212, 168, 0.15)" : "1px solid transparent",
              borderRadius: 0,
              cursor: "pointer",
              transition: "all 200ms ease",
            }}
          >
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--accent)", letterSpacing: "0.08em",
            }}>
              {activeNum}
            </span>
            <span style={{
              fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 500,
              color: "var(--text-bright)", textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}>
              {activeLabel}
            </span>
            <motion.div
              animate={{ rotate: menuOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={14} color="var(--text-muted)" />
            </motion.div>
          </button>

          {/* Dropdown menu */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(10, 10, 10, 0.95)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid var(--border)",
                  padding: "16px 12px",
                  minWidth: 280,
                  transformOrigin: "top center",
                  zIndex: 1001,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {tabs.map((tab, index) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <motion.div
                        key={tab.id}
                        initial="initial"
                        whileHover="hover"
                        animate={isActive ? "hover" : "initial"}
                        onClick={() => { onTabChange(tab.id); setMenuOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          cursor: "pointer", padding: "10px 12px",
                          color: isActive ? ACCENT : "var(--text-primary)",
                          transition: "background 150ms ease",
                        }}
                        whileHover={{ backgroundColor: "rgba(45, 212, 168, 0.04)" }}
                      >
                        {/* Animated arrow */}
                        <motion.div
                          variants={{
                            initial: { x: "-100%", opacity: 0, color: "inherit" },
                            hover: { x: 0, opacity: 1, color: ACCENT },
                          }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          style={{ overflow: "hidden", flexShrink: 0, width: 20 }}
                        >
                          <ArrowRight strokeWidth={3} size={18} />
                        </motion.div>

                        {/* Number */}
                        <motion.span
                          variants={{
                            initial: { opacity: 0.3 },
                            hover: { opacity: 1, color: ACCENT },
                          }}
                          transition={{ duration: 0.25 }}
                          style={{
                            fontFamily: "var(--font-mono)", fontSize: 11,
                            letterSpacing: "0.08em", flexShrink: 0,
                          }}
                        >
                          {tab.num}
                        </motion.span>

                        {/* Label */}
                        <motion.span
                          variants={{
                            initial: { x: -24, color: "inherit" },
                            hover: { x: 0, color: ACCENT, skewX: -3 },
                          }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          style={{
                            fontFamily: "var(--font-display)", fontSize: 20,
                            fontWeight: 600, textTransform: "uppercase",
                            letterSpacing: "0.02em", whiteSpace: "nowrap",
                          }}
                        >
                          {tab.label}
                        </motion.span>
                      </motion.div>
                    );
                  })}
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right — minimal logout */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                padding: "6px 14px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 0,
                color: "var(--text-ghost)",
                fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 400,
                letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: "pointer", transition: "all 200ms var(--ease-out)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--text-muted)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-ghost)"; }}
            >
              Log out
            </button>
          )}
        </div>
      </header>

    </>
  );
}
