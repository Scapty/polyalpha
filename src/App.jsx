import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Header from "./components/layout/Header";
import WalletStalker from "./components/wallet/WalletStalker";
import BotLeaderboard from "./components/leaderboard/BotLeaderboard";
import ArbitrageScanner from "./components/arbitrage/ArbitrageScanner";
import { ToastProvider } from "./components/shared/Toast";

const pathToTab = {
  "/": "wallet-stalker",
  "/bot-leaderboard": "bot-leaderboard",
  "/arbitrage-scanner": "arbitrage-scanner",
};

const tabToPath = {
  "wallet-stalker": "/",
  "bot-leaderboard": "/bot-leaderboard",
  "arbitrage-scanner": "/arbitrage-scanner",
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = pathToTab[location.pathname] || "wallet-stalker";
  const handleTabChange = (tabId) => navigate(tabToPath[tabId]);

  return (
    <ToastProvider>
      <Header activeTab={activeTab} onTabChange={handleTabChange} />

      <main style={{ paddingTop: 84, paddingBottom: 40, paddingLeft: 32, paddingRight: 32, maxWidth: 1400, margin: "0 auto" }}>
        <Routes>
          <Route path="/" element={<WalletStalker />} />
          <Route path="/bot-leaderboard" element={<BotLeaderboard />} />
          <Route path="/arbitrage-scanner" element={<ArbitrageScanner />} />
        </Routes>
      </main>
    </ToastProvider>
  );
}
