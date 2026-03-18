import { useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Header from "./components/layout/Header";
import MarketExplorer from "./components/markets/MarketExplorer";
import AIAnalysisPanel from "./components/ai/AIAnalysisPanel";
import Analytics from "./components/analytics/Analytics";
import Reports from "./components/reports/Reports";
import WalletStalker from "./components/wallet/WalletStalker";
import CopyBotSimulator from "./components/copybot/CopyBotSimulator";
import BotLeaderboard from "./components/leaderboard/BotLeaderboard";
import { ToastProvider } from "./components/shared/Toast";

const pathToTab = {
  "/": "markets",
  "/analytics": "analytics",
  "/reports": "reports",
  "/wallet-stalker": "wallet-stalker",
  "/copy-bot": "copy-bot",
  "/bot-leaderboard": "bot-leaderboard",
};

const tabToPath = {
  markets: "/",
  analytics: "/analytics",
  reports: "/reports",
  "wallet-stalker": "/wallet-stalker",
  "copy-bot": "/copy-bot",
  "bot-leaderboard": "/bot-leaderboard",
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLive, setIsLive] = useState(false);
  const [markets, setMarkets] = useState([]);
  const [analyzingMarket, setAnalyzingMarket] = useState(null);

  const activeTab = pathToTab[location.pathname] || "markets";
  const handleTabChange = (tabId) => navigate(tabToPath[tabId]);

  const handleAnalyze = (market) => {
    setAnalyzingMarket(market);
  };

  return (
    <ToastProvider>
      <Header activeTab={activeTab} onTabChange={handleTabChange} isLive={isLive} />

      <main style={{ paddingTop: 84, paddingBottom: 40, paddingLeft: 32, paddingRight: 32, maxWidth: 1400, margin: "0 auto" }}>
        <Routes>
          <Route
            path="/"
            element={
              <MarketExplorer
                onAnalyze={handleAnalyze}
                setIsLive={setIsLive}
                setMarkets={setMarkets}
              />
            }
          />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports markets={markets} />} />
          <Route path="/wallet-stalker" element={<WalletStalker />} />
          <Route path="/copy-bot" element={<CopyBotSimulator />} />
          <Route path="/bot-leaderboard" element={<BotLeaderboard />} />
        </Routes>
      </main>

      {analyzingMarket && (
        <AIAnalysisPanel
          market={analyzingMarket}
          onClose={() => setAnalyzingMarket(null)}
        />
      )}
    </ToastProvider>
  );
}
