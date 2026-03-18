import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchWalletTrades, fetchTraderProfile } from "../../utils/api";
import { calculateBotScore } from "../../utils/botScoring";
import WalletInput from "./WalletInput";
import BotScoreGauge from "./BotScoreGauge";
import FactorBreakdown from "./FactorBreakdown";
import MarketCategoryBreakdown from "./MarketCategoryBreakdown";
import ActivityHeatmap from "./ActivityHeatmap";
import CopyTradingSimulator from "./CopyTradingSimulator";
import WalletTracker from "./WalletTracker";
import DataBadge from "../shared/DataBadge";

export default function WalletStalker() {
  const [searchParams] = useSearchParams();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [trades, setTrades] = useState([]);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [traderName, setTraderName] = useState(null);

  // Auto-analyze if address is passed via URL params (from Leaderboard "Analyze" button)
  useEffect(() => {
    const urlAddress = searchParams.get("address");
    if (urlAddress && urlAddress !== address) {
      setAddress(urlAddress);
      handleAnalyze(urlAddress);
    }
  }, [searchParams]);

  async function handleAnalyze(addr) {
    const walletAddr = (typeof addr === "string" ? addr : "") || address;
    if (!walletAddr.trim()) return;

    setLoading(true);
    setResult(null);
    setTrades([]);
    setError(null);
    setProfile(null);
    setShowAllTrades(false);
    setTraderName(null);

    try {
      // Fetch trades and trader profile in parallel
      const [tradesResult, profileResult] = await Promise.all([
        fetchWalletTrades(walletAddr.trim()),
        fetchTraderProfile(walletAddr.trim()),
      ]);

      setTrades(tradesResult.trades);
      setIsLive(tradesResult.isLive);
      setError(tradesResult.error);
      setProfile(profileResult.profile);

      // Extract trader name from the first trade (Data API provides it)
      if (tradesResult.trades.length > 0 && tradesResult.trades[0].traderName) {
        setTraderName(tradesResult.trades[0].traderName);
      }

      if (tradesResult.trades.length >= 5) {
        const analysis = calculateBotScore(tradesResult.trades);
        setResult(analysis);
      } else if (tradesResult.trades.length > 0) {
        setResult({
          score: 0,
          classification: "Insufficient Data",
          factors: [],
          stats: { totalTrades: tradesResult.trades.length },
        });
      }
    } catch (err) {
      console.error("Wallet analysis failed:", err);
      setError("Failed to analyze wallet. Please try again.");
    }

    setLoading(false);
  }

  const displayedTrades = showAllTrades ? trades : trades.slice(0, 25);

  // Compute overview stats from trades + profile
  const overviewStats = trades.length > 0 ? computeOverviewStats(trades, profile) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 6,
            letterSpacing: "-0.02em",
          }}
        >
          Wallet Stalker
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Paste any Polymarket wallet address to get a full trader X-ray: bot detection, activity
          patterns, and copy trading simulation
        </p>
      </div>

      {/* Section 1: Input */}
      <WalletInput
        address={address}
        onAddressChange={setAddress}
        onSubmit={(addr) => handleAnalyze(addr)}
        loading={loading}
      />

      {/* Loading state */}
      {loading && (
        <div className="animate-fade-in glass-card" style={{ padding: 32, textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "3px solid var(--border-subtle)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 20px",
            }}
          />
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Scanning wallet...
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Fetching real trade data from Polymarket Data API
          </p>
        </div>
      )}

      {/* No trades found message */}
      {!loading && error && trades.length === 0 && (
        <div className="animate-fade-in glass-card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{"\uD83D\uDD0D"}</div>
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            No Trade Data Available
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.6,
              maxWidth: 500,
              margin: "0 auto",
            }}
          >
            {error}
          </p>
          {profile && (
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginTop: 12,
                fontStyle: "italic",
              }}
            >
              Note: This wallet does appear on the Polymarket leaderboard (see profile above), but
              individual trade data isn't available via the public Data API.
            </p>
          )}
        </div>
      )}

      {/* Results — all sections flow top to bottom */}
      {result && !loading && (
        <div
          className="animate-fade-in-up"
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {/* Data source badge + address */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <DataBadge status={isLive ? "live" : "demo"} label={isLive ? "LIVE DATA" : "DEMO"} />
            {traderName && (
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {traderName}
              </span>
            )}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {address}
            </span>
          </div>

          {/* Section 2: Overview Cards */}
          {overviewStats && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
              }}
            >
              {overviewStats
                .filter((s) => s.value !== null && s.value !== undefined)
                .map((stat, i) => (
                  <div
                    key={stat.label}
                    className="stat-card"
                    style={{
                      animation: `fadeInUp 0.4s var(--ease-out) ${i * 60}ms both`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                      }}
                    >
                      {stat.label}
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: stat.color || "var(--text-primary)",
                      }}
                    >
                      {stat.value}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Section 3: Bot Score Gauge + Factor Breakdown */}
          {result.classification !== "Insufficient Data" && (
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
              <BotScoreGauge score={result.score} classification={result.classification} />
              <FactorBreakdown factors={result.factors} />
            </div>
          )}

          {/* Insufficient data notice */}
          {result.classification === "Insufficient Data" && (
            <div className="glass-card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{"\uD83D\uDCCA"}</div>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Not Enough Trades for Bot Scoring
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Found {result.stats.totalTrades} trade(s), but we need at least 5 to run the
                6-factor analysis. The trade history below shows what we found.
              </p>
            </div>
          )}

          {/* Section 3.5: Market Category Breakdown */}
          {result.classification !== "Insufficient Data" && (
            <MarketCategoryBreakdown trades={trades} />
          )}

          {/* Section 4: Activity Heatmap */}
          {result.classification !== "Insufficient Data" && <ActivityHeatmap trades={trades} />}

          {/* Section 5: Copy Trading Simulator */}
          {result.classification !== "Insufficient Data" && (
            <CopyTradingSimulator trades={trades} traderName={traderName || "this trader"} />
          )}

          {/* Section 6: Track This Wallet */}
          {result.classification !== "Insufficient Data" && (
            <WalletTracker
              walletAddress={address}
              walletLabel={traderName}
              botScore={result?.score}
            />
          )}

          {/* Trade history */}
          {trades.length > 0 && (
            <div className="glass-card" style={{ padding: 24 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <h3
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 15,
                        fontWeight: 600,
                      }}
                    >
                      Trade History
                    </h3>
                    <DataBadge status="live" label="REAL TRADES" />
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {trades.length} trades fetched from Polymarket Data API
                  </p>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: "0 4px",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <thead>
                    <tr>
                      {["Time", "Market", "Side", "Outcome", "Size", "Price"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 500,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            borderBottom: "1px solid var(--border-subtle)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTrades.map((trade, i) => {
                      const ts = trade.timestamp
                        ? new Date(
                            typeof trade.timestamp === "number" && trade.timestamp < 1e12
                              ? trade.timestamp * 1000
                              : trade.timestamp
                          )
                        : null;
                      const side = (trade.side || "").toUpperCase();
                      const isBuy = side === "BUY" || side === "B";

                      return (
                        <tr
                          key={trade.transactionHash || i}
                          style={{
                            animation: `fadeInUp 0.3s var(--ease-out) ${i * 20}ms both`,
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 12px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: "var(--text-muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ts
                              ? ts.toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "\u2014"}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontSize: 12,
                              fontWeight: 500,
                              color: "var(--text-primary)",
                              maxWidth: 280,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={trade.title}
                          >
                            {trade.title ||
                              (trade.conditionId
                                ? trade.conditionId.slice(0, 12) + "..."
                                : "\u2014")}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              className={`badge ${isBuy ? "badge-accent" : "badge-red"}`}
                              style={{ fontSize: 10 }}
                            >
                              {side}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontSize: 11,
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {trade.outcome || "\u2014"}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              color: "var(--text-secondary)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {trade.size
                              ? `$${Number(trade.size).toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                })}`
                              : "\u2014"}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {trade.price
                              ? `${(parseFloat(trade.price) * 100).toFixed(1)}\u00A2`
                              : "\u2014"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {trades.length > 25 && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button
                    className="btn-ghost"
                    onClick={() => setShowAllTrades(!showAllTrades)}
                    style={{ fontSize: 12 }}
                  >
                    {showAllTrades ? "Show Less" : `Show All ${trades.length} Trades`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compute overview statistics from real trade data + profile
function computeOverviewStats(trades, profile) {
  const sizes = trades.map((t) => parseFloat(t.size)).filter((s) => s > 0);
  const totalVolume = sizes.reduce((a, b) => a + b, 0);

  const uniqueMarkets = new Set(trades.map((t) => t.title || t.conditionId)).size;

  const timestamps = trades
    .map((t) => {
      if (typeof t.timestamp === "number") {
        return t.timestamp > 1e12 ? t.timestamp : t.timestamp * 1000;
      }
      return null;
    })
    .filter(Boolean)
    .sort();

  // Account age: from oldest trade to now
  const oldestTrade = timestamps.length > 0 ? timestamps[0] : null;
  let accountAge = null;
  if (oldestTrade) {
    const days = (Date.now() - oldestTrade) / 86400000;
    if (days >= 365) accountAge = `${(days / 365).toFixed(1)}yr`;
    else if (days >= 30) accountAge = `${Math.floor(days / 30)}mo`;
    else accountAge = `${Math.floor(days)}d`;
  }

  // Win rate: estimate from buy-sell pairs
  const winRate = computeWinRate(trades);

  // P&L: use profile if available, otherwise estimate from volume
  let pnl = null;
  let pnlColor = "var(--text-primary)";
  if (profile && profile.pnl !== undefined && profile.pnl !== null) {
    const pnlNum = Number(profile.pnl);
    pnl = `${pnlNum >= 0 ? "+" : ""}$${Math.abs(pnlNum).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    pnlColor = pnlNum >= 0 ? "var(--accent)" : "var(--negative)";
  }

  const stats = [
    { label: "Total Trades", value: trades.length },
    { label: "Total P&L", value: pnl, color: pnlColor },
    { label: "Win Rate", value: winRate !== null ? `${winRate}%` : null },
    { label: "Markets Traded", value: uniqueMarkets },
    { label: "Account Age", value: accountAge },
  ];

  return stats;
}

// Compute win rate from buy-sell pair matching
function computeWinRate(trades) {
  const byMarket = {};
  trades.forEach((t) => {
    const key = t.title || t.conditionId || "unknown";
    if (!byMarket[key]) byMarket[key] = [];
    byMarket[key].push(t);
  });

  let wins = 0;
  let total = 0;

  Object.values(byMarket).forEach((marketTrades) => {
    const sorted = [...marketTrades].sort((a, b) => {
      const ta = typeof a.timestamp === "number"
        ? (a.timestamp > 1e12 ? a.timestamp : a.timestamp * 1000)
        : 0;
      const tb = typeof b.timestamp === "number"
        ? (b.timestamp > 1e12 ? b.timestamp : b.timestamp * 1000)
        : 0;
      return ta - tb;
    });

    let lastBuy = null;
    sorted.forEach((t) => {
      const side = (t.side || "").toUpperCase();
      if (side === "BUY" || side === "B") {
        lastBuy = t;
      } else if ((side === "SELL" || side === "S") && lastBuy) {
        const buyPrice = parseFloat(lastBuy.price) || 0;
        const sellPrice = parseFloat(t.price) || 0;
        if (sellPrice > buyPrice) wins++;
        total++;
        lastBuy = null;
      }
    });
  });

  if (total < 3) return null;
  return Math.round((wins / total) * 100);
}
