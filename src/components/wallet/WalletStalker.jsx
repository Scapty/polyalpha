import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchWalletTrades, fetchTraderProfile, fetchWalletPositions, fetchMarketResolutions } from "../../utils/api";
import { calculateBotScore } from "../../utils/botScoring";
import WalletInput from "./WalletInput";
import BotScoreGauge from "./BotScoreGauge";
import FactorBreakdown from "./FactorBreakdown";
import MarketCategoryBreakdown from "./MarketCategoryBreakdown";
import CopyTradingSimulator from "./CopyTradingSimulator";
import WalletTracker from "./WalletTracker";
import ActivityHeatmap from "./ActivityHeatmap";
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
  const [positions, setPositions] = useState([]);
  const [marketResolutions, setMarketResolutions] = useState(new Map());
  const [resolutionsLoading, setResolutionsLoading] = useState(false);

  const lastAnalyzedRef = useRef("");

  // Auto-analyze if address is passed via URL params (from Leaderboard click)
  useEffect(() => {
    const urlAddress = searchParams.get("address");
    if (urlAddress && urlAddress !== lastAnalyzedRef.current) {
      lastAnalyzedRef.current = urlAddress;
      setAddress(urlAddress);
      runAnalysis(urlAddress);
    }
  }, [searchParams]);

  async function runAnalysis(walletAddr) {
    if (!walletAddr || !walletAddr.trim()) return;

    setLoading(true);
    setResult(null);
    setTrades([]);
    setError(null);
    setProfile(null);
    setShowAllTrades(false);
    setTraderName(null);
    setPositions([]);
    setMarketResolutions(new Map());
    setResolutionsLoading(false);

    try {
      const [tradesResult, profileResult, positionsResult] = await Promise.all([
        fetchWalletTrades(walletAddr.trim()),
        fetchTraderProfile(walletAddr.trim()),
        fetchWalletPositions(walletAddr.trim()),
      ]);

      setTrades(tradesResult.trades);
      setIsLive(tradesResult.isLive);
      setError(tradesResult.error);
      setProfile(profileResult.profile);
      setPositions(positionsResult.positions);

      // Name: prefer leaderboard username, fall back to first trade name
      const name =
        profileResult.profile?.userName ||
        (tradesResult.trades.length > 0 ? tradesResult.trades[0].name : null);
      if (name) setTraderName(name);

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

      // Fetch market resolutions in the background after main analysis completes
      if (tradesResult.trades.length > 0) {
        setResolutionsLoading(true);
        fetchMarketResolutions(tradesResult.trades).then((resMap) => {
          setMarketResolutions(resMap);
          setResolutionsLoading(false);
        });
      }
    } catch (err) {
      console.error("Wallet analysis failed:", err);
      setError("Failed to analyze wallet. Please try again.");
    }

    setLoading(false);
  }

  async function handleAnalyze(addr) {
    const walletAddr = (typeof addr === "string" ? addr : "") || address;
    lastAnalyzedRef.current = walletAddr;
    return runAnalysis(walletAddr);
  }

  const displayedTrades = showAllTrades ? trades : trades.slice(0, 25);

  // Compute overview stats from trades + profile
  const overviewStats = trades.length > 0 ? computeOverviewStats(trades, profile, positions) : null;

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

      {/* Landing — value proposition (shown when no analysis is running) */}
      {!result && !loading && !error && (
        <div style={{ marginTop: 16 }}>
          {/* Features grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { icon: "🤖", title: "Bot Detection", desc: "6-factor behavioral algorithm classifies any wallet as Bot, Human, or Uncertain based on trade patterns." },
              { icon: "📊", title: "Odds Analyzer", desc: "Compare odds across Polymarket and Kalshi. AI-powered resolution condition comparison." },
              { icon: "📈", title: "Copy Trading Sim", desc: "Simulate what would happen if you copied a trader's strategy with your own capital." },
            ].map((f) => (
              <div key={f.title} className="glass-card" style={{ padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>{f.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="glass-card" style={{ padding: 20, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            {[
              { value: "500+", label: "Markets Tracked" },
              { value: "2", label: "Platforms Compared" },
              { value: "Real-time", label: "Orderbook Data" },
              { value: "AI-Powered", label: "Analysis Engine" },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            {profile?.rank && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--accent)",
                  background: "rgba(0,212,170,0.08)",
                  border: "1px solid rgba(0,212,170,0.2)",
                  borderRadius: 4,
                  padding: "2px 8px",
                }}
              >
                {profile.rank} all-time
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
            <button
              onClick={() => window.print()}
              style={{
                marginLeft: "auto", padding: "5px 14px", fontSize: 11,
                fontFamily: "var(--font-mono)", fontWeight: 600,
                background: "rgba(0,212,170,0.1)", color: "var(--accent)",
                border: "1px solid rgba(0,212,170,0.2)", borderRadius: 6,
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Export PDF
            </button>
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
                    {stat.subtext && (
                      <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--font-body)" }}>
                        {stat.subtext}
                      </div>
                    )}
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

          {/* Section 4: Activity Heatmap (compact) */}
          {result.classification !== "Insufficient Data" && trades.length >= 20 && (
            <ActivityHeatmap trades={trades} />
          )}

          {/* Section 5: Copy Trading Simulator */}
          {result.classification !== "Insufficient Data" && (
            <CopyTradingSimulator
              trades={trades}
              traderName={traderName || "this trader"}
              marketResolutions={marketResolutions}
              resolutionsLoading={resolutionsLoading}
            />
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

// ─── Analyze closed trades (buy-sell pairs) ───
function analyzeClosedTrades(trades) {
  const byMarket = {};
  trades.forEach((t) => {
    const key = t.title || t.conditionId || "unknown";
    if (!byMarket[key]) byMarket[key] = [];
    byMarket[key].push(t);
  });

  const closedTrades = [];
  let wins = 0;
  let losses = 0;
  let totalPnl = 0;

  Object.entries(byMarket).forEach(([market, marketTrades]) => {
    const sorted = [...marketTrades].sort((a, b) => {
      const ta = typeof a.timestamp === "number" ? (a.timestamp > 1e12 ? a.timestamp : a.timestamp * 1000) : 0;
      const tb = typeof b.timestamp === "number" ? (b.timestamp > 1e12 ? b.timestamp : b.timestamp * 1000) : 0;
      return ta - tb;
    });

    const buyStack = [];
    sorted.forEach((t) => {
      const side = (t.side || "").toUpperCase();
      if (side === "BUY" || side === "B") {
        buyStack.push(t);
      } else if ((side === "SELL" || side === "S") && buyStack.length > 0) {
        const buy = buyStack.shift();
        const buyPrice = parseFloat(buy.price) || 0;
        const sellPrice = parseFloat(t.price) || 0;
        const buySize = parseFloat(buy.size) || 0;
        const sellSize = parseFloat(t.size) || 0;
        const size = Math.min(buySize, sellSize);
        const pnl = (sellPrice - buyPrice) * size;
        const isWin = sellPrice > buyPrice;
        if (isWin) wins++;
        else losses++;
        totalPnl += pnl;
        closedTrades.push({
          market, buyPrice, sellPrice, size, pnl, isWin,
          buyTime: buy.timestamp, sellTime: t.timestamp,
        });
      }
    });
  });

  const total = wins + losses;
  const winRate = total >= 3 ? Math.round((wins / total) * 100) : null;

  return { closedTrades, wins, losses, total, winRate, totalPnl };
}

// Compute overview statistics — ONLY show what we can verify from API data
function computeOverviewStats(trades, profile, positions = []) {
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

  const oldestTrade = timestamps.length > 0 ? timestamps[0] : null;
  let dataWindow = null;
  if (oldestTrade) {
    const days = (Date.now() - oldestTrade) / 86400000;
    if (days >= 365) dataWindow = `${(days / 365).toFixed(1)}yr`;
    else if (days >= 30) dataWindow = `${Math.floor(days / 30)}mo`;
    else dataWindow = `${Math.floor(days)}d`;
  }

  // Analyze closed trades (buy-sell pairs) for win rate
  const analysis = analyzeClosedTrades(trades);

  // Count buys vs sells — reliable, directly from API
  const buys = trades.filter((t) => (t.side || "").toUpperCase() === "BUY").length;
  const sells = trades.filter((t) => (t.side || "").toUpperCase() === "SELL").length;

  // Volume from leaderboard (all-time, most accurate) if available
  // Otherwise fall back to sum of size×price across available trades
  let volStr = null;
  if (profile?.volume && profile.volume > 0) {
    const v = profile.volume;
    volStr = v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v).toLocaleString()}`;
  } else {
    const tradeVol = trades.reduce((sum, t) => sum + (parseFloat(t.size) || 0) * (parseFloat(t.price) || 0), 0);
    if (tradeVol > 0) {
      volStr = tradeVol >= 1_000_000 ? `$${(tradeVol / 1_000_000).toFixed(1)}M` : `$${Math.round(tradeVol).toLocaleString()}`;
    }
  }
  const volSubtext = profile?.volume
    ? "all-time (Polymarket leaderboard)"
    : trades.length >= 1000 ? "from last 1,000 trades" : null;

  // All-time P&L from leaderboard — real data from Polymarket
  let pnlStr = null;
  let pnlColor = null;
  if (profile?.pnl != null) {
    const p = profile.pnl;
    pnlStr = p >= 0
      ? `+$${p >= 1_000_000 ? (p / 1_000_000).toFixed(2) + "M" : Math.round(p).toLocaleString()}`
      : `-$${Math.abs(p) >= 1_000_000 ? (Math.abs(p) / 1_000_000).toFixed(2) + "M" : Math.round(Math.abs(p)).toLocaleString()}`;
    pnlColor = p >= 0 ? "var(--accent)" : "var(--negative)";
  }

  // Open positions from /positions endpoint
  const openPositions = positions.filter((p) => p.curPrice > 0 && !p.redeemable);
  const unrealizedPnl = openPositions.reduce((sum, p) => sum + (p.cashPnl || 0), 0);
  const openPortfolioValue = openPositions.reduce((sum, p) => sum + (p.currentValue || 0), 0);

  const tradeLabel = trades.length >= 1000 ? "1,000+" : trades.length.toLocaleString();
  const winRateColor = analysis.winRate !== null
    ? (analysis.winRate >= 55 ? "var(--accent)" : analysis.winRate <= 45 ? "var(--negative)" : "var(--text-primary)")
    : null;

  const stats = [
    { label: "Total Trades", value: tradeLabel, subtext: trades.length >= 1000 ? "API limit — last 1,000 shown" : null },
  ];

  if (volStr) {
    stats.push({ label: "Volume", value: volStr, subtext: volSubtext });
  }

  // All-time P&L (only from leaderboard — real Polymarket data)
  if (pnlStr) {
    stats.push({ label: "All-Time P&L", value: pnlStr, color: pnlColor, subtext: "Polymarket leaderboard" });
  }

  stats.push({ label: "Buy / Sell", value: `${buys} / ${sells}`, subtext: sells === 0 ? "holds to resolution" : null });
  stats.push({ label: "Markets Traded", value: uniqueMarkets });
  stats.push({ label: "Data Window", value: dataWindow, subtext: "span of available trades" });

  // Open portfolio (from positions endpoint — real-time)
  if (openPositions.length > 0) {
    const portVal = openPortfolioValue >= 1_000_000
      ? `$${(openPortfolioValue / 1_000_000).toFixed(2)}M`
      : `$${Math.round(openPortfolioValue).toLocaleString()}`;
    const unrealStr = unrealizedPnl >= 0
      ? `+$${Math.round(Math.abs(unrealizedPnl)).toLocaleString()}`
      : `-$${Math.round(Math.abs(unrealizedPnl)).toLocaleString()}`;
    stats.push({
      label: "Open Positions",
      value: portVal,
      color: unrealizedPnl >= 0 ? "var(--accent)" : "var(--negative)",
      subtext: `${openPositions.length} open · unrealized ${unrealStr}`,
    });
  }

  // Win rate from closed buy→sell pairs
  if (analysis.winRate !== null) {
    stats.push({
      label: "Win Rate",
      value: `${analysis.winRate}%`,
      color: winRateColor,
      subtext: `${analysis.wins}W / ${analysis.losses}L (${analysis.total} closed pairs)`,
    });
  }

  return stats;
}
