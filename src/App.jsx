import { useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Header from "./components/layout/Header";
import WalletStalker from "./components/wallet/WalletStalker";
import AgentTracker from "./components/tracker/AgentTracker";
import ArbitrageScanner from "./components/arbitrage/ArbitrageScanner";
import LandingPage from "./components/pages/LandingPage";
import LoginPage from "./components/pages/LoginPage";
import SignupPage from "./components/pages/SignupPage";
import { ToastProvider } from "./components/shared/Toast";
import BackgroundPaths from "./components/three/BackgroundPaths";

const pathToTab = {
  "/wallet-stalker": "wallet-stalker",
  "/agent-tracker": "agent-tracker",
  "/arbitrage-scanner": "arbitrage-scanner",
};

const tabToPath = {
  "wallet-stalker": "/wallet-stalker",
  "agent-tracker": "/agent-tracker",
  "arbitrage-scanner": "/arbitrage-scanner",
};


const pageVariants = {
  initial: { opacity: 0, y: 20, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.3, ease: [0.32, 0, 0.67, 0] } },
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("dexio_logged_in") === "true";
  });

  const activeTab = pathToTab[location.pathname] || "";
  const handleTabChange = (tabId) => navigate(tabToPath[tabId]);

  const handleLogin = () => {
    localStorage.setItem("dexio_logged_in", "true");
    setIsLoggedIn(true);
    navigate("/wallet-stalker");
  };

  const handleLogout = () => {
    localStorage.removeItem("dexio_logged_in");
    setIsLoggedIn(false);
    navigate("/");
  };

  const isAuthPage = ["/login", "/signup"].includes(location.pathname);
  const isLanding = location.pathname === "/";
  const showHeader = isLoggedIn && !isAuthPage && !isLanding;


  return (
    <ToastProvider>
      {/* Persistent 3D background — lives outside router, never remounts */}
      <BackgroundPaths />

      {/* App content layer */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {showHeader && (
          <Header activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} />
        )}

        <main
          style={
            showHeader
              ? { paddingTop: 72, paddingBottom: 40, paddingLeft: "clamp(16px, 3vw, 32px)", paddingRight: "clamp(16px, 3vw, 32px)", maxWidth: 1400, margin: "0 auto" }
              : {}
          }
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Routes location={location}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
                <Route path="/signup" element={<SignupPage onLogin={handleLogin} />} />
                <Route path="/wallet-stalker" element={<WalletStalker />} />
                <Route path="/agent-tracker" element={<AgentTracker />} />
                <Route path="/arbitrage-scanner" element={<ArbitrageScanner />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </ToastProvider>
  );
}
