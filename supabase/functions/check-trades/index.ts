// Supabase Edge Function — check-trades
// Runs every 5 minutes via pg_cron to detect new trades and send email alerts via Resend
//
// Deploy: supabase functions deploy check-trades
// Schedule (run in SQL editor):
//   SELECT cron.schedule('check-trades', '*/5 * * * *',
//     $$SELECT net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/check-trades',
//       headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
//       body := '{}'::jsonb
//     )$$
//   );

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "PolyAlpha <noreply@stembl.com>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  try {
    // 1. Fetch all active tracked wallets
    const { data: tracked, error: fetchError } = await supabase
      .from("tracked_wallets")
      .select("*")
      .eq("is_active", true);

    if (fetchError) throw fetchError;
    if (!tracked || tracked.length === 0) {
      return new Response(JSON.stringify({ message: "No active wallets to check" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let alertsSent = 0;

    for (const wallet of tracked) {
      try {
        // 2. Fetch current trades from Polymarket Data API
        const tradesUrl = `https://data-api.polymarket.com/trades?user=${wallet.wallet_address}&limit=500`;
        const tradesRes = await fetch(tradesUrl);

        if (!tradesRes.ok) continue;

        const trades = await tradesRes.json();
        const currentCount = Array.isArray(trades) ? trades.length : 0;

        // 3. Check for new trades
        if (currentCount > (wallet.last_known_trade_count || 0)) {
          const newTradeCount = currentCount - (wallet.last_known_trade_count || 0);
          const newTrades = Array.isArray(trades) ? trades.slice(0, newTradeCount) : [];

          // 4. Send email via Resend
          if (RESEND_API_KEY && newTrades.length > 0) {
            const emailHtml = buildAlertEmail(wallet, newTrades);

            const resendRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: RESEND_FROM,
                to: wallet.email,
                subject: `PolyAlpha Alert: ${newTradeCount} new trade${newTradeCount > 1 ? "s" : ""} detected for ${wallet.wallet_address.slice(0, 8)}...`,
                html: emailHtml,
              }),
            });

            if (!resendRes.ok) {
              console.error(`Resend error for ${wallet.email}:`, await resendRes.text());
            }
          }

          // 5. Update last known trade count
          await supabase
            .from("tracked_wallets")
            .update({
              last_known_trade_count: currentCount,
              last_checked_at: new Date().toISOString(),
            })
            .eq("id", wallet.id);

          // 6. Log to alert_history
          await supabase.from("alert_history").insert({
            tracked_wallet_id: wallet.id,
            trade_data: newTrades.slice(0, 10), // store max 10 trades per alert
          });

          alertsSent++;
        } else {
          // No new trades, just update last_checked_at
          await supabase
            .from("tracked_wallets")
            .update({ last_checked_at: new Date().toISOString() })
            .eq("id", wallet.id);
        }
      } catch (walletErr) {
        console.error(`Error checking wallet ${wallet.wallet_address}:`, walletErr);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Checked ${tracked.length} wallets, sent ${alertsSent} alerts`,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-trades error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function buildAlertEmail(
  wallet: { wallet_address: string; wallet_label?: string; bot_score?: number; email?: string },
  newTrades: Array<{
    title?: string;
    side?: string;
    price?: string;
    size?: string;
    timestamp?: number | string;
  }>
): string {
  const addr = wallet.wallet_address;
  const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const label = wallet.wallet_label || shortAddr;

  // Bot score badge
  let botBadge = "";
  if (wallet.bot_score != null) {
    const bs = wallet.bot_score;
    const classText = bs >= 65 ? "Likely Bot" : bs <= 30 ? "Likely Human" : "Uncertain";
    const classColor = bs >= 65 ? "#8b5cf6" : bs <= 30 ? "#00d4aa" : "#ffaa00";
    botBadge = `
      <div style="display:inline-block;padding:6px 14px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid #1e2028;margin-top:8px;">
        <span style="font-size:16px;font-weight:700;color:${classColor};">${bs}</span>
        <span style="font-size:11px;color:#888;margin-left:6px;">${classText}</span>
      </div>`;
  }

  // Trade rows
  const tradeRows = newTrades
    .slice(0, 5)
    .map((t) => {
      const side = (t.side || "").toUpperCase();
      const sideColor = side === "BUY" ? "#00d4aa" : "#ff4466";
      const sideBg = side === "BUY" ? "rgba(0,212,170,0.08)" : "rgba(255,68,102,0.08)";
      const price = t.price ? `${(parseFloat(t.price) * 100).toFixed(1)}¢` : "—";
      const size = t.size ? `$${Number(t.size).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—";
      const time = t.timestamp
        ? new Date(
            typeof t.timestamp === "number" && t.timestamp < 1e12
              ? t.timestamp * 1000
              : t.timestamp
          ).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : "";

      return `
        <div style="padding:14px 16px;border-bottom:1px solid #1a1d24;">
          <div style="font-size:13px;color:#e0e0e0;font-weight:500;margin-bottom:8px;line-height:1.4;">${t.title || "Unknown Market"}</div>
          <div style="display:flex;gap:16px;align-items:center;">
            <span style="display:inline-block;padding:3px 10px;border-radius:6px;background:${sideBg};color:${sideColor};font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">${side}</span>
            <span style="font-size:12px;color:#ccc;font-family:'SF Mono',Monaco,Consolas,monospace;">at ${price}</span>
            <span style="font-size:12px;color:#ccc;font-family:'SF Mono',Monaco,Consolas,monospace;">${size}</span>
            <span style="font-size:11px;color:#666;margin-left:auto;">${time}</span>
          </div>
        </div>`;
    })
    .join("");

  const moreText =
    newTrades.length > 5
      ? `<div style="padding:12px 16px;color:#666;font-size:12px;text-align:center;">+ ${newTrades.length - 5} more trade${newTrades.length - 5 > 1 ? "s" : ""}</div>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0b0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:24px;font-weight:700;color:#00d4aa;letter-spacing:-0.02em;">
        ◈ PolyAlpha
      </div>
      <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.12em;margin-top:6px;">
        Prediction Market Intelligence
      </div>
    </div>

    <!-- Alert Banner -->
    <div style="background:rgba(0,212,170,0.06);border:1px solid rgba(0,212,170,0.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <span style="font-size:18px;">⚡</span>
      <span style="font-size:15px;font-weight:600;color:#00d4aa;margin-left:8px;">
        ${newTrades.length} New Trade${newTrades.length > 1 ? "s" : ""} Detected
      </span>
    </div>

    <!-- Wallet Info Card -->
    <div style="background:#111318;border:1px solid #1e2028;border-radius:16px;padding:20px;margin-bottom:4px;">
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Tracked Wallet</div>
      <div style="font-size:15px;font-weight:600;color:#e0e0e0;">${label}</div>
      <div style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:12px;color:#00d4aa;margin-top:4px;">${shortAddr}</div>
      ${botBadge}
    </div>

    <!-- Trades Card -->
    <div style="background:#111318;border:1px solid #1e2028;border-radius:16px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:16px;border-bottom:1px solid #1e2028;">
        <span style="font-size:13px;font-weight:600;color:#e0e0e0;">Trade Details</span>
      </div>
      ${tradeRows}
      ${moreText}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://polyalpha.app/#/wallet-stalker?address=${addr}"
         style="display:inline-block;background:#00d4aa;color:#0a0b0d;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">
        View Full Analysis →
      </a>
    </div>

    <!-- Footer -->
    <hr style="border:none;border-top:1px solid #1e2028;margin:0 0 20px;">
    <p style="color:#444;font-size:11px;text-align:center;line-height:1.7;margin:0;">
      You're receiving this because you tracked this wallet on PolyAlpha.<br/>
      To stop alerts, remove this wallet from your tracking list.
    </p>
  </div>
</body>
</html>`;
}
