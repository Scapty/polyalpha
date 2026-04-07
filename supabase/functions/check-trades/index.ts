// Supabase Edge Function — check-trades
// Runs every 5 minutes via pg_cron to detect new trades and send email alerts via Resend
//
// Deploy: supabase functions deploy check-trades
// Schedule (run in SQL editor after deploying):
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
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Dexio <noreply@stembl.com>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (_req: Request) => {
  try {
    // 1. Fetch all active tracked wallets
    const { data: tracked, error: fetchError } = await supabase
      .from("tracked_wallets")
      .select("*")
      .eq("is_active", true);

    if (fetchError) throw fetchError;
    if (!tracked || tracked.length === 0) {
      return json({ message: "No active wallets to check" });
    }

    let alertsSent = 0;

    for (const wallet of tracked) {
      try {
        // 2. Fetch recent trades from Polymarket Data API
        const tradesUrl = `https://data-api.polymarket.com/trades?user=${wallet.wallet_address}&limit=500`;
        const tradesRes = await fetch(tradesUrl);
        if (!tradesRes.ok) continue;

        const trades = await tradesRes.json();
        if (!Array.isArray(trades)) continue;

        const currentCount = trades.length;
        const lastKnownCount = wallet.last_known_trade_count || 0;

        // 3. Detect genuinely new trades
        // Use both count comparison AND timestamp to avoid false positives
        const lastChecked = wallet.last_checked_at
          ? new Date(wallet.last_checked_at).getTime()
          : 0;

        // Filter to trades that happened AFTER the last check
        const newTrades = trades.filter((t: any) => {
          const tradeTs = typeof t.timestamp === "number"
            ? (t.timestamp < 1e12 ? t.timestamp * 1000 : t.timestamp)
            : new Date(t.timestamp).getTime();
          return tradeTs > lastChecked;
        });

        if (newTrades.length > 0 && RESEND_API_KEY) {
          // 4. Send email alert
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
              subject: `Dexio Alert: ${newTrades.length} new trade${newTrades.length > 1 ? "s" : ""} — ${wallet.wallet_label || wallet.wallet_address.slice(0, 8) + "..."}`,
              html: emailHtml,
            }),
          });

          if (!resendRes.ok) {
            console.error(`Resend error for ${wallet.email}:`, await resendRes.text());
          }

          // 5. Log to alert_history
          await supabase.from("alert_history").insert({
            tracked_wallet_id: wallet.id,
            email: wallet.email,
            wallet_address: wallet.wallet_address,
            new_trade_count: newTrades.length,
          });

          alertsSent++;
        }

        // 6. Always update last_checked_at and trade count
        await supabase
          .from("tracked_wallets")
          .update({
            last_known_trade_count: currentCount,
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", wallet.id);

      } catch (walletErr) {
        console.error(`Error checking wallet ${wallet.wallet_address}:`, walletErr);
      }
    }

    return json({
      message: `Checked ${tracked.length} wallets, sent ${alertsSent} alerts`,
    });
  } catch (err) {
    console.error("check-trades error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Email builder ───────────────────────────────────────────────────────────

interface Trade {
  title?: string;
  slug?: string;
  eventSlug?: string;
  side?: string;
  price?: string | number;
  size?: string | number;
  timestamp?: number | string;
  outcome?: string;
}

interface Wallet {
  wallet_address: string;
  wallet_label?: string;
  bot_score?: number;
  email?: string;
}

function buildAlertEmail(wallet: Wallet, newTrades: Trade[]): string {
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

  // Trade rows with copy trade links
  const tradeRows = newTrades
    .slice(0, 8)
    .map((t) => {
      const side = (t.side || "").toUpperCase();
      const sideColor = side === "BUY" ? "#00d4aa" : "#ff4466";
      const sideBg = side === "BUY" ? "rgba(0,212,170,0.08)" : "rgba(255,68,102,0.08)";
      const price = t.price ? `${(parseFloat(String(t.price)) * 100).toFixed(1)}\u00A2` : "\u2014";
      const size = t.size ? `$${Number(t.size).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "\u2014";
      const outcome = t.outcome || "";
      const time = t.timestamp
        ? new Date(
            typeof t.timestamp === "number" && t.timestamp < 1e12
              ? t.timestamp * 1000
              : t.timestamp
          ).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : "";

      // Build Polymarket direct link for copy trading
      const slug = t.eventSlug || t.slug || "";
      const polymarketUrl = slug
        ? `https://polymarket.com/event/${slug}`
        : "";

      return `
        <div style="padding:14px 16px;border-bottom:1px solid #1a1d24;">
          <div style="font-size:13px;color:#e0e0e0;font-weight:500;margin-bottom:8px;line-height:1.4;">
            ${t.title || "Unknown Market"}
            ${outcome ? `<span style="color:#888;font-weight:400;"> \u2014 ${outcome}</span>` : ""}
          </div>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <span style="display:inline-block;padding:3px 10px;border-radius:6px;background:${sideBg};color:${sideColor};font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">${side}</span>
            <span style="font-size:12px;color:#ccc;font-family:'SF Mono',Monaco,Consolas,monospace;">at ${price}</span>
            <span style="font-size:12px;color:#ccc;font-family:'SF Mono',Monaco,Consolas,monospace;">${size}</span>
            <span style="font-size:11px;color:#666;">${time}</span>
            ${polymarketUrl ? `
              <a href="${polymarketUrl}"
                 style="display:inline-block;padding:4px 12px;border-radius:6px;background:rgba(0,212,170,0.1);border:1px solid rgba(0,212,170,0.25);color:#00d4aa;font-size:11px;font-weight:600;text-decoration:none;letter-spacing:0.02em;margin-left:auto;">
                Copy Trade \u2192
              </a>
            ` : ""}
          </div>
        </div>`;
    })
    .join("");

  const moreText =
    newTrades.length > 8
      ? `<div style="padding:12px 16px;color:#666;font-size:12px;text-align:center;">+ ${newTrades.length - 8} more trade${newTrades.length - 8 > 1 ? "s" : ""}</div>`
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
        \u25C8 Dexio
      </div>
      <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.12em;margin-top:6px;">
        Prediction Market Intelligence
      </div>
    </div>

    <!-- Alert Banner -->
    <div style="background:rgba(0,212,170,0.06);border:1px solid rgba(0,212,170,0.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <span style="font-size:18px;">\u26A1</span>
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
        <span style="font-size:11px;color:#666;margin-left:8px;">Click "Copy Trade" to open the market on Polymarket</span>
      </div>
      ${tradeRows}
      ${moreText}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://dexio.trade/#/wallet-stalker?address=${addr}"
         style="display:inline-block;background:#00d4aa;color:#0a0b0d;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">
        View Full Analysis \u2192
      </a>
    </div>

    <!-- Footer -->
    <hr style="border:none;border-top:1px solid #1e2028;margin:0 0 20px;">
    <p style="color:#444;font-size:11px;text-align:center;line-height:1.7;margin:0;">
      You're receiving this because you tracked this wallet on Dexio.<br/>
      To stop alerts, remove this wallet from your tracking list.
    </p>
  </div>
</body>
</html>`;
}
