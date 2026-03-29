import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import BracketButton from "../shared/BracketButton";

// ─── Animated Counter ─────────────────────────────────────────────────────────
function useCounter(target, duration = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const start = useCallback(() => setStarted(true), []);

  useEffect(() => {
    if (!started) return;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);

  return { count, start };
}

// ─── Intersection Observer hook ───────────────────────────────────────────────
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("revealed"); obs.unobserve(el); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Ticker Data ──────────────────────────────────────────────────────────────
const TICKER = [
  { m: "US Election 2028", p: "52.4%", d: "+2.1%", up: true },
  { m: "Fed Rate Cut June", p: "89.2%", d: "+0.8%", up: true },
  { m: "BTC > 150k EOY", p: "42.8%", d: "-3.2%", up: false },
  { m: "SpaceX IPO 2026", p: "18.5%", d: "+1.4%", up: true },
  { m: "AI Regulation EU", p: "73.1%", d: "-0.5%", up: false },
  { m: "Tesla $400", p: "55.7%", d: "+4.6%", up: true },
  { m: "Recession 2026", p: "31.2%", d: "-1.8%", up: false },
  { m: "Mars Mission 2028", p: "12.3%", d: "+0.3%", up: true },
];

// ─── Feature Data ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    label: "Wallet Stalker",
    title: "4-factor bot detection on any wallet",
    desc: "Paste any Polymarket address. Score trade frequency, trading behavior, size uniformity, and activity patterns to classify wallets instantly.",
    stat: { label: "Platforms supported", value: "Polymarket" },
  },
  {
    label: "Odds Analyzer",
    title: "Cross-platform price comparison",
    desc: "Compare identical markets across Polymarket and Kalshi. AI-powered semantic matching finds equivalent markets and highlights price differences.",
    stat: { label: "Platforms compared", value: "2" },
  },
  {
    label: "Agent Tracker",
    title: "AI agent monitoring and leaderboard analytics",
    desc: "Track AI agents and top traders on Polymarket. Analyze P&L, win rates, hold times, and trading categories across the leaderboard.",
    stat: { label: "Data source", value: "Polymarket API" },
  },
];

// ─── Details Data ─────────────────────────────────────────────────────────────
const DETAILS = [
  { t: "Sub-second scoring", d: "Bot analysis completes in under a second. No queues." },
  { t: "Semantic matching", d: "Cross-platform markets matched by meaning, not keywords." },
  { t: "Transparent factors", d: "Every bot score factor is visible and weighted. No black box." },
  { t: "Historical backtesting", d: "Copy trading simulations run on real past positions." },
  { t: "Activity heatmaps", d: "Trading patterns visualized down to the hour." },
];

// ═══════════════════════════════════════════════════════════════════════════════
export default function LandingPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  const wallets = useCounter(4, 1200);
  const trades = useCounter(2, 800);
  const platforms = useCounter(2, 800);

  const tickerRef = useReveal();
  const statsRef = useReveal();
  const featRef = useReveal();
  const howRef = useReveal();
  const detailRef = useReveal();
  const ctaRef = useReveal();

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Start counters when stats section is visible
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { wallets.start(); trades.start(); platforms.start(); obs.unobserve(el); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ position: "relative" }}>

      {/* ═══ HERO — 100vh split layout ═══ */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "0 clamp(24px, 5vw, 80px)",
        position: "relative",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          {/* Mono label */}
          <div className="section-label" style={{
            marginBottom: 24,
            opacity: ready ? 1 : 0, transform: ready ? "translateY(0)" : "translateY(10px)",
            transition: "all 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s",
          }}>
            Prediction Market Intelligence
          </div>

          {/* Hero headline — uppercase */}
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(42px, 7vw, 80px)",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
            lineHeight: 0.95,
            color: "var(--text-bright)",
            marginBottom: 32,
            maxWidth: 900,
            opacity: ready ? 1 : 0,
            transform: ready ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s",
          }}>
            Detect Bots.{" "}
            <span style={{ color: "var(--accent)" }}>Find Alpha.</span>
          </h1>

          {/* Sub-tagline */}
          <p style={{
            fontSize: "clamp(16px, 2vw, 20px)",
            color: "var(--text-secondary)",
            fontWeight: 400,
            lineHeight: 1.6,
            marginBottom: 48,
            maxWidth: 520,
            opacity: ready ? 1 : 0,
            transform: ready ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.6s cubic-bezier(0.16,1,0.3,1) 0.35s",
          }}>
            Cross-platform odds comparison, wallet scoring, and arbitrage
            detection for Polymarket and Kalshi.
          </p>

          {/* CTA row */}
          <div style={{
            display: "flex", gap: 20, alignItems: "center",
            opacity: ready ? 1 : 0,
            transform: ready ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.6s cubic-bezier(0.16,1,0.3,1) 0.5s",
          }}>
            <BracketButton onClick={() => navigate("/login")} arrow>
              Start Analyzing
            </BracketButton>
            <button className="btn-ghost" onClick={() => navigate("/signup")}
              style={{ height: 52, padding: "0 32px" }}>
              Create Account
            </button>
          </div>
        </div>

        {/* Scroll hint */}
        <div style={{
          position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
          opacity: ready ? 0.3 : 0, transition: "opacity 0.6s ease 2.5s",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            letterSpacing: "0.12em", color: "var(--text-muted)",
            textTransform: "uppercase",
          }}>
            Scroll to explore
          </span>
          <div style={{
            width: 1, height: 24,
            background: "var(--text-muted)",
            animation: "subtlePulse 2s ease-in-out infinite",
          }} />
        </div>
      </section>

      {/* ═══ Opaque wrapper — blocks particle field ═══ */}
      <div style={{ position: "relative", background: "var(--bg-void)" }}>

        {/* ═══ TICKER ═══ */}
        <section ref={tickerRef} style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-void)",
          padding: "16px 0", overflow: "hidden",
        }}>
          <div style={{
            display: "flex", gap: 56,
            animation: "tickerScroll 40s linear infinite",
            whiteSpace: "nowrap",
          }}>
            {[...TICKER, ...TICKER].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)", fontWeight: 400 }}>{t.m}</span>
                <span className="data-text" style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{t.p}</span>
                <span className="data-text" style={{ fontSize: 12, color: t.up ? "var(--green)" : "var(--red)" }}>{t.d}</span>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-ghost)", flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </section>

        {/* ═══ STATS ═══ */}
        <section ref={statsRef} className="landing-reveal" style={{
          padding: "80px 24px",
          background: "var(--bg-void)",
        }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32, textAlign: "center" }}>
            {[
              { n: String(wallets.count), l: "Analysis Tools" },
              { n: String(trades.count), l: "Platforms Connected" },
              { n: String(platforms.count), l: "Data Sources" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "24px 0", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
                <div className="data-text" style={{
                  fontSize: "clamp(32px, 5vw, 52px)",
                  fontWeight: 500, color: "var(--text-bright)",
                  letterSpacing: "-0.03em", lineHeight: 1,
                }}>
                  {s.n}
                </div>
                <div className="section-label" style={{ marginTop: 12, color: "var(--text-muted)" }}>
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ FEATURES — numbered sections ═══ */}
        <section ref={featRef} className="landing-reveal" style={{
          padding: "var(--space-section) 24px",
          background: "var(--bg-void)",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {/* Section header */}
            <div style={{ marginBottom: 80 }}>
              <span className="section-number">01</span>
              <h2 className="heading-section" style={{ marginTop: 12 }}>
                Core Tools
              </h2>
            </div>

            {/* Feature cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 2 }}>
              {FEATURES.map((f, i) => (
                <FeatureCard key={i} index={String(i + 1).padStart(2, "0")} {...f} />
              ))}
            </div>
          </div>
        </section>

        <hr className="separator" />

        {/* ═══ HOW IT WORKS ═══ */}
        <section ref={howRef} className="landing-reveal" style={{
          padding: "var(--space-section) 24px",
          background: "var(--bg-deep)",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "40px 80px", alignItems: "start" }}>
              {/* Left — heading */}
              <div>
                <span className="section-number">02</span>
                <h2 className="heading-section" style={{ marginTop: 12 }}>
                  How It Works
                </h2>
                <p style={{
                  fontSize: 16, color: "var(--text-secondary)",
                  lineHeight: 1.7, marginTop: 20, maxWidth: 460,
                }}>
                  From wallet address to trading edge in three steps.
                  No setup, no configuration, no API keys required.
                </p>
              </div>

              {/* Right — steps */}
              <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
                {[
                  { n: "01", t: "Paste a wallet address", d: "Enter any Polymarket wallet. We pull the full transaction history, position data, and trading activity from on-chain records." },
                  { n: "02", t: "Get the full analysis", d: "Bot score, activity heatmap, portfolio breakdown, and trading pattern analysis. Each factor is weighted and explained." },
                  { n: "03", t: "Find your edge", d: "Run the copy trading simulator against historical data. Compare odds across platforms with the arbitrage scanner." },
                ].map((s) => (
                  <div key={s.n} style={{ paddingLeft: 48, position: "relative" }}>
                    <span className="section-number" style={{
                      position: "absolute", left: 0, top: 2,
                    }}>
                      {s.n}
                    </span>
                    <h3 style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 18, fontWeight: 500, color: "var(--text-primary)",
                      textTransform: "uppercase", letterSpacing: "0.02em",
                      marginBottom: 8,
                    }}>
                      {s.t}
                    </h3>
                    <p style={{
                      fontSize: 15, color: "var(--text-muted)",
                      lineHeight: 1.7, maxWidth: 420,
                    }}>
                      {s.d}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <hr className="separator" />

        {/* ═══ DETAILS GRID ═══ */}
        <section ref={detailRef} className="landing-reveal" style={{
          padding: "var(--space-section) 24px",
          background: "var(--bg-void)",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ marginBottom: 64 }}>
              <span className="section-number">03</span>
              <h2 className="heading-section" style={{ marginTop: 12, maxWidth: 500 }}>
                Under the Hood
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 2 }}>
              {DETAILS.map((item, i) => (
                <div key={i} style={{
                  padding: "32px 28px",
                  background: "var(--bg-deep)",
                  borderRight: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                  transition: "background 200ms var(--ease-out)",
                  cursor: "default",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-deep)"; }}
                >
                  <h4 style={{
                    fontFamily: "var(--font-display)", fontSize: 15,
                    fontWeight: 500, color: "var(--text-primary)",
                    textTransform: "uppercase", letterSpacing: "0.02em",
                    marginBottom: 10,
                  }}>
                    {item.t}
                  </h4>
                  <p style={{
                    fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7,
                  }}>
                    {item.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr className="separator" />

        {/* ═══ CTA ═══ */}
        <section ref={ctaRef} className="landing-reveal" style={{
          padding: "120px 24px",
          background: "var(--bg-deep)",
          textAlign: "center",
        }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h2 className="heading-section" style={{ marginBottom: 20 }}>
              Start Analyzing
            </h2>
            <p style={{
              fontSize: 16, color: "var(--text-secondary)",
              lineHeight: 1.7, marginBottom: 48, maxWidth: 480, margin: "0 auto 48px",
            }}>
              No setup needed. Paste a wallet address or browse the odds analyzer.
              See what the market looks like when you know who is behind the trades.
            </p>
            <BracketButton onClick={() => navigate("/signup")} arrow>
              Create Free Account
            </BracketButton>
            <p className="section-label" style={{
              marginTop: 24, color: "var(--text-ghost)",
            }}>
              Free for academic research
            </p>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "48px clamp(24px, 5vw, 80px)",
          background: "var(--bg-void)",
        }}>
          <div style={{
            maxWidth: 1400, margin: "0 auto",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: "20px 40px",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src="/dexio-logo.svg" alt="Dexio" style={{ width: 24, height: 24 }} />
                <span style={{
                  fontFamily: "var(--font-display)", fontSize: 18,
                  fontWeight: 500, letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                }}>
                  <span style={{ color: "var(--text-primary)" }}>Dex</span>
                  <span style={{ color: "var(--accent)" }}>io</span>
                </span>
              </div>
              <div className="section-label" style={{ marginTop: 6, color: "var(--text-ghost)" }}>
                FNCE313 Group 7 / SMU Singapore
              </div>
            </div>
            <div style={{ display: "flex", gap: 32 }}>
              {["Polymarket", "Kalshi"].map((p) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)" }} />
                  <span className="data-text" style={{ fontSize: 12, color: "var(--text-muted)" }}>{p}</span>
                </div>
              ))}
            </div>
            <div className="section-label" style={{ color: "var(--text-ghost)" }}>
              React + Three.js + Vite
            </div>
          </div>
        </footer>

      </div>{/* end opaque wrapper */}
    </div>
  );
}

// ─── Feature Card — WQF style (no rounded corners, subtle) ──────────────────
function FeatureCard({ index, label, title, desc, stat }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--bg-surface)" : "var(--bg-deep)",
        borderRight: "1px solid var(--border)",
        padding: "40px 32px",
        position: "relative",
        transition: "background 300ms var(--ease-out)",
      }}
    >
      {/* Accent line on hover */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: 2,
        height: hovered ? "100%" : "0%",
        background: "var(--accent)",
        transition: "height 400ms var(--ease-smooth)",
      }} />

      {/* Index + Label */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 24 }}>
        <span className="section-number">{index}</span>
        <span className="section-label">{label}</span>
      </div>

      <h3 style={{
        fontFamily: "var(--font-display)",
        fontSize: 20, fontWeight: 500,
        color: "var(--text-primary)",
        textTransform: "uppercase",
        letterSpacing: "-0.01em",
        lineHeight: 1.2,
        marginBottom: 16,
      }}>
        {title}
      </h3>

      <p style={{
        fontSize: 15, color: "var(--text-muted)", lineHeight: 1.7,
        marginBottom: 24,
      }}>
        {desc}
      </p>

      {stat && (
        <div style={{
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
        }}>
          <span className="section-label" style={{ color: "var(--text-ghost)" }}>{stat.label}</span>
          <span className="data-text" style={{ fontSize: 14, color: "var(--accent)", fontWeight: 500 }}>{stat.value}</span>
        </div>
      )}
    </div>
  );
}
