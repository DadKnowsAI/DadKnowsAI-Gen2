import { NextRequest } from "next/server";

export const runtime = "nodejs";

const RAW_KEY = process.env.BEEHIIV_API_KEY || "";
const RAW_PUB = process.env.BEEHIIV_PUBLICATION_ID || "";
const BEEHIIV_API_KEY = RAW_KEY.trim();
const PUB_ID = RAW_PUB.trim();

type Incoming = { email?: string; source?: string; honeypot?: string };

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

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

async function fetchWithAuth(
  url: string,
  method: "POST" | "PATCH",
  payload: unknown
): Promise<Response> {
  const body = JSON.stringify(payload);
  const asBearer = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BEEHIIV_API_KEY}`,
    },
    body,
  });
  if (asBearer.status !== 401) return asBearer;

  // Fallback header some Beehiiv workspaces expect
  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Authorization": BEEHIIV_API_KEY,
    },
    body,
  });
}

export async function POST(req: NextRequest) {
  try {
    // ---- parse & validate ----
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    if (typeof body !== "object" || body === null) {
      return json({ ok: false, error: "invalid_body" }, 400);
    }

    const { email: rawEmail, source: rawSource, honeypot } = body as Incoming;

    if (honeypot) return withUnlockCookie(json({ ok: true })); // silent drop

    const email = (rawEmail ?? "").trim().toLowerCase();
    const source = (rawSource ?? "chat_soft_wall").trim();

    if (!email || !isValidEmail(email)) {
      return json({ ok: false, error: "invalid_email" }, 400);
    }
    if (!BEEHIIV_API_KEY || !PUB_ID) {
      return json({ ok: false, error: "beehiiv_not_configured" }, 500);
    }

    // ---- Attempt 1: /publications/:id/subscriptions ----
    const url1 = `https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions`;
    const payload1 = {
      email,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: source,
      custom_fields: { signup_source: source },
    } as const;

    console.log("DEBUG subscribe try1 →", {
      path: "/publications/:id/subscriptions",
      email,
      utm_source: source,
    });

    const r1 = await fetchWithAuth(url1, "POST", payload1);
    const ok1 = r1.ok || r1.status === 409 || r1.status === 422;

    if (!ok1) {
      const t1 = (await safeText(r1)).slice(0, 300);
      console.warn("WARN try1 failed", r1.status, t1);

      // ---- Attempt 2: /subscribers (alt path) ----
      const url2 = "https://api.beehiiv.com/v2/subscribers";
      const payload2 = {
        email,
        publication_id: PUB_ID,
        utm_source: source,
        custom_fields: { signup_source: source },
        reactivate_existing: true,
        send_welcome_email: true,
      } as const;

      console.log("DEBUG subscribe try2 →", {
        path: "/subscribers",
        email,
        utm_source: source,
      });

      const r2 = await fetchWithAuth(url2, "POST", payload2);
      const ok2 = r2.ok || r2.status === 409 || r2.status === 422;

      if (!ok2) {
        const t2 = (await safeText(r2)).slice(0, 300);
        console.error("ERROR both attempts failed", {
          s1: r1.status,
          s2: r2.status,
          t2,
        });
        // Keep beta UX smooth; still unlock
        return withUnlockCookie(json({ ok: true, warn: "beehiiv_error" }));
      }

      return withUnlockCookie(json({ ok: true, via: "subscribers" }));
    }

    // Attempt 1 worked
    return withUnlockCookie(json({ ok: true, via: "publications_subscriptions" }));
  } catch (e) {
    console.error("Subscribe error", e);
    // Keep UX smooth during beta
    return withUnlockCookie(json({ ok: true, warn: "subscribe_error" }));
  }
}
