// Supabase Edge Function — send-tracking-confirmation
// Called by the frontend when a user starts tracking a wallet.
// Sends a styled confirmation email via Resend.
//
// Deploy: supabase functions deploy send-tracking-confirmation

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Dexio <noreply@stembl.com>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, wallet_address, wallet_label, bot_score } = await req.json();

    if (!email || !wallet_address) {
      return new Response(
        JSON.stringify({ error: "email and wallet_address are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shortAddr = `${wallet_address.slice(0, 6)}...${wallet_address.slice(-4)}`;
    const label = wallet_label || shortAddr;

    // Build classification text
    let classText = "";
    let classColor = "#00d4aa";
    if (bot_score != null) {
      if (bot_score >= 65) {
        classText = "Likely Bot";
        classColor = "#8b5cf6";
      } else if (bot_score <= 30) {
        classText = "Likely Human";
        classColor = "#00d4aa";
      } else {
        classText = "Uncertain";
        classColor = "#ffaa00";
      }
    }

    const emailHtml = buildConfirmationEmail({
      email,
      shortAddr,
      fullAddr: wallet_address,
      label,
      botScore: bot_score,
      classText,
      classColor,
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: email,
        subject: `Tracking activated for ${label}`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to send confirmation email", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendData = await resendRes.json();

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-tracking-confirmation error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildConfirmationEmail({
  email,
  shortAddr,
  fullAddr,
  label,
  botScore,
  classText,
  classColor,
}: {
  email: string;
  shortAddr: string;
  fullAddr: string;
  label: string;
  botScore: number | null;
  classText: string;
  classColor: string;
}): string {
  const botScoreSection = botScore != null
    ? `
      <div style="display:flex;align-items:center;gap:12px;margin-top:16px;padding:14px 18px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid #1e2028;">
        <div style="text-align:center;">
          <div style="font-size:28px;font-weight:700;color:${classColor};line-height:1;">${botScore}</div>
          <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Bot Score</div>
        </div>
        <div style="width:1px;height:36px;background:#2a2d35;"></div>
        <div>
          <div style="font-size:14px;font-weight:600;color:${classColor};">${classText}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">Based on our 6-factor analysis</div>
        </div>
      </div>`
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
        ◈ Dexio
      </div>
      <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.12em;margin-top:6px;">
        Prediction Market Intelligence
      </div>
    </div>

    <!-- Main Card -->
    <div style="background:#111318;border:1px solid #1e2028;border-radius:16px;padding:32px;margin-bottom:24px;">

      <!-- Success Icon -->
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:rgba(0,212,170,0.1);border:2px solid rgba(0,212,170,0.3);line-height:56px;font-size:24px;">
          ✓
        </div>
      </div>

      <h1 style="color:#ffffff;font-size:22px;font-weight:700;text-align:center;margin:0 0 8px;letter-spacing:-0.01em;">
        Tracking Activated
      </h1>
      <p style="color:#888;font-size:14px;text-align:center;margin:0 0 24px;line-height:1.5;">
        You'll receive email alerts when this wallet makes new trades on Polymarket.
      </p>

      <!-- Wallet Info -->
      <div style="background:rgba(0,212,170,0.04);border:1px solid rgba(0,212,170,0.15);border-radius:12px;padding:20px;">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">
          Tracked Wallet
        </div>
        <div style="font-size:16px;font-weight:600;color:#e0e0e0;margin-bottom:4px;">
          ${label !== shortAddr ? label : ""}
        </div>
        <div style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:13px;color:#00d4aa;word-break:break-all;">
          ${fullAddr}
        </div>
        ${botScoreSection}
      </div>
    </div>

    <!-- What to expect -->
    <div style="background:#111318;border:1px solid #1e2028;border-radius:16px;padding:24px;margin-bottom:24px;">
      <h3 style="color:#e0e0e0;font-size:14px;font-weight:600;margin:0 0 16px;">What to expect</h3>

      <div style="display:flex;gap:12px;margin-bottom:14px;">
        <div style="font-size:16px;line-height:1;">⚡</div>
        <div>
          <div style="font-size:13px;color:#e0e0e0;font-weight:500;">Real-time trade detection</div>
          <div style="font-size:12px;color:#888;margin-top:2px;">We check for new trades every 5 minutes</div>
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:14px;">
        <div style="font-size:16px;line-height:1;">📊</div>
        <div>
          <div style="font-size:13px;color:#e0e0e0;font-weight:500;">Detailed trade breakdowns</div>
          <div style="font-size:12px;color:#888;margin-top:2px;">Market, side, price, size — everything you need</div>
        </div>
      </div>

      <div style="display:flex;gap:12px;">
        <div style="font-size:16px;line-height:1;">🔗</div>
        <div>
          <div style="font-size:13px;color:#e0e0e0;font-weight:500;">One-click deep analysis</div>
          <div style="font-size:12px;color:#888;margin-top:2px;">Jump straight to full wallet analysis on Dexio</div>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://dexio.app/#/wallet-stalker?address=${fullAddr}"
         style="display:inline-block;background:#00d4aa;color:#0a0b0d;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">
        View Wallet Analysis →
      </a>
    </div>

    <!-- Footer -->
    <hr style="border:none;border-top:1px solid #1e2028;margin:0 0 20px;">
    <p style="color:#444;font-size:11px;text-align:center;line-height:1.7;margin:0;">
      You're receiving this because <span style="color:#666;">${email}</span> subscribed to wallet alerts on Dexio.<br/>
      To stop receiving alerts, remove this wallet from your tracking list.
    </p>
  </div>
</body>
</html>`;
}
