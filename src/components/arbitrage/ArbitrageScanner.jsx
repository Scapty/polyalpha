import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fetchAllMarkets } from "../../utils/api";
import { scanForArbitrage, diffScans, generateInsight } from "../../utils/arbitrageScanner";
import StatCard from "../shared/StatCard";
import DataBadge from "../shared/DataBadge";

const POLL_INTERVAL = 30_000; // 30 seconds

export default function ArbitrageScanner() {
  const [liveOpps, setLiveOpps] = useState([]);
  const [history, setHistory] = useState([]);
  const [marketCount, setMarketCount] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(null);
  const [newFlash, setNewFlash] = useState(new Set());
  const prevOppsRef = useRef([]);

  // --- Scan function ---
  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const { markets, isLive: live } = await fetchAllMarkets();
      setIsLive(live);
      setMarketCount(markets.length);

      const opps = scanForArbitrage(markets);
      const prev = prevOppsRef.current;
      const { newOpps, closedOpps } = diffScans(opps, prev);

      // Flash new opportunities
      if (newOpps.length > 0) {
        const flashIds = new Set(newOpps.map((o) => o.id));
        setNewFlash(flashIds);
        setTimeout(() => setNewFlash(new Set()), 3000);
      }

      // Move closed opportunities to history
      if (closedOpps.length > 0) {
        const now = Date.now();
        const closedEntries = closedOpps.map((o) => ({
          ...o,
          closedAt: now,
          durationSec: Math.round((now - o.detectedAt) / 1000),
          status: "Closed",
        }));
        setHistory((h) => [...closedEntries, ...h]);
      }

      setLiveOpps(opps);
      prevOppsRef.current = opps;
      setLastScanTime(Date.now());
    } catch (err) {
      console.error("Scan failed:", err);
    } finally {
      setScanning(false);
    }
  }, []);

  // --- Poll on interval ---
  useEffect(() => {
    runScan();
    const id = setInterval(runScan, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [runScan]);

  // --- "Last scanned X seconds ago" counter ---
  useEffect(() => {
    const id = setInterval(() => {
      if (lastScanTime) setSecondsAgo(Math.round((Date.now() - lastScanTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastScanTime]);

  // --- Computed stats ---
  const now24hAgo = Date.now() - 24 * 60 * 60 * 1000;
  const history24h = history.filter((h) => h.detectedAt > now24hAgo);
  const foundToday = history24h.length + liveOpps.length;
  const durations = history24h.filter((h) => h.durationSec != null).map((h) => h.durationSec);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const profits = history24h.map((h) => h.gap * Math.min(h.liquidity, 10000));
  const avgProfit = profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : null;

  const lastClosed = history.length > 0 ? history[0] : null;

  // --- Chart data: hourly buckets ---
  const chartData = buildHourlyChart(history24h);

  // --- Insight ---
  const insight = generateInsight([...history24h, ...liveOpps], marketCount);

  return (
    <div style={{ animation: "fadeInUp 0.5s var(--ease-out)" }}>
      {/* Hero */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, margin: 0 }}>
            Arbitrage Scanner
          </h1>
          <DataBadge status={isLive ? "live" : "demo"} />
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 15, margin: 0, marginBottom: 16 }}>
          Real-time detection of pricing inefficiencies on Polymarket
        </p>

        {/* Scanning status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: scanning ? "var(--accent)" : "var(--accent)",
              animation: "pulse-glow 2s infinite",
              display: "inline-block",
            }}
          />
          <span>
            {scanning
              ? `Scanning ${marketCount} active markets...`
              : `Scanning ${marketCount} active markets`}
          </span>
          {secondsAgo != null && (
            <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
              · Last scanned {secondsAgo}s ago
            </span>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard label="Live Now" value={liveOpps.length} subtext={liveOpps.length > 0 ? "opportunities available" : "no active opportunities"} delay={0} />
        <StatCard label="Found Today" value={foundToday} subtext="in the last 24h" delay={80} />
        <StatCard label="Avg Duration" value={avgDuration != null ? `${avgDuration}s` : "—"} subtext={avgDuration != null ? "before arbitraged away" : "waiting for data"} delay={160} />
        <StatCard label="Avg Profit" value={avgProfit != null ? `$${avgProfit.toFixed(2)}` : "—"} subtext={avgProfit != null ? "risk-free per opportunity" : "waiting for data"} delay={240} />
      </div>

      {/* Live Opportunities */}
      <section className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: liveOpps.length > 0 ? "var(--accent)" : "var(--text-dim)", animation: liveOpps.length > 0 ? "pulse-glow 2s infinite" : "none" }} />
          Live Opportunities
        </h2>

        {liveOpps.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Market", "YES", "NO", "Total", "Gap", "Profit %", "Volume 24h", "Age"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 500, fontFamily: "var(--font-body)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveOpps.map((opp) => (
                  <LiveRow key={opp.id} opp={opp} isNew={newFlash.has(opp.id)} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            No live opportunities detected.
            {lastClosed && (
              <span>
                {" "}Last opportunity was{" "}
                <span style={{ color: "var(--text-secondary)" }}>
                  {formatTimeAgo(lastClosed.closedAt)}
                </span>
                {" "}on "{truncate(lastClosed.question, 50)}".
              </span>
            )}
          </div>
        )}
      </section>

      {/* History */}
      <section className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
          Arbitrage History
          {history24h.length > 0 && (
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
              Last 24 Hours
            </span>
          )}
        </h2>

        {history.length > 0 ? (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", position: "sticky", top: 0, background: "var(--bg-surface)" }}>
                  {["Time", "Market", "Gap", "Duration", "Est. Profit", "Status"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 500, fontFamily: "var(--font-body)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry, i) => (
                  <tr key={`${entry.id}-${i}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(entry.closedAt || entry.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "10px 12px", maxWidth: 300 }}>
                      <span style={{ color: "var(--text-primary)" }}>{truncate(entry.question, 50)}</span>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                      ${entry.gap.toFixed(3)}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)" }}>
                      {entry.durationSec != null ? `${entry.durationSec}s` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                      ${(entry.gap * Math.min(entry.liquidity, 10000)).toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "rgba(0,212,170,0.1)",
                        color: "var(--accent)",
                      }}>
                        {entry.status || "Closed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            No history yet. Keep the scanner running to capture opportunities as they appear and close.
          </div>
        )}
      </section>

      {/* Chart: Opportunities Over Time */}
      {history24h.length > 0 && (
        <section className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            Opportunities Over Time
          </h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--text-muted)" }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Opportunities" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Insight Box */}
      <section className="glass-card" style={{ padding: 24, borderLeft: "3px solid var(--accent)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>Insight</span>
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7, margin: 0, fontFamily: "var(--font-serif)" }}>
          {insight}
        </p>
      </section>

      {/* Future feature note */}
      <div style={{ marginTop: 24, padding: 16, borderRadius: "var(--radius-md)", background: "rgba(255,170,0,0.05)", border: "1px solid rgba(255,170,0,0.15)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--warning)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
          COMING SOON
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          <strong>Type 2 Arbitrage Detection</strong> — Cross-market inconsistency detection for logically linked markets
          (e.g., "Trump wins 2028" vs "A Republican wins 2028"). Requires semantic analysis of market relationships.
        </div>
      </div>
    </div>
  );
}

// --- Live opportunity row with flash animation ---
function LiveRow({ opp, isNew }) {
  const ageSec = Math.round((Date.now() - opp.detectedAt) / 1000);

  return (
    <tr style={{
      borderBottom: "1px solid rgba(255,255,255,0.03)",
      background: isNew ? "rgba(0,212,170,0.08)" : "transparent",
      transition: "background 1s ease",
    }}>
      <td style={{ padding: "10px 12px", maxWidth: 300 }}>
        <span style={{ color: "var(--text-primary)" }}>{truncate(opp.question, 45)}</span>
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
        ${opp.yesPrice.toFixed(2)}
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
        ${opp.noPrice.toFixed(2)}
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--negative)" }}>
        ${opp.total.toFixed(2)}
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
        ${opp.gap.toFixed(3)}
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>
        {opp.profitPct.toFixed(2)}%
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
        {formatVolume(opp.volume24hr)}
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
        {ageSec}s
      </td>
    </tr>
  );
}

// --- Helpers ---
function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function formatTimeAgo(ts) {
  if (!ts) return "unknown";
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

function formatVolume(v) {
  if (!v) return "$0";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function buildHourlyChart(history24h) {
  const buckets = {};
  const now = Date.now();

  // Initialize 24 hourly buckets
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now - i * 3600_000);
    const key = hour.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).replace(/:00/, "h");
    buckets[key] = 0;
  }

  // Fill buckets
  for (const entry of history24h) {
    const hour = new Date(entry.detectedAt);
    const key = hour.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).replace(/:00/, "h");
    if (key in buckets) buckets[key]++;
  }

  return Object.entries(buckets).map(([label, count]) => ({ label, count }));
}
