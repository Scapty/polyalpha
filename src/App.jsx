import { useState, useEffect } from "react";
import { Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
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
import { supabase } from "./utils/supabase";
import { usePlan } from "./utils/usePlan";

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

// Protected route wrapper
function ProtectedRoute({ isLoggedIn, children }) {
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const { plan, setPlan, isPro, isElite } = usePlan();

  // Listen to Supabase auth state changes
  useEffect(() => {
    if (!supabase) {
      // No Supabase configured — use localStorage fallback (demo mode)
      setIsLoggedIn(localStorage.getItem("dexio_logged_in") === "true");
      setAuthReady(true);
      return;
    }

    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setAuthReady(true);
    });

    // Subscribe to auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const activeTab = pathToTab[location.pathname] || "";
  const handleTabChange = (tabId) => navigate(tabToPath[tabId]);

  const handleLogin = () => {
    if (!supabase) {
      localStorage.setItem("dexio_logged_in", "true");
    }
    setIsLoggedIn(true);
    navigate("/wallet-stalker");
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem("dexio_logged_in");
    setIsLoggedIn(false);
    navigate("/");
  };

  const isAuthPage = ["/login", "/signup"].includes(location.pathname);
  const isLanding = location.pathname === "/";
  const showHeader = isLoggedIn && !isAuthPage && !isLanding;

  // Show nothing until we know auth state (prevents flash of login page)
  if (!authReady) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "var(--bg-deep, #0A0A0F)",
      }}>
        <div style={{
          fontFamily: "var(--font-display, 'Space Grotesk')",
          fontSize: 18, color: "var(--text-muted, #555568)",
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      {/* Persistent 3D background — lives outside router, never remounts */}
      <BackgroundPaths />

      {/* App content layer */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {showHeader && (
          <Header activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} plan={plan} onPlanChange={setPlan} />
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
                <Route path="/login" element={
                  isLoggedIn ? <Navigate to="/wallet-stalker" replace /> : <LoginPage onLogin={handleLogin} />
                } />
                <Route path="/signup" element={
                  isLoggedIn ? <Navigate to="/wallet-stalker" replace /> : <SignupPage onLogin={handleLogin} />
                } />
                <Route path="/wallet-stalker" element={
                  <ProtectedRoute isLoggedIn={isLoggedIn}><WalletStalker plan={plan} onUpgrade={() => setPlan} setPlan={setPlan} /></ProtectedRoute>
                } />
                <Route path="/agent-tracker" element={
                  <ProtectedRoute isLoggedIn={isLoggedIn}><AgentTracker plan={plan} setPlan={setPlan} /></ProtectedRoute>
                } />
                <Route path="/arbitrage-scanner" element={
                  <ProtectedRoute isLoggedIn={isLoggedIn}><ArbitrageScanner plan={plan} setPlan={setPlan} /></ProtectedRoute>
                } />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </ToastProvider>
  );
}
