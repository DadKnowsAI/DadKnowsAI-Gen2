import { NextRequest } from "next/server";

export const runtime = "nodejs";

const RAW_KEY = process.env.BEEHIIV_API_KEY || "";
const RAW_PUB = process.env.BEEHIIV_PUBLICATION_ID || "";
const BEEHIIV_API_KEY = RAW_KEY.trim();
const PUB_ID = RAW_PUB.trim();

type Incoming = { email?: string; source?: string };

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function json(obj: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function withUnlockCookie(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set(
    "Set-Cookie",
    "dkai_captured=1; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax"
  );
  return new Response(res.body, { status: res.status, headers });
}

async function fetchWithAuth(url: string, payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);
  const r1 = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BEEHIIV_API_KEY}`,
    },
    body,
  });
  if (r1.status !== 401) return r1;

  // fallback for some workspaces
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Authorization": BEEHIIV_API_KEY,
    },
    body,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Incoming;
    const email = (body.email || "").trim().toLowerCase();
    const source = (body.source || "chat_soft_wall").trim();

    if (!email || !isValidEmail(email)) {
      return json({ ok: false, error: "invalid_email" }, 400);
    }
    if (!BEEHIIV_API_KEY || !PUB_ID) {
      return json({ ok: false, error: "beehiiv_not_configured" }, 500);
    }

    const url = `https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions`;

    // ✅ Minimal payload + UTM source for segmentation
    const payload = {
      email,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: source, // <-- key for your Beta Testers segment
    };

    console.log("DEBUG subscribe with UTM →", payload);
    const res = await fetchWithAuth(url, payload);
    const text = await res.text();
    console.log("DEBUG beehiiv response", res.status, text.slice(0, 300));

    if (!res.ok && res.status !== 409) {
      return withUnlockCookie(
        json({ ok: false, error: "beehiiv_reject", status: res.status })
      );
    }

    return withUnlockCookie(json({ ok: true, status: res.status }));
  } catch (e) {
    console.error("Subscribe error", e);
    return withUnlockCookie(json({ ok: false, error: "subscribe_error" }));
  }
}
