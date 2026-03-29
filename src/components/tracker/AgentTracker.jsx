import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { fetchTopTraders, fetchWalletTrades } from "../../utils/api";
import {
  analyzeTrader, computeAggregates, buildCategoryChartData,
  loadTrackerCache, saveTrackerCache,
  fmtPnl, fmtHold, fmtPct,
} from "../../utils/agentTrackerEngine";
import SpotlightCard from "../shared/SpotlightCard";

// ── Constants ─────────────────────────────────────────────────────────────────

const TOP_N_OPTIONS = [10, 20, 50];
const PERIOD_OPTIONS = [
  { label: "7 days", value: "WEEK" },
  { label: "30 days", value: "MONTH" },
  { label: "All time", value: "ALL" },
];
const CATEGORIES = ["All", "Crypto", "Politics", "Economics", "Sports", "Pop Culture"];

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

function CategoryTooltip({ active, payload, label: lbl }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-elevated)", border: "1px solid var(--border)",
      borderRadius: 0, padding: "10px 14px", fontSize: 12, fontFamily: "var(--font-mono)",
    }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 6, fontSize: 11 }}>{lbl}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name === "bots" ? "Bots" : "Humans"}: {p.value !== null ? `${p.value}%` : "—"}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentTracker() {
  const navigate = useNavigate();

  const [topN, setTopN] = useState(20);
  const [period, setPeriod] = useState("ALL");
  const [category, setCategory] = useState("All");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [traders, setTraders] = useState([]);
  const [lastScan, setLastScan] = useState(null);
  const [sortBy, setSortBy] = useState("rank");
  const [sortDir, setSortDir] = useState("asc");
  const [error, setError] = useState(null);

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
      // 1. Fetch top traders from leaderboard
      const leaderboard = await fetchTopTraders(topN, period);
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
      saveTrackerCache(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }, [topN, period]);

  // ── Derived data ────────────────────────────────────────────────────────────

  // Filter traders by selected category (>= 20% of trades in that category, or primary category match)
  const filteredTraders = useMemo(() => {
    if (category === "All") return traders;
    return traders.filter((t) => {
      if (t.primaryCategory === category) return true;
      const focus = t.categoryDist?.[category] ?? 0;
      return focus >= 0.2; // at least 20% of trades in this category
    });
  }, [traders, category]);

  const aggregates = useMemo(
    () => computeAggregates(filteredTraders, category),
    [filteredTraders, category]
  );

  const chartData = useMemo(
    () => buildCategoryChartData(aggregates),
    [aggregates]
  );

  // Only show chart if bots have at least one category win rate value
  const chartHasBotData = useMemo(
    () => chartData.some((d) => d.bots !== null),
    [chartData]
  );

  const sortedTraders = useMemo(() => {
    return [...filteredTraders].sort((a, b) => {
      const va = a[sortBy] ?? (sortDir === "asc" ? Infinity : -Infinity);
      const vb = b[sortBy] ?? (sortDir === "asc" ? Infinity : -Infinity);
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [filteredTraders, sortBy, sortDir]);

  function handleSort(col) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  }

  // ── Insight sentence ────────────────────────────────────────────────────────

  const insight = useMemo(() => {
    if (!aggregates || aggregates.botCount === 0 || aggregates.humanCount === 0) return null;
    const cats = Object.keys(aggregates.bots.winRateByCategory || {});
    let biggest = null, biggestDiff = 0;
    for (const cat of cats) {
      const b = aggregates.bots.winRateByCategory[cat];
      const h = aggregates.humans.winRateByCategory?.[cat];
      if (b === undefined || h === undefined) continue;
      const diff = Math.abs(b - h);
      if (diff > biggestDiff) { biggestDiff = diff; biggest = { cat, b, h }; }
    }
    if (!biggest) return null;
    const lead = biggest.b > biggest.h ? "Bots lead" : "Humans lead";
    const trail = biggest.b > biggest.h
      ? `bots outperform humans by ${Math.round((biggest.b - biggest.h) * 100)}pp`
      : `humans outperform bots by ${Math.round((biggest.h - biggest.b) * 100)}pp`;
    return `On ${biggest.cat} markets, ${trail} in win rate.`;
  }, [aggregates]);

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
              <button key={c} onClick={() => setCategory(c)} style={{
                padding: "6px 12px", fontSize: 12, fontFamily: "var(--font-mono)",
                fontWeight: category === c ? 700 : 400,
                background: category === c ? "var(--accent-dim)" : "var(--bg-elevated)",
                color: category === c ? "var(--accent-bright)" : "var(--text-muted)",
                border: `1px solid ${category === c ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 0, cursor: "pointer",
              }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
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
              : traders.length > 0 ? "Re-scan" : "Scan Now"
            }
          </button>
        </div>
      </SpotlightCard>

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
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
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

          {/* ── Head-to-head + Category chart ───────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: chartHasBotData ? "1fr 1fr" : "1fr", gap: 16 }}>

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
                  title: "Avg Win Rate",
                  botVal: fmtPct(aggregates.bots.avgWinRate),
                  humanVal: fmtPct(aggregates.humans.avgWinRate),
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
                  title: "Avg Hold Time",
                  botVal: fmtHold(aggregates.bots.avgHoldMinutes),
                  humanVal: fmtHold(aggregates.humans.avgHoldMinutes),
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

            {/* Category win rate chart — only shown when bot data is available */}
            {chartHasBotData && (
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    Win Rate by Category
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[{ label: "Bots", color: BOT_COLOR }, { label: "Humans", color: HUMAN_COLOR }].map((l) => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 0, background: l.color }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {insight && (
                  <div style={{
                    fontSize: 11, color: "var(--text-muted)", fontStyle: "italic",
                    marginBottom: 16, lineHeight: 1.5,
                  }}>
                    {insight}
                  </div>
                )}
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.04)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="category"
                      tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <RTooltip content={<CategoryTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="bots" name="bots" fill={BOT_COLOR} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="humans" name="humans" fill={HUMAN_COLOR} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Trader table ─────────────────────────────────────────────── */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
              Traders — {sortedTraders.length}{category !== "All" ? ` matching "${category}"` : ""}{sortedTraders.length !== traders.length ? ` / ${traders.length} total` : " tracked"}
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
                      { col: "winRate", label: "Win Rate" },
                      { col: "pnl", label: "P&L" },
                      { col: "tradesPerDay", label: "Trades/Day" },
                      { col: "avgHoldMinutes", label: "Avg Hold" },
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
                        <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                          {fmtPct(trader.winRate)}
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
                        <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {fmtHold(trader.avgHoldMinutes)}
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
            {sortedTraders.length === 0 && category !== "All" && (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No traders found with significant activity in <strong>{category}</strong> markets. Try "All" or another category.
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
