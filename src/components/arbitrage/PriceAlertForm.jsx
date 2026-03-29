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
      setError("Supabase not configured.");
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
      <div style={{
        padding: 20,
        background: "rgba(16,185,129,0.08)",
        borderRadius: 0,
        border: "1px solid rgba(16,185,129,0.2)",
        textAlign: "center",
      }}>
        <p style={{
          color: "var(--green)",
          fontWeight: 600,
          fontSize: 14,
          fontFamily: "var(--font-display)",
          marginBottom: 4,
        }}>
          Alert created
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-body)" }}>
          We'll email {email} when the price goes {direction} {targetPrice}c
        </p>
      </div>
    );
  }

  const inputBase = {
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    background: "var(--bg-deep)",
    border: "1px solid var(--border)",
    borderRadius: 0,
    color: "var(--text-primary)",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 150ms ease",
  };

  return (
    <form onSubmit={handleSubmit} style={{
      padding: 20,
      background: "var(--bg-elevated)",
      borderRadius: 0,
      border: "1px solid var(--border)",
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "var(--font-display)",
        color: "var(--text-primary)",
        marginBottom: 12,
      }}>
        Price Alert: {market?.kalshiTitle || market?.polyTitle || "Market"}
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          display: "block",
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          style={{ ...inputBase, width: "100%" }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
            display: "block",
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            Alert when price goes
          </label>
          <div style={{ display: "flex", gap: 4 }}>
            {["below", "above"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  background: direction === d ? "var(--accent)" : "var(--bg-deep)",
                  color: direction === d ? "#fff" : "var(--text-muted)",
                  border: "1px solid transparent",
                  borderRadius: 0,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  transition: "all 150ms ease",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: 100 }}>
          <label style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
            display: "block",
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            Target (cents)
          </label>
          <input
            type="number"
            required
            min="1"
            max="99"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="25"
            style={{ ...inputBase, width: "100%" }}
          />
        </div>
      </div>

      {market?.polyYesPrice != null && (
        <p style={{
          fontSize: 11,
          color: "var(--text-ghost)",
          fontFamily: "var(--font-mono)",
          marginBottom: 10,
        }}>
          Current price: {(market.polyYesPrice * 100).toFixed(1)}c on Polymarket
        </p>
      )}

      {error && (
        <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary"
          style={{ flex: 1, height: 36, fontSize: 13, opacity: submitting ? 0.5 : 1 }}
        >
          {submitting ? "Creating..." : "Create Alert"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost"
          style={{ height: 36, padding: "0 14px", fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
