import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchTopTraders, fetchWalletTrades } from "../../utils/api";
import {
  analyzeTrader, computeAggregates,
  loadTrackerCache, saveTrackerCache,
  fmtPnl, fmtRoi,
} from "../../utils/agentTrackerEngine";
import SpotlightCard from "../shared/SpotlightCard";

// ── Constants ─────────────────────────────────────────────────────────────────

const TOP_N_OPTIONS = [10, 20, 50];
const PERIOD_OPTIONS = [
  { label: "7 days", value: "WEEK" },
  { label: "30 days", value: "MONTH" },
  { label: "All time", value: "ALL" },
];
// Maps UI labels → Polymarket leaderboard API category enum values
const CATEGORIES = [
  { label: "All", value: "OVERALL" },
  { label: "Crypto", value: "CRYPTO" },
  { label: "Politics", value: "POLITICS" },
  { label: "Economics", value: "ECONOMICS" },
  { label: "Sports", value: "SPORTS" },
  { label: "Culture", value: "CULTURE" },
  { label: "Tech", value: "TECH" },
  { label: "Finance", value: "FINANCE" },
];

const BOT_COLOR = "#8B5CF6";
const HUMAN_COLOR = "#3B82F6";
const BOT_DIM = "rgba(139,92,246,0.12)";
const HUMAN_DIM = "rgba(59,130,246,0.12)";

// ── Styles ────────────────────────────────────────────────────────────────────

const card = {
  background: "var(--bg-deep)",
  border: "1px solid var(--border)",
  borderRadius: 0,
  padding: 24,
};

const label = {
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 4,
};

const bigNum = {
  fontFamily: "var(--font-mono)",
  fontSize: 32,
  fontWeight: 700,
  color: "var(--text-primary)",
  lineHeight: 1,
};

const metricRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  padding: "10px 0",
  borderBottom: "1px solid var(--border)",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroCard({ title, value, sub, color }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 160 }}>
      <div style={label}>{title}</div>
      <div style={{ ...bigNum, color: color || "var(--text-primary)", marginTop: 8 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function MetricBlock({ title, botVal, humanVal, botColor, humanColor }) {
  return (
    <div style={metricRow}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{title}</span>
      <div style={{ display: "flex", gap: 32 }}>
        <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: botColor || BOT_COLOR, minWidth: 80, textAlign: "right" }}>
          {botVal}
        </span>
        <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: humanColor || HUMAN_COLOR, minWidth: 80, textAlign: "right" }}>
          {humanVal}
        </span>
      </div>
    </div>
  );
}

function SortHeader({ col, label: lbl, sortBy, sortDir, onSort }) {
  const active = sortBy === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: "10px 12px",
        textAlign: "left",
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        color: active ? "var(--text-secondary)" : "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        cursor: "pointer",
        whiteSpace: "nowrap",
        userSelect: "none",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {lbl} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentTracker() {
  const navigate = useNavigate();

  const [topN, setTopN] = useState(20);
  const [period, setPeriod] = useState("ALL");
  const [category, setCategory] = useState("OVERALL");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [traders, setTraders] = useState([]);
  const [lastScan, setLastScan] = useState(null);
  const [sortBy, setSortBy] = useState("pnl");
  const [sortDir, setSortDir] = useState("desc");
  const [error, setError] = useState(null);
  const [scannedCategory, setScannedCategory] = useState(null); // tracks which category was last scanned

  // Load cache on mount
  useEffect(() => {
    const cached = loadTrackerCache();
    if (cached) {
      setTraders(cached.traders);
      setLastScan(new Date(cached.timestamp));
    }
  }, []);

  // ── Scan ───────────────────────────────────────────────────────────────────

  const handleScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setProgress({ done: 0, total: topN });

    try {
      // 1. Fetch top traders from leaderboard (with category filter from API)
      const leaderboard = await fetchTopTraders(topN, period, category);
      if (!leaderboard || leaderboard.length === 0) {
        throw new Error("Leaderboard returned no traders.");
      }

      setProgress({ done: 0, total: leaderboard.length });

      // 2. Fetch trades for each wallet in parallel (batches of 5 to avoid rate limiting)
      const results = [];
      const BATCH = 5;
      for (let i = 0; i < leaderboard.length; i += BATCH) {
        const batch = leaderboard.slice(i, i + BATCH);
        const settled = await Promise.allSettled(
          batch.map(async (entry) => {
            const address = entry.proxyWallet;
            if (!address) return null;
            const { trades } = await fetchWalletTrades(address, 1000);
            const analyzed = analyzeTrader(address, trades, entry);
            return analyzed;
          })
        );
        for (const r of settled) {
          if (r.status === "fulfilled" && r.value) results.push(r.value);
        }
        setProgress({ done: Math.min(i + BATCH, leaderboard.length), total: leaderboard.length });
      }

      if (results.length === 0) throw new Error("Could not analyse any trader.");

      setTraders(results);
      const now = new Date();
      setLastScan(now);
      setScannedCategory(category);
      saveTrackerCache(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }, [topN, period, category]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label || "All";

  const aggregates = useMemo(
    () => computeAggregates(traders, categoryLabel),
    [traders, categoryLabel]
  );

  const sortedTraders = useMemo(() => {
    return [...traders].sort((a, b) => {
      const va = a[sortBy] ?? (sortDir === "asc" ? Infinity : -Infinity);
      const vb = b[sortBy] ?? (sortDir === "asc" ? Infinity : -Infinity);
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [traders, sortBy, sortDir]);

  function handleSort(col) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  }

  // ── Last scan label ─────────────────────────────────────────────────────────

  const lastScanLabel = useMemo(() => {
    if (!lastScan) return null;
    const mins = Math.round((Date.now() - lastScan.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    return `${Math.round(mins / 60)}hr ago`;
  }, [lastScan]);

  // ── PnL share bar ───────────────────────────────────────────────────────────

  const botPct = aggregates?.botPnlShare !== null && aggregates?.botPnlShare !== undefined
    ? Math.max(0, Math.min(100, Math.round(aggregates.botPnlShare * 100)))
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="page-header" style={{ animation: "fadeInUp 0.4s var(--ease-smooth) both" }}>
        <div className="section-number">02</div>
        <h1>Agent Tracker</h1>
        <p>Track AI agents and top traders. Analyze P&L, win rates, hold times, and categories across the leaderboard.</p>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <SpotlightCard style={{ ...card, display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 20 }}>
        <div>
          <div style={label}>Tracking</div>
          <div style={{ display: "flex", gap: 6 }}>
            {TOP_N_OPTIONS.map((n) => (
              <button key={n} onClick={() => setTopN(n)} style={{
                padding: "6px 14px", fontSize: 12, fontFamily: "var(--font-mono)",
                fontWeight: topN === n ? 700 : 400,
                background: topN === n ? "var(--accent-dim)" : "var(--bg-elevated)",
                color: topN === n ? "var(--accent-bright)" : "var(--text-muted)",
                border: `1px solid ${topN === n ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 0, cursor: "pointer",
              }}>
                Top {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={label}>Period</div>
          <div style={{ display: "flex", gap: 6 }}>
            {PERIOD_OPTIONS.map((p) => (
              <button key={p.value} onClick={() => setPeriod(p.value)} style={{
                padding: "6px 14px", fontSize: 12, fontFamily: "var(--font-mono)",
                fontWeight: period === p.value ? 700 : 400,
                background: period === p.value ? "var(--accent-dim)" : "var(--bg-elevated)",
                color: period === p.value ? "var(--accent-bright)" : "var(--text-muted)",
                border: `1px solid ${period === p.value ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 0, cursor: "pointer",
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={label}>Market type</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CATEGORIES.map((c) => (
              <button key={c.value} onClick={() => setCategory(c.value)} style={{
                padding: "6px 12px", fontSize: 12, fontFamily: "var(--font-mono)",
                fontWeight: category === c.value ? 700 : 400,
                background: category === c.value ? "var(--accent-dim)" : "var(--bg-elevated)",
                color: category === c.value ? "var(--accent-bright)" : "var(--text-muted)",
                border: `1px solid ${category === c.value ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 0, cursor: "pointer",
              }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {lastScanLabel && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Last scan: {lastScanLabel}
            </span>
          )}
          <button
            onClick={handleScan}
            disabled={scanning}
            style={{
              padding: "9px 22px", fontSize: 12, fontWeight: 500,
              background: scanning ? "var(--bg-elevated)" : "var(--accent)",
              color: scanning ? "var(--text-muted)" : "var(--bg-void)",
              border: "none", borderRadius: 0, cursor: scanning ? "not-allowed" : "pointer",
              fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase",
              transition: "all 200ms var(--ease-out)",
            }}
          >
            {scanning
              ? `Scanning… ${progress.done}/${progress.total}`
              : traders.length > 0 && scannedCategory !== category ? `Scan ${categoryLabel}` : traders.length > 0 ? "Re-scan" : "Scan Now"
            }
          </button>
        </div>
      </SpotlightCard>

      {/* Stale data hint when category changed */}
      {traders.length > 0 && scannedCategory !== null && scannedCategory !== category && !scanning && (
        <div style={{
          background: "rgba(45, 212, 168, 0.06)", border: "1px solid rgba(45, 212, 168, 0.15)",
          borderRadius: 0, padding: "10px 16px", fontSize: 12, color: "var(--accent)",
          fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>Category changed to <strong>{categoryLabel}</strong> — click scan to load new data.</span>
          <button onClick={handleScan} style={{
            padding: "4px 14px", fontSize: 11, background: "var(--accent)", color: "var(--bg-void)",
            border: "none", borderRadius: 0, cursor: "pointer", fontFamily: "var(--font-mono)",
            fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            Scan
          </button>
        </div>
      )}

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 0, padding: "12px 16px", fontSize: 12, color: "var(--red)",
          fontFamily: "var(--font-mono)",
        }}>
          {error}
        </div>
      )}

      {traders.length === 0 && !scanning && (
        <div style={{
          ...card, textAlign: "center", padding: 64,
          color: "var(--text-muted)", fontSize: 14,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
            No data yet
          </div>
          <div>Click <strong>Scan Now</strong> to fetch and analyse top Polymarket traders.</div>
        </div>
      )}

      {traders.length > 0 && aggregates && (
        <>
          {/* ── Hero stats ───────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 12 }}>
            <HeroCard
              title="Tracked Traders"
              value={aggregates.total}
              sub={`${aggregates.botCount} bots · ${aggregates.humanCount} humans`}
            />
            <HeroCard
              title="Bots Detected"
              value={aggregates.botCount}
              sub="Bot classification"
              color={BOT_COLOR}
            />
            <HeroCard
              title="Humans Detected"
              value={aggregates.humanCount}
              sub="Human classification"
              color={HUMAN_COLOR}
            />
            <HeroCard
              title="Bot Dominance"
              value={`${Math.round(aggregates.botDominance * 100)}%`}
              sub="of top traders are bots"
              color={aggregates.botDominance > 0.5 ? BOT_COLOR : HUMAN_COLOR}
            />
          </div>

          {/* ── Head-to-head ───────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>

            {/* Head-to-head */}
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{
                  fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700,
                  color: BOT_COLOR, textTransform: "uppercase", letterSpacing: "0.08em",
                }}>
                  🤖 Bots ({aggregates.botCount})
                </div>
                <div style={{
                  fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700,
                  color: HUMAN_COLOR, textTransform: "uppercase", letterSpacing: "0.08em",
                }}>
                  👤 Humans ({aggregates.humanCount})
                </div>
              </div>

              {[
                {
                  title: "Avg ROI",
                  botVal: fmtRoi(aggregates.bots.avgRoi),
                  humanVal: fmtRoi(aggregates.humans.avgRoi),
                },
                {
                  title: "Total P&L",
                  botVal: fmtPnl(aggregates.bots.totalPnl),
                  humanVal: fmtPnl(aggregates.humans.totalPnl),
                },
                {
                  title: "Avg Trades / Day",
                  botVal: aggregates.bots.avgTradesPerDay !== null
                    ? Math.round(aggregates.bots.avgTradesPerDay)
                    : "N/A",
                  humanVal: aggregates.humans.avgTradesPerDay !== null
                    ? Math.round(aggregates.humans.avgTradesPerDay)
                    : "N/A",
                },
                {
                  title: "Active Hours / Day",
                  botVal: aggregates.bots.avgActiveHours !== null
                    ? `${aggregates.bots.avgActiveHours?.toFixed(1)} / 24`
                    : "N/A",
                  humanVal: aggregates.humans.avgActiveHours !== null
                    ? `${aggregates.humans.avgActiveHours?.toFixed(1)} / 24`
                    : "N/A",
                },
              ].map((m) => (
                <MetricBlock key={m.title} {...m} />
              ))}

              {/* P&L share bar */}
              {botPct !== null && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>P&L share</span>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      Bots {botPct}% · Humans {100 - botPct}%
                    </span>
                  </div>
                  <div style={{
                    height: 8, borderRadius: 0, overflow: "hidden",
                    background: HUMAN_DIM, border: "1px solid var(--border)",
                  }}>
                    <div style={{
                      width: `${botPct}%`, height: "100%",
                      background: BOT_COLOR, borderRadius: 0,
                      transition: "width 600ms ease",
                    }} />
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ── Trader table ─────────────────────────────────────────────── */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
              Traders — {sortedTraders.length} tracked{category !== "OVERALL" ? ` (${categoryLabel})` : ""}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {[
                      { col: "rank", label: "Rank" },
                      { col: "userName", label: "Trader" },
                      { col: "botScore", label: "Bot Score" },
                      { col: "classification", label: "Class" },
                      { col: "roi", label: "ROI" },
                      { col: "pnl", label: "P&L" },
                      { col: "tradesPerDay", label: "Trades/Day" },
                      { col: "primaryCategory", label: "Focus" },
                    ].map((h) => (
                      <SortHeader key={h.col} {...h} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTraders.map((trader) => {
                    const isBot = trader.classification === "Bot";
                    const clColor = isBot ? BOT_COLOR : HUMAN_COLOR;
                    const clBg = isBot ? BOT_DIM : HUMAN_DIM;
                    return (
                      <tr
                        key={trader.address}
                        onClick={() => navigate(`/wallet-stalker?address=${trader.address}`)}
                        style={{
                          cursor: "pointer",
                          borderLeft: `3px solid ${clColor}`,
                          transition: "background 150ms",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          {trader.rank ? `#${trader.rank}` : "—"}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 12 }}>
                            {trader.userName || trader.address.slice(0, 6) + "…" + trader.address.slice(-4)}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-ghost)", fontFamily: "var(--font-mono)" }}>
                            {trader.address.slice(0, 8)}…
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            background: clBg, borderRadius: 0, padding: "3px 8px",
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: clColor }} />
                            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: clColor, fontSize: 13 }}>
                              {trader.botScore}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: clColor,
                            fontFamily: "var(--font-mono)",
                          }}>
                            {trader.classification || "—"}
                          </span>
                        </td>
                        <td style={{
                          padding: "10px 12px", fontFamily: "var(--font-mono)", fontWeight: 500,
                          color: trader.roi > 0 ? "var(--green)" : trader.roi < 0 ? "var(--red)" : "var(--text-muted)",
                        }}>
                          {fmtRoi(trader.roi)}
                        </td>
                        <td style={{
                          padding: "10px 12px", fontFamily: "var(--font-mono)", fontWeight: 600,
                          color: trader.pnl >= 0 ? "var(--green)" : "var(--red)",
                        }}>
                          {fmtPnl(trader.pnl)}
                        </td>
                        <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {trader.tradesPerDay !== null ? Math.round(trader.tradesPerDay) : "N/A"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 11 }}>
                          {trader.primaryCategory}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sortedTraders.length === 0 && (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No traders found{category !== "OVERALL" ? ` in ${categoryLabel} markets` : ""}. Try scanning again or switching category.
              </div>
            )}
            <div style={{
              marginTop: 12, fontSize: 11, color: "var(--text-ghost)", fontStyle: "italic",
            }}>
              Click any row to open full Wallet Stalker analysis.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
