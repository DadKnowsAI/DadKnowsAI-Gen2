import { NextRequest } from "next/server";

export const runtime = "nodejs";

const RAW_KEY = process.env.BEEHIIV_API_KEY || "";
const RAW_PUB = process.env.BEEHIIV_PUBLICATION_ID || "";

// Trim to avoid hidden spaces/newlines from pasting
const BEEHIIV_API_KEY = RAW_KEY.trim();
const PUB_ID = RAW_PUB.trim();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response("Email required", { status: 400 });
    }
    if (!BEEHIIV_API_KEY || !PUB_ID) {
      return new Response("Beehiiv not configured", { status: 500 });
    }

    const url = `https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions`;
    const body = JSON.stringify({
      email,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: "chat_soft_wall",
    });

    // Try Authorization: Bearer first
    let res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BEEHIIV_API_KEY}`,
      },
      body,
    });

    // Fallback to X-Authorization if needed
    if (res.status === 401) {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": BEEHIIV_API_KEY,
        },
        body,
      });
    }

    // 409 = already subscribed → treat as success
    if (!res.ok && res.status !== 409) {
      const err = await res.text().catch(() => "Beehiiv error");
      return new Response(err, { status: res.status });
    }

    // Unlock: set cookie for a year
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie":
        "dkai_captured=1; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax",
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch {
    return new Response("Subscribe error", { status: 500 });
  }
}
