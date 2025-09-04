// app/api/subscribe/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs"; // keep Node for fetch/crypto parity

const RAW_KEY = process.env.BEEHIIV_API_KEY || "";
const RAW_PUB = process.env.BEEHIIV_PUBLICATION_ID || "";

// Trim to avoid hidden spaces/newlines from pasting into env vars
const BEEHIIV_API_KEY = RAW_KEY.trim();
const PUB_ID = RAW_PUB.trim();

type Payload = {
  email?: string;
  source?: string;   // optional UTM/source tag (e.g., "beta-landing")
  honeypot?: string; // optional bot trap: if present, silently succeed
};

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req: NextRequest) {
  try {
    let body: Payload = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    // Bot trap: if honeypot is filled, pretend success (no-op)
    if (body.honeypot) {
      return withUnlockCookie(json({ ok: true }));
    }

    const raw = (body.email || "").trim().toLowerCase();
    if (!raw || !isValidEmail(raw)) {
      return json({ ok: false, error: "invalid_email" }, 400);
    }

    if (!BEEHIIV_API_KEY || !PUB_ID) {
      return json({ ok: false, error: "beehiiv_not_configured" }, 500);
    }

    const url = `https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions`;
    const payload = JSON.stringify({
      email: raw,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: body.source || "chat_soft_wall",
    });

    // Try Authorization: Bearer first
    let res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BEEHIIV_API_KEY}`,
      },
      body: payload,
    });

    // Fallback to X-Authorization if needed
    if (res.status === 401) {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": BEEHIIV_API_KEY,
        },
        body: payload,
      });
    }

    // Treat already-subscribed/reactivate codes as success for UX
    if (!res.ok && ![409, 422].includes(res.status)) {
      const text = await safeText(res);
      return json(
        { ok: false, error: "beehiiv_error", status: res.status, detail: text?.slice(0, 500) },
        res.status
      );
    }

    // Success → set the same unlock cookie you already use
    return withUnlockCookie(json({ ok: true }));
  } catch (err) {
    // Keep the same high-level behavior but return JSON
    return json({ ok: false, error: "subscribe_error" }, 500);
  }
}

// --- helpers ---
function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function withUnlockCookie(res: Response) {
  const headers = new Headers(res.headers);
  headers.set(
    "Set-Cookie",
    // Same cookie as your original code; 1 year, secure, HttpOnly
    "dkai_captured=1; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax"
  );
  return new Response(res.body, { status: res.status, headers });
}

async function safeText(r: Response) {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

