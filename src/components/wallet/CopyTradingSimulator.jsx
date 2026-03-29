import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { simulateWalletCopyTrading } from "../../utils/walletCopyEngine";

const PCT_OPTIONS = [2, 5, 10, 15, 20, 30];
const SLIPPAGE_OPTIONS = [0, 0.5, 1, 2, 3, 5];

const STRATEGIES = [
  { id: "fixed", label: "Fixed", desc: "Same dollar amount per trade. Simple and predictable." },
  { id: "compound", label: "Compound", desc: "Bet % of current equity. Gains reinvested, losses reduce future bets." },
  { id: "martingale", label: "Martingale", desc: "Double after each loss, reset after win. High risk on losing streaks." },
  { id: "anti-martingale", label: "Anti-Martingale", desc: "Double after each win, reset after loss. Rides winning streaks." },
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const resultColor = d.isWin ? "var(--green, #10B981)" : "var(--red, #EF4444)";

  return (
    <div style={{
      background: "var(--bg-elevated, #1A1A24)",
      border: "1px solid var(--border, rgba(255,255,255,0.06))",
      borderRadius: 0,
      padding: "10px 14px",
      fontSize: 12,
      fontFamily: "var(--font-mono, 'JetBrains Mono')",
      maxWidth: 300,
      color: "var(--text-primary, #F0F0F5)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      {d.market && (
        <div style={{ color: "var(--text-primary, #F0F0F5)", fontWeight: 600, marginBottom: 4, lineHeight: 1.3, fontSize: 11 }}>
          {d.market.length > 65 ? d.market.slice(0, 62) + "\u2026" : d.market}
        </div>
      )}

      <div style={{ color: "var(--text-muted, #555568)", marginBottom: 8, fontSize: 10 }}>
        {d.date || `Trade #${d.trade}`}
        {d.isWin !== undefined && (
          <span style={{ marginLeft: 6, fontWeight: 700, color: resultColor }}>
            {d.isWin ? "WIN" : "LOSS"}
          </span>
        )}
      </div>

      {d.entryPrice != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ color: "var(--text-muted, #555568)" }}>Entry</span>
          <span style={{ color: "var(--text-secondary, #8888A0)" }}>{(d.entryPrice * 100).toFixed(1)}\u00A2</span>
        </div>
      )}
      {d.exitPrice != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ color: "var(--text-muted, #555568)" }}>Exit</span>
          <span style={{ fontWeight: 600, color: resultColor }}>
            {(d.exitPrice * 100).toFixed(1)}\u00A2
            {d.returnPct != null && (
              <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.85 }}>
                ({d.returnPct > 0 ? "+" : ""}{(d.returnPct * 100).toFixed(0)}%)
              </span>
            )}
          </span>
        </div>
      )}
      {d.slippageCost > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 6 }}>
          <span style={{ color: "var(--text-muted, #555568)" }}>Slippage</span>
          <span style={{ color: "#F59E0B", fontSize: 11 }}>-${d.slippageCost.toLocaleString()}</span>
        </div>
      )}

      {d.betAmount != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ color: "var(--text-muted, #555568)" }}>Bet</span>
          <span style={{ color: "var(--text-secondary, #8888A0)" }}>${d.betAmount.toLocaleString()}</span>
        </div>
      )}
      {d.gainLoss != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 6 }}>
          <span style={{ color: "var(--text-muted, #555568)" }}>P&L</span>
          <span style={{ fontWeight: 700, color: resultColor }}>
            {d.gainLoss >= 0 ? "+" : ""}${d.gainLoss.toLocaleString()}
          </span>
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border, rgba(255,255,255,0.06))", paddingTop: 6, marginTop: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "var(--text-muted, #555568)" }}>Equity</span>
          <span style={{ fontWeight: 600, color: "var(--text-primary, #F0F0F5)" }}>${d.equity?.toLocaleString()}</span>
        </div>
        {d.drawdown > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 2 }}>
            <span style={{ color: "var(--text-muted, #555568)" }}>Drawdown</span>
            <span style={{ fontWeight: 600, color: d.drawdown > 15 ? "var(--red, #EF4444)" : "var(--text-secondary, #8888A0)" }}>
              {d.drawdown.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function CopyTradingSimulator({
  trades,
  traderName,
  marketResolutions,
  resolutionsLoading,
}) {
  const [initialAmount, setInitialAmount] = useState(1000);
  const [positionPct, setPositionPct] = useState(10);
  const [slippage, setSlippage] = useState(1);
  const [strategy, setStrategy] = useState("fixed");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);

  const hasRun = useRef(false);
  const prevResolutionsLoading = useRef(resolutionsLoading);

  if (!trades || trades.length < 5) return null;

  function runSim(amount = initialAmount, pct = positionPct, strat = strategy, slip = slippage) {
    if (resolutionsLoading) {
      setStatus("loading");
      setResult(null);
      return;
    }

    const gammaSim = simulateWalletCopyTrading(trades, amount, marketResolutions, pct, strat, slip);
    if (gammaSim && gammaSim.numTrades >= 3) {
      setResult(gammaSim);
      setStatus("ready");
      return;
    }

    setStatus("no-data");
    setResult(null);
  }

  function handleRun() {
    hasRun.current = true;
    runSim();
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (prevResolutionsLoading.current && !resolutionsLoading && hasRun.current) {
      runSim();
    }
    prevResolutionsLoading.current = resolutionsLoading;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolutionsLoading]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (hasRun.current && !resolutionsLoading) {
      runSim(initialAmount, positionPct, strategy, slippage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, slippage]);

  const isProfit = result && result.finalEquity >= result.initialAmount;
  const curveColor = isProfit ? "var(--green, #10B981)" : "var(--red, #EF4444)";
  const curveColorRaw = isProfit ? "#10B981" : "#EF4444";
  const buttonDisabled = resolutionsLoading;

  return (
    <div
      style={{
        background: "var(--bg-deep)",
        border: "1px solid var(--border, rgba(255,255,255,0.06))",
        borderRadius: 0,
        padding: 24,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary, #F0F0F5)", marginBottom: 4, fontFamily: "var(--font-display, 'Space Grotesk')" }}>
        Copy Trading Simulator
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted, #555568)", marginBottom: 20, fontFamily: "var(--font-body, 'Inter')" }}>
        Simulates copying <b>{traderName || "this trader"}</b>'s closed positions chronologically.
        Each trade uses a fixed % of your remaining capital.
      </p>

      {/* Config */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <label style={{
            display: "block", fontSize: 11, fontFamily: "var(--font-mono, 'JetBrains Mono')",
            color: "var(--text-muted, #555568)", textTransform: "uppercase",
            letterSpacing: "0.05em", marginBottom: 4,
          }}>
            Starting Capital ($)
          </label>
          <input
            type="number"
            value={initialAmount}
            onChange={(e) => setInitialAmount(Math.max(100, Number(e.target.value)))}
            min={100}
            step={100}
            style={{
              width: 130, height: 36, padding: "0 12px",
              background: "var(--bg-deep, #0A0A0F)", border: "1px solid var(--border, rgba(255,255,255,0.06))",
              borderRadius: 0, color: "var(--text-primary, #F0F0F5)",
              fontFamily: "var(--font-mono, 'JetBrains Mono')", fontSize: 13, outline: "none",
              transition: "border-color 150ms ease",
            }}
            onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
            onBlur={(e) => e.target.style.borderColor = "var(--border, rgba(255,255,255,0.06))"}
          />
        </div>

        <div>
          <label style={{
            display: "block", fontSize: 11, fontFamily: "var(--font-mono, 'JetBrains Mono')",
            color: "var(--text-muted, #555568)", textTransform: "uppercase",
            letterSpacing: "0.05em", marginBottom: 4,
          }}>
            % Per Trade
          </label>
          <div style={{ display: "flex", gap: 4 }}>
            {PCT_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => setPositionPct(p)}
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  fontFamily: "var(--font-mono, 'JetBrains Mono')",
                  fontWeight: positionPct === p ? 600 : 400,
                  background: positionPct === p ? "var(--accent)" : "var(--bg-deep, #0A0A0F)",
                  color: positionPct === p ? "#fff" : "var(--text-secondary, #8888A0)",
                  border: `1px solid ${positionPct === p ? "var(--accent)" : "var(--border, rgba(255,255,255,0.06))"}`,
                  borderRadius: 0,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{
            display: "block", fontSize: 11, fontFamily: "var(--font-mono, 'JetBrains Mono')",
            color: "var(--text-muted, #555568)", textTransform: "uppercase",
            letterSpacing: "0.05em", marginBottom: 4,
          }}>
            Slippage / Position
          </label>
          <div style={{ display: "flex", gap: 4 }}>
            {SLIPPAGE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  fontFamily: "var(--font-mono, 'JetBrains Mono')",
                  fontWeight: slippage === s ? 600 : 400,
                  background: slippage === s ? "var(--accent)" : "var(--bg-deep, #0A0A0F)",
                  color: slippage === s ? "#fff" : "var(--text-secondary, #8888A0)",
                  border: `1px solid ${slippage === s ? "var(--accent)" : "var(--border, rgba(255,255,255,0.06))"}`,
                  borderRadius: 0,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>

        <div style={{ flexBasis: "100%", marginTop: 4 }}>
          <label style={{
            display: "block", fontSize: 11, fontFamily: "var(--font-mono, 'JetBrains Mono')",
            color: "var(--text-muted, #555568)", textTransform: "uppercase",
            letterSpacing: "0.05em", marginBottom: 6,
          }}>
            Strategy
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STRATEGIES.map((s) => {
              const active = strategy === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s.id)}
                  title={s.desc}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    fontFamily: "var(--font-mono, 'JetBrains Mono')",
                    fontWeight: active ? 600 : 400,
                    background: active ? "var(--accent)" : "var(--bg-deep, #0A0A0F)",
                    color: active ? "#fff" : "var(--text-secondary, #8888A0)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border, rgba(255,255,255,0.06))"}`,
                    borderRadius: 0,
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted, #555568)", lineHeight: 1.4, fontFamily: "var(--font-body, 'Inter')" }}>
            {STRATEGIES.find((s) => s.id === strategy)?.desc}
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={handleRun}
          disabled={buttonDisabled}
          style={{ height: 36, padding: "0 24px", whiteSpace: "nowrap" }}
        >
          {buttonDisabled ? "Loading data\u2026" : "Run Simulation"}
        </button>
      </div>

      {status === "loading" && (
        <p style={{ padding: "16px 0", fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-body, 'Inter')" }}>
          Loading market data\u2026 simulation will run automatically when ready.
        </p>
      )}

      {status === "no-data" && (
        <p style={{ padding: "16px 0", fontSize: 12, color: "var(--text-muted, #555568)", fontFamily: "var(--font-body, 'Inter')" }}>
          Not enough closed trades found in the last {trades.length.toLocaleString()} transactions (minimum 3 required).
          This wallet may have no resolved markets yet, or all positions are still open.
        </p>
      )}

      {result && status === "ready" && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            {[
              {
                label: "Final Equity",
                value: `$${result.initialAmount.toLocaleString()} \u2192 $${result.finalEquity.toLocaleString()}`,
                color: isProfit ? "var(--green, #10B981)" : "var(--red, #EF4444)",
              },
              {
                label: "ROI",
                value: `${result.roi > 0 ? "+" : ""}${result.roi}%`,
                color: isProfit ? "var(--green, #10B981)" : "var(--red, #EF4444)",
              },
              {
                label: "Max Drawdown",
                value: `${result.maxDrawdown.toFixed(1)}%`,
                color: result.maxDrawdown > 20 ? "var(--red, #EF4444)" : result.maxDrawdown > 10 ? "#F59E0B" : "var(--green, #10B981)",
              },
              {
                label: "Win / Loss",
                value: `${result.winCount}W / ${result.lossCount}L`,
                color: "var(--text-primary, #F0F0F5)",
              },
              {
                label: "Slippage Cost",
                value: result.slippagePct > 0
                  ? `-$${result.totalSlippageCost.toLocaleString()}`
                  : "None",
                color: result.slippagePct > 0 ? "var(--warning, #F59E0B)" : "var(--text-muted, #555568)",
              },
              {
                label: "Closed Trades",
                value: result.numTrades < result.totalClosedFound
                  ? `${result.numTrades} / ${result.totalClosedFound}`
                  : `${result.numTrades}`,
                color: "var(--text-muted, #555568)",
              },
            ].map((stat) => (
              <div key={stat.label} className="stat-card">
                <div style={{
                  fontSize: 11, color: "var(--text-muted, #555568)", fontFamily: "var(--font-mono, 'JetBrains Mono')",
                  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
                }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 16, fontFamily: "var(--font-mono, 'JetBrains Mono')", fontWeight: 500, color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={result.equityCurve} margin={{ top: 5, right: 5, bottom: 5, left: -5 }}>
              <defs>
                <linearGradient id="copySimGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={curveColorRaw} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={curveColorRaw} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="trade"
                tick={{ fill: '#555568', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v) => {
                  const pt = result.equityCurve.find((p) => p.trade === v);
                  return pt?.date || "";
                }}
                interval={Math.max(0, Math.ceil(result.numTrades / 6) - 1)}
              />
              <YAxis
                tick={{ fill: '#555568', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={result.initialAmount}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="4 4"
                label={{ value: "Initial", position: "left", fontSize: 9, fill: '#555568' }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={curveColorRaw}
                strokeWidth={1.5}
                fill="url(#copySimGrad)"
                dot={false}
                activeDot={{ r: 3, fill: curveColorRaw }}
              />
            </AreaChart>
          </ResponsiveContainer>

          <p style={{ fontSize: 11, color: "var(--text-muted, #555568)", lineHeight: 1.5, margin: 0, fontFamily: "var(--font-body, 'Inter')" }}>
            {result.totalClosedFound > result.numTrades
              ? `Last ${result.numTrades} of ${result.totalClosedFound} resolved trades (${result.pairTrades} sold before resolution + ${result.resolutionTrades} held to settlement).`
              : `${result.numTrades} resolved trades (${result.pairTrades} sold before resolution + ${result.resolutionTrades} held to settlement).`
            }
            {strategy === "fixed" && ` Fixed bet: $${Math.round(initialAmount * positionPct / 100)} per trade (${positionPct}% of $${initialAmount}).`}
            {strategy === "compound" && ` Compounding: ${positionPct}% of current equity per trade (base $${Math.round(initialAmount * positionPct / 100)}).`}
            {strategy === "martingale" && ` Martingale: starts at $${Math.round(initialAmount * positionPct / 100)}, doubles after each loss (capped at 25% equity).`}
            {strategy === "anti-martingale" && ` Anti-Martingale: starts at $${Math.round(initialAmount * positionPct / 100)}, doubles after each win (capped at 25% equity).`}
            {slippage > 0 && ` Slippage: ${slippage}% deducted per position ($${result.totalSlippageCost.toLocaleString()} total).`}
            {" "}Past performance does not guarantee future results.
          </p>
        </div>
      )}
    </div>
  );
}
