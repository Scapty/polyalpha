import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabase";
import { useToast } from "../shared/Toast";

const MAX_TRACKED = 5;
const LS_KEY = "polyalpha_email";

export default function WalletTracker({ walletAddress, walletLabel, botScore }) {
  const addToast = useToast();
  const [email, setEmail] = useState(() => localStorage.getItem(LS_KEY) || "");
  const [trackedWallets, setTrackedWallets] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  // On mount (or email change from localStorage), fetch tracked wallets
  useEffect(() => {
    if (email && isValidEmail(email)) {
      fetchTrackedWallets(email);
    }
  }, []);

  async function fetchTrackedWallets(userEmail) {
    if (!supabase) return;
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from("tracked_wallets")
        .select("id, wallet_address, wallet_label, bot_score, created_at")
        .eq("email", userEmail)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTrackedWallets(data || []);
    } catch (err) {
      console.error("Failed to fetch tracked wallets:", err);
    }
    setLoadingList(false);
  }

  async function handleStartTracking() {
    if (!email.trim() || !isValidEmail(email)) {
      addToast("Please enter a valid email address", "error");
      return;
    }
    if (!supabase) {
      addToast("Tracking service unavailable", "error");
      return;
    }

    // Check rate limit
    if (trackedWallets.length >= MAX_TRACKED) {
      addToast(`Maximum ${MAX_TRACKED} wallets per email`, "error");
      return;
    }

    // Check if already tracking this wallet
    if (trackedWallets.some((w) => w.wallet_address.toLowerCase() === walletAddress.toLowerCase())) {
      addToast("You're already tracking this wallet", "error");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("tracked_wallets").insert({
        email: email.trim().toLowerCase(),
        wallet_address: walletAddress.toLowerCase(),
        wallet_label: walletLabel || null,
        bot_score: botScore || null,
        last_known_trade_count: 0,
      });

      if (error) {
        if (error.code === "23505") {
          addToast("You're already tracking this wallet", "error");
        } else {
          throw error;
        }
      } else {
        localStorage.setItem(LS_KEY, email.trim().toLowerCase());
        addToast(`Tracking activated! Alerts will be sent to ${email}`, "success");
        await fetchTrackedWallets(email.trim().toLowerCase());

        // Send confirmation email via Edge Function (fire and forget)
        sendConfirmationEmail({
          email: email.trim().toLowerCase(),
          wallet_address: walletAddress,
          wallet_label: walletLabel,
          bot_score: botScore,
        });
      }
    } catch (err) {
      console.error("Failed to start tracking:", err);
      addToast("Failed to start tracking. Please try again.", "error");
    }
    setSubmitting(false);
  }

  async function handleUntrack(walletId) {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from("tracked_wallets")
        .delete()
        .eq("id", walletId);

      if (error) throw error;
      setTrackedWallets((prev) => prev.filter((w) => w.id !== walletId));
      addToast("Wallet tracking removed", "success");
    } catch (err) {
      console.error("Failed to untrack:", err);
      addToast("Failed to remove tracking", "error");
    }
  }

  const truncateAddr = (addr) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>{"\uD83D\uDD14"}</span>
          Track This Wallet
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Get notified when this trader makes a move.
        </p>
      </div>

      {/* Email input + submit */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleStartTracking()}
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
        />
        <button
          className="btn-primary"
          onClick={handleStartTracking}
          disabled={submitting || !email.trim()}
          style={{ padding: "10px 20px", whiteSpace: "nowrap", fontSize: 13 }}
        >
          {submitting ? "Saving..." : "Start Tracking"}
        </button>
      </div>

      {/* Tracked wallets list */}
      {trackedWallets.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            Currently tracking: {trackedWallets.length}/{MAX_TRACKED} wallets
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {trackedWallets.map((w) => (
              <div
                key={w.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {truncateAddr(w.wallet_address)}
                  </span>
                  {w.wallet_label && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      {w.wallet_label}
                    </span>
                  )}
                  {w.bot_score != null && (
                    <span
                      className="badge"
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        background:
                          w.bot_score >= 70
                            ? "rgba(139,92,246,0.15)"
                            : w.bot_score >= 40
                              ? "rgba(255,170,0,0.15)"
                              : "rgba(0,212,170,0.15)",
                        color:
                          w.bot_score >= 70
                            ? "#8b5cf6"
                            : w.bot_score >= 40
                              ? "#ffaa00"
                              : "var(--accent)",
                      }}
                    >
                      Bot: {w.bot_score}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleUntrack(w.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "2px 6px",
                    borderRadius: 4,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = "var(--negative)")}
                  onMouseLeave={(e) => (e.target.style.color = "var(--text-muted)")}
                  title="Stop tracking"
                >
                  {"\u2715"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loadingList && trackedWallets.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
          Loading tracked wallets...
        </p>
      )}
    </div>
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendConfirmationEmail({ email, wallet_address, wallet_label, bot_score }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return;

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-tracking-confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ email, wallet_address, wallet_label, bot_score }),
    });
  } catch (err) {
    console.warn("Confirmation email failed (non-blocking):", err.message);
  }
}
