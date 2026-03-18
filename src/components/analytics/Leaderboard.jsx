import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLeaderboard } from "../../utils/api";
import { formatUSD } from "../../utils/format";
import DataBadge from "../shared/DataBadge";

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

export default function Leaderboard() {
  const [traders, setTraders] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    setLoading(true);
    const result = await fetchLeaderboard(20);
    setTraders(result.traders);
    setIsLive(result.isLive);
    setLoading(false);
  }

  function handleAnalyzeWallet(address) {
    navigate(`/wallet-stalker?address=${address}`);
  }

  function shortAddr(addr) {
    if (!addr) return "—";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  return (
    <div className="glass-card" style={{ padding: 24, gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>
            Top Polymarket Traders
          </h3>
          <DataBadge status={isLive ? "live" : "demo"} />
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          Click row to expand
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        {isLive
          ? "Real-time rankings from Polymarket Data API — all-time PNL"
          : "Unable to load live leaderboard data"}
      </p>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--border-subtle)", borderTopColor: "var(--accent)", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading leaderboard...</span>
        </div>
      ) : traders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Leaderboard data is currently unavailable. Try refreshing the page.
          </p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 2px", fontFamily: "var(--font-body)", minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Trader</th>
                  <th style={thStyle}>Wallet</th>
                  <th style={thStyle}>PNL</th>
                  <th style={thStyle}>Volume</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {traders.map((trader, i) => {
                  const rank = trader.rank || i + 1;
                  const isTop3 = rank <= 3;
                  const isExpanded = expandedRow === (trader.proxyWallet || i);
                  const pnl = trader.pnl || 0;
                  const vol = trader.vol || 0;

                  return (
                    <tr
                      key={trader.proxyWallet || i}
                      onClick={() => setExpandedRow(isExpanded ? null : (trader.proxyWallet || i))}
                      style={{
                        cursor: "pointer",
                        animation: `fadeInUp 0.4s var(--ease-out) ${i * 50}ms both`,
                        background: isExpanded ? "rgba(255,255,255,0.03)" : "transparent",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isExpanded ? "rgba(255,255,255,0.03)" : "transparent"; }}
                    >
                      <td style={{ padding: "12px 12px", width: 48 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: isTop3 ? "var(--accent)" : "var(--text-muted)" }}>
                          #{rank}
                        </span>
                      </td>

                      <td style={{ padding: "12px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {trader.profileImage ? (
                            <img src={trader.profileImage} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />
                          ) : (
                            <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>
                              {isTop3 ? "🏆" : "👤"}
                            </span>
                          )}
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                            {trader.userName || "Anonymous"}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: "12px 12px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                          {shortAddr(trader.proxyWallet)}
                        </span>
                      </td>

                      <td style={{ padding: "12px 12px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: pnl >= 0 ? "var(--accent)" : "var(--negative)" }}>
                          {pnl >= 0 ? "+" : ""}{formatUSD(pnl)}
                        </span>
                      </td>

                      <td style={{ padding: "12px 12px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
                          {formatUSD(vol)}
                        </span>
                      </td>

                      <td style={{ padding: "12px 12px", textAlign: "center" }}>
                        <button
                          className="btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAnalyzeWallet(trader.proxyWallet);
                          }}
                          style={{ fontSize: 10, padding: "4px 10px" }}
                        >
                          🔍 Analyze
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded detail panel */}
          {expandedRow && (() => {
            const trader = traders.find((t) => t.proxyWallet === expandedRow);
            if (!trader) return null;

            return (
              <div
                className="animate-fade-in-up"
                style={{
                  margin: "8px 0 16px",
                  padding: 20,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 24,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Wallet Details
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { label: "Full Address", value: trader.proxyWallet ? `${trader.proxyWallet.slice(0, 10)}...${trader.proxyWallet.slice(-8)}` : "—", color: "var(--text-primary)" },
                      { label: "Username", value: trader.userName || "Anonymous", color: "var(--text-primary)" },
                      { label: "PNL", value: `$${Number(trader.pnl || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: (trader.pnl || 0) >= 0 ? "var(--accent)" : "var(--negative)" },
                      { label: "Volume", value: `$${Number(trader.vol || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "var(--text-primary)" },
                    ].map((stat) => (
                      <div key={stat.label} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--radius-sm)" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                          {stat.label}
                        </div>
                        <div style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 700, color: stat.color }}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center", alignItems: "center" }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
                    Want to know if this trader is a bot? Run the 6-factor bot detection algorithm on their trade history.
                  </p>
                  <button
                    className="btn-ghost"
                    onClick={() => handleAnalyzeWallet(trader.proxyWallet)}
                    style={{ fontSize: 12, padding: "8px 20px" }}
                  >
                    🔍 Analyze in Wallet Stalker
                  </button>
                  {trader.proxyWallet && (
                    <a
                      href={`https://polygonscan.com/address/${trader.proxyWallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "underline" }}
                    >
                      View on PolygonScan →
                    </a>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
