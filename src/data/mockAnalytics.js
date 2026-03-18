export const winRateData = [
  { month: "Sep 2025", bot: 83, human: 52 },
  { month: "Oct 2025", bot: 85, human: 49 },
  { month: "Nov 2025", bot: 87, human: 51 },
  { month: "Dec 2025", bot: 86, human: 48 },
  { month: "Jan 2026", bot: 89, human: 53 },
  { month: "Feb 2026", bot: 90, human: 50 },
];

export const cumulativePnL = [
  { month: "Sep 2025", bot: 42000, human: 8000 },
  { month: "Oct 2025", bot: 98000, human: 15000 },
  { month: "Nov 2025", bot: 187000, human: 24000 },
  { month: "Dec 2025", bot: 295000, human: 35000 },
  { month: "Jan 2026", bot: 432000, human: 51000 },
  { month: "Feb 2026", bot: 580000, human: 67000 },
];

export const strategyData = [
  { name: "Arbitrage", accuracy: 92, type: "bot" },
  { name: "News Sentiment", accuracy: 87, type: "bot" },
  { name: "Ensemble ML", accuracy: 83, type: "bot" },
  { name: "Momentum", accuracy: 79, type: "bot" },
  { name: "Fundamental", accuracy: 61, type: "human" },
  { name: "Technical", accuracy: 58, type: "human" },
  { name: "Social Signal", accuracy: 55, type: "human" },
  { name: "Gut Feel", accuracy: 47, type: "human" },
];

export const scatterData = [
  { name: "alpha_bot_7x", trades: 4200, accuracy: 91, pnl: 414000, type: "bot" },
  { name: "ensemble_v3", trades: 3800, accuracy: 87, pnl: 285000, type: "bot" },
  { name: "arb_scanner", trades: 5100, accuracy: 89, pnl: 342000, type: "bot" },
  { name: "polywhale.eth", trades: 2100, accuracy: 63, pnl: 67000, type: "human" },
  { name: "degen_master", trades: 1800, accuracy: 56, pnl: 31000, type: "human" },
  { name: "ml_trader_9", trades: 3200, accuracy: 85, pnl: 198000, type: "bot" },
  { name: "news_alpha", trades: 2800, accuracy: 83, pnl: 156000, type: "bot" },
  { name: "whale_hunter", trades: 1500, accuracy: 59, pnl: 42000, type: "human" },
  { name: "signal_bot_2", trades: 3600, accuracy: 86, pnl: 221000, type: "bot" },
  { name: "crypto_sage", trades: 900, accuracy: 61, pnl: 28000, type: "human" },
  { name: "momentum_ai", trades: 2900, accuracy: 81, pnl: 167000, type: "bot" },
  { name: "tradoor.eth", trades: 1200, accuracy: 54, pnl: 18000, type: "human" },
  { name: "deep_q_net", trades: 4500, accuracy: 88, pnl: 310000, type: "bot" },
  { name: "gut_feeler", trades: 600, accuracy: 51, pnl: 5000, type: "human" },
  { name: "quant_flow", trades: 3100, accuracy: 84, pnl: 189000, type: "bot" },
];

export const radarData = [
  { category: "Crypto", bot: 91, human: 52 },
  { category: "Politics", bot: 72, human: 64 },
  { category: "Economics", bot: 81, human: 58 },
  { category: "Sports", bot: 89, human: 55 },
  { category: "Science", bot: 78, human: 60 },
  { category: "Tech", bot: 84, human: 57 },
];

// These stats are from publicly reported data about Polymarket bots
// Source: Various news reports about the 0x8dxd bot and Theo's accounts
export const insightStats = [
  {
    label: "Top Trader PNL",
    value: "$22M+",
    subtext: "Theo4 (verified)",
    trend: "All-time",
    trendUp: true,
  },
  {
    label: "Famous Bot ROI",
    value: "132,268%",
    subtext: "0x8dxd: $313 → $438K",
    trend: "1 month",
    trendUp: true,
  },
  {
    label: "Bot Win Rate",
    value: "~98%",
    subtext: "0x8dxd (reported)",
    trend: "BTC/ETH markets",
    trendUp: true,
  },
  {
    label: "Platform",
    value: "Polymarket",
    subtext: "Largest prediction market",
    trend: "Active",
    trendUp: true,
  },
];
