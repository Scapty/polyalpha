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
    if (trackedWallets.length >= MAX_TRACKED) {
      addToast(`Maximum ${MAX_TRACKED} wallets per email`, "error");
      return;
    }
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
        addToast(`Tracking activated for ${email}`, "success");
        await fetchTrackedWallets(email.trim().toLowerCase());

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
    <div
      style={{
        background: "var(--bg-deep)",
        border: "1px solid var(--border)",
        borderRadius: 0,
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
          Track This Wallet
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Get notified when this trader makes a move.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleStartTracking()}
          style={{
            flex: 1,
            height: 44,
            padding: "0 14px",
            background: "var(--bg-deep)",
            border: "1px solid var(--border)",
            borderRadius: 0,
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            outline: "none",
            transition: "border-color 150ms ease",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />
        <button
          className="btn-primary"
          onClick={handleStartTracking}
          disabled={submitting || !email.trim()}
          style={{ height: 44, padding: "0 20px", whiteSpace: "nowrap", fontSize: 13 }}
        >
          {submitting ? "Saving..." : "Start Tracking"}
        </button>
      </div>

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
            Tracking: {trackedWallets.length}/{MAX_TRACKED}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {trackedWallets.map((w) => (
              <div
                key={w.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--bg-elevated)",
                  borderRadius: 0,
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
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
                    {truncateAddr(w.wallet_address)}
                  </span>
                  {w.wallet_label && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
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
                            ? "rgba(139,92,246,0.12)"
                            : w.bot_score >= 40
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(16,185,129,0.12)",
                        color:
                          w.bot_score >= 70
                            ? "var(--purple)"
                            : w.bot_score >= 40
                              ? "var(--warning)"
                              : "var(--green)",
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
                    color: "var(--text-ghost)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "2px 6px",
                    borderRadius: 0,
                    transition: "color 150ms ease",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = "var(--red)")}
                  onMouseLeave={(e) => (e.target.style.color = "var(--text-ghost)")}
                  title="Stop tracking"
                >
                  {"\u2715"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingList && trackedWallets.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
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
