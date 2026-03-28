import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabase";

const EMAIL_KEY = "polyalpha_email";

export default function PriceAlertForm({ market, onClose }) {
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || "");
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState("below");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Pre-fill target price slightly below current price
    if (market?.polyYesPrice) {
      const suggested = Math.max(0.01, market.polyYesPrice - 0.05);
      setTargetPrice((suggested * 100).toFixed(0));
    }
  }, [market]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !targetPrice) return;

    const priceDecimal = parseFloat(targetPrice) / 100;
    if (isNaN(priceDecimal) || priceDecimal <= 0 || priceDecimal >= 1) {
      setError("Price must be between 1 and 99 cents");
      return;
    }

    if (!supabase) {
      setError("Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      localStorage.setItem(EMAIL_KEY, email);

      const { error: insertError } = await supabase.from("price_alerts").insert({
        email,
        market_title: market.kalshiTitle || market.polyTitle || market.title || "Unknown",
        market_slug: market.polySlug || "",
        platform: "polymarket",
        market_id: market.id || "",
        target_price: priceDecimal,
        direction,
        current_price: market.polyYesPrice || null,
      });

      if (insertError) throw insertError;
      setSuccess(true);
      setTimeout(() => onClose?.(), 2000);
    } catch (err) {
      setError(err.message || "Failed to create alert");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ padding: 16, background: "rgba(0,212,170,0.08)", borderRadius: 8, border: "1px solid rgba(0,212,170,0.2)", textAlign: "center" }}>
        <div style={{ color: "var(--accent)", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Alert created</div>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          We&apos;ll email {email} when the price goes {direction} {targetPrice}c
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
        Price Alert — {market?.kalshiTitle || market?.polyTitle || "Market"}
      </div>

      {/* Email */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          style={{
            width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-body)",
            background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
            borderRadius: 6, color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Direction + Price */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Alert when price goes</label>
          <div style={{ display: "flex", gap: 4 }}>
            {["below", "above"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                style={{
                  flex: 1, padding: "6px 0", fontSize: 12, fontFamily: "var(--font-mono)",
                  background: direction === d ? "rgba(0,212,170,0.12)" : "rgba(255,255,255,0.04)",
                  color: direction === d ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${direction === d ? "rgba(0,212,170,0.3)" : "var(--border-subtle)"}`,
                  borderRadius: 6, cursor: "pointer", textTransform: "capitalize",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: 100 }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Target (cents)</label>
          <input
            type="number"
            required
            min="1"
            max="99"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="25"
            style={{
              width: "100%", padding: "6px 10px", fontSize: 13, fontFamily: "var(--font-mono)",
              background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
              borderRadius: 6, color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Current price info */}
      {market?.polyYesPrice != null && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 10 }}>
          Current price: {(market.polyYesPrice * 100).toFixed(1)}c on Polymarket
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: "var(--negative)", marginBottom: 8 }}>{error}</div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600,
            background: "rgba(0,212,170,0.15)", color: "var(--accent)",
            border: "1px solid rgba(0,212,170,0.3)", borderRadius: 6,
            cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.5 : 1,
          }}
        >
          {submitting ? "Creating..." : "Create Alert"}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "8px 14px", fontSize: 13,
            background: "rgba(255,255,255,0.04)", color: "var(--text-muted)",
            border: "1px solid var(--border-subtle)", borderRadius: 6, cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
