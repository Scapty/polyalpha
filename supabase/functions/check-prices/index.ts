// Supabase Edge Function — check-prices
// Runs every 5 minutes via pg_cron to check price alerts and send email notifications via Resend
//
// Deploy: supabase functions deploy check-prices
// Schedule (run in SQL editor):
//   SELECT cron.schedule('check-prices', '*/5 * * * *',
//     $$SELECT net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/check-prices',
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

Deno.serve(async (_req: Request) => {
  try {
    // 1. Fetch all active price alerts
    const { data: alerts, error: fetchError } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("is_active", true);

    if (fetchError) throw fetchError;
    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({ message: "No active alerts" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Get unique market slugs to fetch prices
    const slugs = [...new Set(alerts.map((a) => a.market_slug).filter(Boolean))];

    // Fetch current prices from Polymarket Gamma API
    const priceMap: Record<string, number> = {};

    for (const slug of slugs) {
      try {
        const res = await fetch(
          `https://gamma-api.polymarket.com/markets?slug=${slug}&limit=1`
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const market = data[0];
          const prices = JSON.parse(market.outcomePrices || "[]");
          if (prices.length >= 1) {
            priceMap[slug] = parseFloat(prices[0]);
          }
        }
      } catch {
        // Skip this market if we can't fetch the price
      }
    }

    // 3. Check each alert against current price
    let alertsSent = 0;

    for (const alert of alerts) {
      const currentPrice = alert.market_slug ? priceMap[alert.market_slug] : null;
      if (currentPrice == null) continue;

      // Update current_price in the database
      await supabase
        .from("price_alerts")
        .update({ current_price: currentPrice })
        .eq("id", alert.id);

      // Check if threshold is crossed
      const triggered =
        (alert.direction === "below" && currentPrice <= alert.target_price) ||
        (alert.direction === "above" && currentPrice >= alert.target_price);

      if (!triggered) continue;

      // 4. Send email notification
      const currentCents = (currentPrice * 100).toFixed(1);
      const targetCents = (alert.target_price * 100).toFixed(1);
      const polyUrl = alert.market_slug
        ? `https://polymarket.com/event/${alert.market_slug}`
        : "https://polymarket.com";

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #0a0b0d; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px; border-bottom: 1px solid #1a1d24;">
            <div style="font-size: 18px; font-weight: 700; color: #ffffff;">
              <span style="color: #00d4aa;">◈</span> PolyAlpha Price Alert
            </div>
          </div>
          <div style="padding: 24px;">
            <div style="font-size: 15px; font-weight: 600; color: #ffffff; margin-bottom: 16px;">
              ${alert.market_title}
            </div>
            <div style="background: #111318; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #888;">Current Price</span>
                <span style="color: #00d4aa; font-weight: 600; font-family: monospace;">${currentCents}¢</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #888;">Your Target</span>
                <span style="color: #ffffff; font-weight: 600; font-family: monospace;">${alert.direction} ${targetCents}¢</span>
              </div>
            </div>
            <a href="${polyUrl}" style="display: block; text-align: center; padding: 12px; background: #00d4aa; color: #0a0b0d; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              View on Polymarket
            </a>
          </div>
          <div style="padding: 16px 24px; font-size: 11px; color: #555; border-top: 1px solid #1a1d24;">
            This is a one-time alert. You can set new alerts at polyalpha.app
          </div>
        </div>
      `;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: alert.email,
            subject: `Price Alert: ${alert.market_title} is now ${currentCents}¢`,
            html: emailHtml,
          }),
        });

        // 5. Deactivate the alert (one-time)
        await supabase
          .from("price_alerts")
          .update({ is_active: false, triggered_at: new Date().toISOString() })
          .eq("id", alert.id);

        alertsSent++;
      } catch (emailErr) {
        console.error(`Failed to send alert email for ${alert.id}:`, emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Checked ${alerts.length} alerts, sent ${alertsSent} notifications`,
        checked: alerts.length,
        sent: alertsSent,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-prices error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
