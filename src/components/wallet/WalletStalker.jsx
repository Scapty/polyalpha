import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchWalletTrades, fetchTraderProfile, fetchWalletPositions, fetchMarketResolutions } from "../../utils/api";
import { computeWalletMetrics } from "../../utils/walletMetrics";
import { classifyTrader, clearClassificationCache, fallbackClassification } from "../../utils/traderClassifier";
import { hasApiKey } from "../../utils/aiAgent";
import GlowingInput from "../shared/GlowingInput";
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
  const [metrics, setMetrics] = useState(null);
  const [classification, setClassification] = useState(null);
  const [classifying, setClassifying] = useState(false);
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

    // Always clear cache so AI fires fresh on every analysis
    clearClassificationCache(walletAddr.trim());

    setLoading(true);
    setMetrics(null);
    setClassification(null);
    setClassifying(false);
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

      const name =
        profileResult.profile?.userName ||
        (tradesResult.trades.length > 0 ? tradesResult.trades[0].name : null);
      if (name) setTraderName(name);

      // Step 1: Compute metrics instantly (sync)
      if (tradesResult.trades.length > 0) {
        const m = computeWalletMetrics(tradesResult.trades, positionsResult.positions);
        setMetrics(m);

        // Step 2: AI classification (async)
        setClassifying(true);
        classifyTrader(walletAddr.trim(), m).then((result) => {
          setClassification(result);
          setClassifying(false);
        });
      }

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
  const overviewStats = trades.length > 0 ? computeOverviewStats(trades, profile, positions) : null;
  const hasData = metrics !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      {/* Page header */}
      <div className="page-header" style={{ animation: "fadeInUp 0.4s var(--ease-smooth) both" }}>
        <div className="section-number">01</div>
        <h1>Wallet Stalker</h1>
        <p>Analyze any Polymarket trader. Bot detection, activity patterns, copy trading simulation.</p>
      </div>

      {/* Input */}
      <GlowingInput
        value={address}
        onChange={setAddress}
        onSubmit={(addr) => handleAnalyze(addr)}
        loading={loading}
        placeholder="Paste a Polymarket wallet address (0x...)"
        buttonText="Analyze"
        loadingText="Scanning..."
      />

      {/* Empty state — minimal */}
      {!hasData && !loading && !error && (
        <div style={{ textAlign: "center", padding: "40px 0 20px", animation: "fadeInUp 0.4s ease both 0.1s" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-ghost)", letterSpacing: "0.02em" }}>
            Paste a wallet address above to start analysis
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          className="animate-fade-in"
          style={{
            background: "var(--bg-deep)",
            border: "1px solid var(--border)",
            borderRadius: 0,
            padding: 48,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "2px solid var(--border)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 20px",
            }}
          />
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "var(--font-display)",
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            Scanning wallet...
          </p>
          <p style={{ fontSize: 13, fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
            Fetching real trade data from Polymarket Data API
          </p>
        </div>
      )}

      {/* Error -- no trades */}
      {!loading && error && trades.length === 0 && (
        <div
          className="animate-fade-in"
          style={{
            background: "var(--bg-deep)",
            border: "1px solid var(--border)",
            borderRadius: 0,
            padding: 32,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "var(--font-display)",
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            No Trade Data Available
          </p>
          <p
            style={{
              fontSize: 14,
              fontFamily: "var(--font-body)",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              maxWidth: 500,
              margin: "0 auto",
            }}
          >
            {error}
          </p>
          {profile && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12, fontFamily: "var(--font-body)" }}>
              This wallet appears on the Polymarket leaderboard, but individual trade data
              isn't available via the public Data API.
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {hasData && !loading && (
        <div
          className="animate-fade-in-up"
          style={{ display: "flex", flexDirection: "column", gap: 48 }}
        >
          {/* Data badge + address bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              padding: "16px 20px",
              background: "var(--bg-deep)",
              border: "1px solid var(--border)",
              borderRadius: 0,
            }}
          >
            <DataBadge status={isLive ? "live" : "demo"} label={isLive ? "LIVE DATA" : "DEMO"} />
            {traderName && (
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
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
                  color: "var(--accent-bright)",
                  background: "var(--accent-glow)",
                  borderRadius: 0,
                  padding: "3px 10px",
                  letterSpacing: "0.02em",
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
                marginLeft: "auto",
                padding: "6px 16px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: 0,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = "var(--accent)";
                e.target.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = "var(--border)";
                e.target.style.color = "var(--text-muted)";
              }}
            >
              Export PDF
            </button>
          </div>

          {/* Overview stat cards */}
          {overviewStats && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 16,
              }}
            >
              {overviewStats
                .filter((s) => s.value !== null && s.value !== undefined)
                .map((stat, i) => (
                  <div
                    key={stat.label}
                    className="stat-card"
                    style={{
                      background: "var(--bg-deep)",
                      border: "1px solid var(--border)",
                      borderTop: "2px solid var(--accent)",
                      borderRadius: 0,
                      padding: 24,
                      animation: `fadeInUp 0.3s ease ${i * 50}ms both`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 10,
                      }}
                    >
                      {stat.label}
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: stat.color || "var(--text-primary)",
                      }}
                    >
                      {stat.value}
                    </div>
                    {stat.subtext && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-ghost)",
                          marginTop: 6,
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {stat.subtext}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Bot Score + AI Breakdown */}
          {!metrics?.insufficient && (
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
              <BotScoreGauge
                score={classification?.score ?? null}
                classification={classifying ? null : (classification?.classification ?? null)}
                confidence={classification?.confidence ?? null}
                strategy={classification?.strategy ?? null}
              />
              <FactorBreakdown
                classification={classification?.classification ?? null}
                reasoning={classification?.reasoning ?? null}
                keySignals={classification?.keySignals ?? null}
                factors={classification?.factors ?? null}
                eliminatedBy={classification?.eliminatedBy ?? null}
                metrics={metrics}
                loading={classifying}
                usingFallback={classification?.usingFallback ?? false}
                hasApiKey={hasApiKey()}
              />
            </div>
          )}

          {/* Re-analyze button (shown after classification) */}
          {classification && !classifying && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -32 }}>
              <button
                onClick={() => {
                  clearClassificationCache(address);
                  setClassification(null);
                  setClassifying(true);
                  classifyTrader(address.trim(), metrics).then((result) => {
                    setClassification(result);
                    setClassifying(false);
                  });
                }}
                style={{
                  padding: "5px 14px",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  background: "transparent",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 0,
                  cursor: "pointer",
                }}
              >
                Re-analyze
              </button>
            </div>
          )}

          {/* Insufficient data */}
          {metrics?.insufficient && (
            <div
              style={{
                background: "var(--bg-deep)",
                border: "1px solid var(--border)",
                borderRadius: 0,
                padding: 32,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
                  color: "var(--text-primary)",
                  marginBottom: 6,
                }}
              >
                Not Enough Trades for Bot Scoring
              </p>
              <p style={{ fontSize: 14, fontFamily: "var(--font-body)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Found {metrics?.tradeCount || 0} trade(s), but we need at least 5 for analysis.
              </p>
            </div>
          )}

          {/* Market Category Breakdown */}
          {!metrics?.insufficient && (
            <MarketCategoryBreakdown trades={trades} />
          )}

          {/* Activity Heatmap */}
          {!metrics?.insufficient && trades.length >= 20 && (
            <ActivityHeatmap trades={trades} />
          )}

          {/* Copy Trading Simulator */}
          {!metrics?.insufficient && (
            <CopyTradingSimulator
              trades={trades}
              traderName={traderName || "this trader"}
              marketResolutions={marketResolutions}
              resolutionsLoading={resolutionsLoading}
            />
          )}

          {/* Track Wallet */}
          {!metrics?.insufficient && (
            <WalletTracker
              walletAddress={address}
              walletLabel={traderName}
              botScore={classification?.score ?? null}
            />
          )}

          {/* Trade history table */}
          {trades.length > 0 && (
            <div
              style={{
                background: "var(--bg-deep)",
                border: "1px solid var(--border)",
                borderRadius: 0,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        fontFamily: "var(--font-display)",
                        color: "var(--text-primary)",
                      }}
                    >
                      Trade History
                    </h3>
                    <DataBadge status="live" label="REAL TRADES" />
                  </div>
                  <p style={{ fontSize: 13, fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
                    {trades.length} trades fetched from Polymarket Data API
                  </p>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr>
                      {["Time", "Market", "Side", "Outcome", "Size", "Price"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 14px",
                            textAlign: "left",
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 500,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            borderBottom: "1px solid var(--border)",
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
                          style={{ borderBottom: "1px solid var(--border)" }}
                        >
                          <td
                            style={{
                              padding: "12px 14px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
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
                              padding: "12px 14px",
                              fontSize: 13,
                              fontFamily: "var(--font-body)",
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
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: 0,
                                fontSize: 11,
                                fontFamily: "var(--font-mono)",
                                fontWeight: 600,
                                letterSpacing: "0.04em",
                                color: isBuy ? "var(--green)" : "var(--red)",
                                background: isBuy
                                  ? "rgba(16, 185, 129, 0.1)"
                                  : "rgba(239, 68, 68, 0.1)",
                              }}
                            >
                              {side}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "12px 14px",
                              fontSize: 12,
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {trade.outcome || "\u2014"}
                          </td>
                          <td
                            style={{
                              padding: "12px 14px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 13,
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
                              padding: "12px 14px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 13,
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
                <div style={{ textAlign: "center", marginTop: 20 }}>
                  <button
                    onClick={() => setShowAllTrades(!showAllTrades)}
                    style={{
                      padding: "8px 20px",
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      background: "transparent",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                      borderRadius: 0,
                      cursor: "pointer",
                      transition: "all 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = "var(--accent)";
                      e.target.style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = "var(--border)";
                      e.target.style.color = "var(--text-muted)";
                    }}
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

  const analysis = analyzeClosedTrades(trades);
  const buys = trades.filter((t) => (t.side || "").toUpperCase() === "BUY").length;
  const sells = trades.filter((t) => (t.side || "").toUpperCase() === "SELL").length;

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
    : trades.length >= 1000 ? `from last ${trades.length.toLocaleString()} trades` : null;

  let pnlStr = null;
  let pnlColor = null;
  if (profile?.pnl != null) {
    const p = profile.pnl;
    pnlStr = p >= 0
      ? `+$${p >= 1_000_000 ? (p / 1_000_000).toFixed(2) + "M" : Math.round(p).toLocaleString()}`
      : `-$${Math.abs(p) >= 1_000_000 ? (Math.abs(p) / 1_000_000).toFixed(2) + "M" : Math.round(Math.abs(p)).toLocaleString()}`;
    pnlColor = p >= 0 ? "var(--green)" : "var(--red)";
  }

  const openPositions = positions.filter((p) => {
    const redeemable = p.redeemable === true || p.redeemable === "true";
    const size = parseFloat(p.size) || 0;
    return !redeemable && size > 0.01;
  });
  const unrealizedPnl = openPositions.reduce((sum, p) => sum + (p.cashPnl || 0), 0);
  const openPortfolioValue = openPositions.reduce((sum, p) => sum + (p.currentValue || 0), 0);

  const tradeLabel = trades.length >= 3000 ? "3,000+" : trades.length >= 1000 ? "1,000+" : trades.length.toLocaleString();
  const winRateColor = analysis.winRate !== null
    ? (analysis.winRate >= 55 ? "var(--green)" : analysis.winRate <= 45 ? "var(--red)" : "var(--text-primary)")
    : null;

  const stats = [
    { label: "Total Trades", value: tradeLabel, subtext: trades.length >= 3000 ? "last 3,000 shown" : trades.length >= 1000 ? "last 1,000 shown" : null },
  ];

  if (volStr) {
    stats.push({ label: "Volume", value: volStr, subtext: volSubtext });
  }

  if (pnlStr) {
    stats.push({ label: "All-Time P&L", value: pnlStr, color: pnlColor, subtext: "Polymarket leaderboard" });
  }

  stats.push({ label: "Buy / Sell", value: `${buys} / ${sells}`, subtext: sells === 0 ? "holds to resolution" : null });
  stats.push({ label: "Markets Traded", value: uniqueMarkets });
  stats.push({ label: "Data Window", value: dataWindow, subtext: "span of available trades" });

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
      color: unrealizedPnl >= 0 ? "var(--green)" : "var(--red)",
      subtext: `${openPositions.length} open · unrealized ${unrealStr}`,
    });
  }

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
