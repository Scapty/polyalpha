import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchCachedLeaderboard,
  refreshLeaderboardCache,
  computeLeaderboardStats,
} from "../../utils/leaderboardScoring";
import { useToast } from "../shared/Toast";

export default function BotLeaderboard() {
  const navigate = useNavigate();
  const addToast = useToast();
  const [traders, setTraders] = useState([]);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: "" });

  useEffect(() => {
    loadCached();
  }, []);

  async function loadCached() {
    setLoading(true);
    const { traders: cached, lastUpdated: lu } = await fetchCachedLeaderboard();
    if (cached.length > 0) {
      setTraders(cached);
      setStats(computeLeaderboardStats(cached));
      setLastUpdated(lu);
    }
    setLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    setProgress({ current: 0, total: 20, name: "" });
    try {
      const { traders: scored, errors } = await refreshLeaderboardCache(
        (current, total, name) => setProgress({ current, total, name })
      );
      setTraders(scored);
      setStats(computeLeaderboardStats(scored));
      setLastUpdated(new Date());
      addToast(
        `Scored ${scored.length} traders${errors > 0 ? ` (${errors} failed)` : ""}`,
        "success"
      );
    } catch (err) {
      console.error("Refresh failed:", err);
      addToast("Failed to refresh leaderboard: " + err.message, "error");
    }
    setRefreshing(false);
  }

  const classColor = (c) =>
    c === "Likely Bot" ? "#8b5cf6" : c === "Uncertain" ? "#ffaa00" : "#00d4aa";

  const classBg = (c) =>
    c === "Likely Bot"
      ? "rgba(139,92,246,0.12)"
      : c === "Uncertain"
        ? "rgba(255,170,0,0.12)"
        : "rgba(0,212,170,0.12)";

  const formatPnl = (v) => {
    const n = parseFloat(v) || 0;
    const sign = n >= 0 ? "+" : "";
    return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  // --- Render ---
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Hero Section */}
      <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          Bot Dominance on Polymarket
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, maxWidth: 600, margin: "0 auto 24px" }}>
          Are the top Polymarket traders bots? We scored the top 20 by P&L using our 6-factor algorithm.
        </p>

        {stats && traders.length > 0 ? (
          <>
            {/* Bot ratio bar */}
            <div style={{ maxWidth: 500, margin: "0 auto 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, fontFamily: "var(--font-mono)" }}>
                <span style={{ color: "#8b5cf6" }}>Likely Bot: {stats.botCount}</span>
                <span style={{ color: "#ffaa00" }}>Uncertain: {stats.uncertainCount}</span>
                <span style={{ color: "#00d4aa" }}>Likely Human: {stats.humanCount}</span>
              </div>
              <div style={{ height: 28, borderRadius: 8, overflow: "hidden", display: "flex", background: "var(--bg-surface)" }}>
                {stats.botCount > 0 && (
                  <div style={{ width: `${(stats.botCount / stats.totalCount) * 100}%`, background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", transition: "width 0.5s" }} />
                )}
                {stats.uncertainCount > 0 && (
                  <div style={{ width: `${(stats.uncertainCount / stats.totalCount) * 100}%`, background: "linear-gradient(135deg, #ffaa00, #f59e0b)", transition: "width 0.5s" }} />
                )}
                {stats.humanCount > 0 && (
                  <div style={{ width: `${(stats.humanCount / stats.totalCount) * 100}%`, background: "linear-gradient(135deg, #00d4aa, #00b894)", transition: "width 0.5s" }} />
                )}
              </div>
            </div>

            {/* Hero stats */}
            <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "var(--font-display)", color: "#8b5cf6" }}>
                  {stats.botCount} / {stats.totalCount}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Top Traders are Bots</div>
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "var(--font-display)", color: "#ffaa00" }}>
                  {stats.botPnlShare}%
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Bot Share of Total P&L</div>
              </div>
            </div>
          </>
        ) : !loading && !refreshing ? (
          <div style={{ padding: "20px 0" }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
              No data yet. Click Refresh to score the top 20 traders.
            </p>
          </div>
        ) : null}

        {/* Refresh button + last updated */}
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <button
            className="btn-primary"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ padding: "10px 24px", fontSize: 13 }}
          >
            {refreshing ? "Scoring..." : "Refresh Data"}
          </button>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Data as of {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {refreshing && (
          <div style={{ maxWidth: 400, margin: "16px auto 0" }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
              Scoring wallet {progress.current}/{progress.total}
              {progress.name ? ` (${progress.name})` : ""}...
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--bg-surface)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  height: "100%",
                  background: "var(--accent)",
                  borderRadius: 3,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--border-subtle)", borderTopColor: "var(--accent)", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading cached data...</span>
        </div>
      )}

      {/* Summary Stats */}
      {stats && traders.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <StatCard label="Bots Detected" value={`${stats.botCount} / ${stats.totalCount}`} color="#8b5cf6" />
          <StatCard label="Bot P&L Share" value={`${stats.botPnlShare}%`} color="#ffaa00" />
          <StatCard
            label="Avg Win Rate"
            value={`${stats.botAvgWinRate}% vs ${stats.humanAvgWinRate}%`}
            sub="Bot vs Human"
            color="#00d4aa"
          />
          <StatCard
            label="Avg Trades/Day"
            value={`${stats.botAvgTradesPerDay} vs ${stats.humanAvgTradesPerDay}`}
            sub="Bot vs Human"
            color="#3b82f6"
          />
        </div>
      )}

      {/* Leaderboard Table */}
      {traders.length > 0 && (
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            Top 20 Traders — Bot Score Analysis
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Rank", "Trader", "Bot Score", "Classification", "P&L", "Win Rate", "Trades/Day"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {traders.map((t) => (
                  <tr
                    key={t.wallet_address}
                    onClick={() => navigate(`/wallet-stalker?address=${t.wallet_address}`)}
                    style={{
                      cursor: "pointer",
                      borderLeft: `3px solid ${classColor(t.classification)}`,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={tdStyle}>#{t.rank}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{t.display_name}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          {t.wallet_address.slice(0, 6)}...{t.wallet_address.slice(-4)}
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 60, height: 6, borderRadius: 3, background: "var(--bg-surface)", overflow: "hidden" }}>
                          <div style={{ width: `${t.bot_score}%`, height: "100%", background: classColor(t.classification), borderRadius: 3 }} />
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: classColor(t.classification) }}>
                          {t.bot_score}
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: classBg(t.classification),
                          color: classColor(t.classification),
                          fontWeight: 600,
                          fontFamily: "var(--font-mono)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {t.classification}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: parseFloat(t.pnl) >= 0 ? "var(--accent)" : "var(--negative)", fontWeight: 600 }}>
                      {formatPnl(t.pnl)}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{t.win_rate}%</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{t.trades_per_day}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bot vs Human Comparison */}
      {stats && traders.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <ComparisonCard
            title="Bots"
            icon="🤖"
            color="#8b5cf6"
            items={[
              { label: "Count", value: stats.botCount },
              { label: "Avg Bot Score", value: stats.botAvgScore },
              { label: "Avg Win Rate", value: `${stats.botAvgWinRate}%` },
              { label: "Avg Trades/Day", value: stats.botAvgTradesPerDay },
              { label: "P&L Share", value: `${stats.botPnlShare}%` },
            ]}
          />
          <ComparisonCard
            title="Humans"
            icon="👤"
            color="#00d4aa"
            items={[
              { label: "Count", value: stats.humanCount },
              { label: "Avg Bot Score", value: stats.humanAvgScore },
              { label: "Avg Win Rate", value: `${stats.humanAvgWinRate}%` },
              { label: "Avg Trades/Day", value: stats.humanAvgTradesPerDay },
              { label: "P&L Share", value: `${(100 - parseFloat(stats.botPnlShare)).toFixed(1)}%` },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)", color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ComparisonCard({ title, icon, color, items }) {
  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, marginBottom: 14, color, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span> {title}
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const thStyle = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  borderBottom: "1px solid var(--border-subtle)",
};

const tdStyle = {
  padding: "10px 12px",
  fontSize: 13,
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};
