import { NextRequest } from "next/server";

export const runtime = "nodejs"; // we'll set cookies from the server

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY!;
const PUB_ID = process.env.BEEHIIV_PUBLICATION_ID!; // use the v2 ID that starts with "pub_"

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response("Email required", { status: 400 });
    }
    if (!BEEHIIV_API_KEY || !PUB_ID) {
      return new Response("Beehiiv not configured", { status: 500 });
    }

    // Beehiiv v2 Subscribe
    const res = await fetch(`https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": BEEHIIV_API_KEY,
      },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: "chat_soft_wall",
      }),
    });

    // 409 means "already subscribed" — treat as success
    if (!res.ok && res.status !== 409) {
      const err = await res.text().catch(() => "Beehiiv error");
      return new Response(err, { status: res.status });
    }

    // Mark unlocked with an HttpOnly cookie for a year
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
