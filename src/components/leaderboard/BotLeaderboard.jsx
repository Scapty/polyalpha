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

  const classColor = (c) => c === "Bot" ? "var(--purple)" : "var(--blue)";
  const classBg = (c) => c === "Bot" ? "rgba(139,92,246,0.12)" : "rgba(59,130,246,0.12)";

  const formatPnl = (v) => {
    const n = parseFloat(v) || 0;
    const sign = n >= 0 ? "+" : "";
    return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ animation: "fadeInUp 0.3s ease both" }}>
        <h1
          className="glow-title"
          style={{
            fontSize: 48,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          Bot Leaderboard
        </h1>
        <p style={{ fontSize: 16, fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
          Top Polymarket traders ranked by volume. Bot classification powered by behavioral analysis.
        </p>
      </div>

      {/* Summary line + refresh */}
      {stats && traders.length > 0 && (
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {stats.botCount} of {stats.totalCount} top traders classified as bots
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          className="btn-primary"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ height: 40, padding: "0 24px", fontSize: 13 }}
        >
          {refreshing ? "Scoring..." : "Refresh Data"}
        </button>
        {lastUpdated && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Data as of {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Progress */}
      {refreshing && (
        <div style={{ maxWidth: 400 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
            Scoring wallet {progress.current}/{progress.total}
            {progress.name ? ` (${progress.name})` : ""}...
          </div>
          <div style={{ height: 4, borderRadius: 0, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
                height: "100%",
                background: "var(--accent)",
                borderRadius: 0,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: "var(--accent)", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading cached data...</span>
        </div>
      )}

      {/* No data */}
      {!loading && !refreshing && traders.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--text-muted)", padding: "20px 0" }}>
          No data yet. Click Refresh to score the top 20 traders.
        </p>
      )}

      {/* Summary Stats */}
      {stats && traders.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div className="stat-card">
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Bots Detected</div>
            <div style={{ fontSize: 20, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--purple)" }}>{stats.botCount} / {stats.totalCount}</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Bot P&L Share</div>
            <div style={{ fontSize: 20, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{stats.botPnlShare}%</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Avg Win Rate</div>
            <div style={{ fontSize: 20, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{stats.botAvgWinRate}% vs {stats.humanAvgWinRate}%</div>
            <div style={{ fontSize: 10, color: "var(--text-ghost)", marginTop: 2 }}>Bot vs Human</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Avg Trades/Day</div>
            <div style={{ fontSize: 20, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{stats.botAvgTradesPerDay} vs {stats.humanAvgTradesPerDay}</div>
            <div style={{ fontSize: 10, color: "var(--text-ghost)", marginTop: 2 }}>Bot vs Human</div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      {traders.length > 0 && (
        <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 0, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
            Top 20 Traders
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#", "Trader", "Bot Score", "Classification", "P&L", "Win Rate", "Trades/Day"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {traders.map((t, i) => (
                  <tr
                    key={t.wallet_address}
                    onClick={() => navigate(`/wallet-stalker?address=${t.wallet_address}`)}
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border)",
                      animation: `fadeInUp 0.3s ease ${i * 60}ms both`,
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                        {t.rank}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 500, fontSize: 13, color: "var(--text-primary)" }}>{t.display_name}</span>
                        <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                          {t.wallet_address.slice(0, 6)}...{t.wallet_address.slice(-4)}
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 48, height: 4, borderRadius: 0, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                          <div style={{ width: `${t.bot_score}%`, height: "100%", background: classColor(t.classification), borderRadius: 0 }} />
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: classColor(t.classification) }}>
                          {t.bot_score}
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          borderRadius: 0,
                          background: classBg(t.classification),
                          color: classColor(t.classification),
                          fontWeight: 600,
                          fontFamily: "var(--font-mono)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {t.classification || "—"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: parseFloat(t.pnl) >= 0 ? "var(--green)" : "var(--red)", fontWeight: 500, fontFamily: "var(--font-mono)" }}>
                      {formatPnl(t.pnl)}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{t.win_rate}%</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{t.trades_per_day}</td>
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
            color="var(--purple)"
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
            color="var(--blue)"
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

function ComparisonCard({ title, color, items }) {
  return (
    <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 0, padding: 20 }}>
      <h4 style={{ fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 14, color }}>
        {title}
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
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
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderBottom: "1px solid var(--border)",
};

const tdStyle = {
  padding: "10px 12px",
  fontSize: 13,
};
