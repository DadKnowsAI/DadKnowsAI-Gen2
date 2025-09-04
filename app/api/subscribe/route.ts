import { NextRequest } from "next/server";

export const runtime = "nodejs";

const RAW_KEY = process.env.BEEHIIV_API_KEY || "";
const RAW_PUB = process.env.BEEHIIV_PUBLICATION_ID || "";

const BEEHIIV_API_KEY = RAW_KEY.trim();
const PUB_ID = RAW_PUB.trim();

type Payload = {
  email?: string;
  source?: string;   // e.g., "beta-landing"
  honeypot?: string; // optional bot trap
};

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req: NextRequest) {
  try {
    let body: Payload = {};
    try {
      body = (await req.json()) as Payload;
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    // Honeypot → silently succeed
    if (body.honeypot) return withUnlockCookie(json({ ok: true }));

    const raw = (body.email || "").trim().toLowerCase();
    const source = (body.source || "chat_soft_wall").trim();

    if (!raw || !isValidEmail(raw)) {
      return json({ ok: false, error: "invalid_email" }, 400);
    }
    if (!BEEHIIV_API_KEY || !PUB_ID) {
      return json({ ok: false, error: "beehiiv_not_configured" }, 500);
    }

    // --- Build payloads ---
    // 1) Try with a custom field for easier segmenting
    const url = `https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions`;
    const withCustom = JSON.stringify({
      email: raw,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: source,                // what you had
      custom_fields: { signup_source: source }, // NEW: for dynamic segments
    });

    const baseHeaders = {
      "Content-Type": "application/json",
    } as const;

    // Helper to POST with either Bearer or X-Authorization (your original behavior)
    const postBeehiiv = async (payload: string) => {
      let r = await fetch(url, {
        method: "POST",
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${BEEHIIV_API_KEY}`,
        },
        body: payload,
      });
      if (r.status === 401) {
        r = await fetch(url, {
          method: "POST",
          headers: {
            ...baseHeaders,
            "X-Authorization": BEEHIIV_API_KEY,
          },
          body: payload,
        });
      }
      return r;
    };

    // --- Send (attempt with custom field first) ---
    console.log("DEBUG subscribe →", { email: raw, source, try: "withCustom" });
    let upstream = await postBeehiiv(withCustom);

    // If Beehiiv rejects custom_fields (400/422), retry *without* it
    if (!upstream.ok && ![409, 422].includes(upstream.status)) {
      // Prepare fallback payload (no custom_fields)
      const withoutCustom = JSON.stringify({
        email: raw,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: source,
      });

      console.warn("Beehiiv error (withCustom)", upstream.status, await safeText(upstream));
      console.log("DEBUG subscribe →", { email: raw, source, try: "withoutCustom" });
      upstream = await postBeehiiv(withoutCustom);
    }

    // If still not ok and not already-subscribed codes, bubble minimal error (but keep UX smooth)
    if (!upstream.ok && ![409, 422].includes(upstream.status)) {
      const detail = (await safeText(upstream)).slice(0, 500);
      console.error("Beehiiv error (final)", upstream.status, detail);
      // During beta we still unlock, but return ok:true so the UI proceeds
      return withUnlockCookie(json({ ok: true, warn: "beehiiv_error" }));
    }

    // Success / already subscribed → set unlock cookie
    return withUnlockCookie(json({ ok: true }));
  } catch (e) {
    console.error("Subscribe error", e);
    // Keep beta UX smooth
    return withUnlockCookie(json({ ok: true, warn: "subscribe_error" }));
  }
}

// --- helpers ---
function json(obj: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function withUnlockCookie(res: Response) {
  const headers = new Headers(res.headers);
  headers.set(
    "Set-Cookie",
    "dkai_captured=1; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax"
  );
  return new Response(res.body, { status: res.status, headers });
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}
