import { NextRequest } from "next/server";

export const runtime = "nodejs";

const RAW_KEY = process.env.BEEHIIV_API_KEY || "";
const RAW_PUB = process.env.BEEHIIV_PUBLICATION_ID || "";
const BEEHIIV_API_KEY = RAW_KEY.trim();
const PUB_ID = RAW_PUB.trim();

type Payload = { email?: string; source?: string; honeypot?: string };

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

    if (body.honeypot) return withUnlockCookie(json({ ok: true }));

    const email = (body.email || "").trim().toLowerCase();
    const source = (body.source || "chat_soft_wall").trim();

    if (!email || !isValidEmail(email)) return json({ ok: false, error: "invalid_email" }, 400);
    if (!BEEHIIV_API_KEY || !PUB_ID) return json({ ok: false, error: "beehiiv_not_configured" }, 500);

    // --- helpers ---
    const headersA = { "Content-Type": "application/json", Authorization: `Bearer ${BEEHIIV_API_KEY}` };
    const headersB = { "Content-Type": "application/json", "X-Authorization": BEEHIIV_API_KEY };

    const post = async (url: string, payload: any) => {
      let r = await fetch(url, { method: "POST", headers: headersA, body: JSON.stringify(payload) });
      if (r.status === 401) r = await fetch(url, { method: "POST", headers: headersB, body: JSON.stringify(payload) });
      return r;
    };

    const patch = async (url: string, payload: any) => {
      let r = await fetch(url, { method: "PATCH", headers: headersA, body: JSON.stringify(payload) });
      if (r.status === 401) r = await fetch(url, { method: "PATCH", headers: headersB, body: JSON.stringify(payload) });
      return r;
    };

    // ---- Attempt 1: your current endpoint (subscriptions under publication) ----
    const url1 = `https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions`;
    const payload1 = {
      email,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: source,                       // <-- segmentation via UTM
      custom_fields: { signup_source: source }, // <-- custom field for reliable segmenting
    };

    console.log("DEBUG subscribe try1 →", { url: "/publications/:id/subscriptions", email, utm_source: source });
    let r1 = await post(url1, payload1);
    let body1: any = null;
    try { body1 = await r1.json(); } catch { /* noop */ }

    // Accept success or "already subscribed"
    const ok1 = r1.ok || [409, 422].includes(r1.status);

    // If created/exists but custom fields didn’t stick, try PATCH subscriber with fields
    if (ok1) {
      const subId = body1?.id || body1?.data?.id || body1?.subscriber_id;
      if (subId) {
        const urlPatch = `https://api.beehiiv.com/v2/subscribers/${subId}`;
        const patchPayload = { custom_fields: { signup_source: source } };
        const rp = await patch(urlPatch, patchPayload);
        console.log("DEBUG patch custom_fields →", { id: subId, status: rp.status });
      } else {
        console.log("DEBUG patch custom_fields → skipped (no id in response)");
      }
    }

    // If attempt 1 failed (e.g., metadata ignored), try Attempt 2
    if (!ok1) {
      const text1 = await safeText(r1);
      console.warn("WARN try1 failed", r1.status, text1.slice(0, 300));

      // ---- Attempt 2: alternate endpoint (/subscribers) with publication_id ----
      const url2 = `https://api.beehiiv.com/v2/subscribers`;
      const payload2 = {
        email,
        publication_id: PUB_ID,
        utm_source: source,
        custom_fields: { signup_source: source },
        reactivate_existing: true,
        send_welcome_email: true,
      };

      console.log("DEBUG subscribe try2 →", { url: "/subscribers", email, utm_source: source });
      const r2 = await post(url2, payload2);
      const ok2 = r2.ok || [409, 422].includes(r2.status);

      if (ok2) {
        let body2: any = null;
        try { body2 = await r2.json(); } catch { /* noop */ }
        const subId2 = body2?.id || body2?.data?.id || body2?.subscriber_id;
        if (subId2) {
          const urlPatch2 = `https://api.beehiiv.com/v2/subscribers/${subId2}`;
          const rp2 = await patch(urlPatch2, { custom_fields: { signup_source: source } });
          console.log("DEBUG patch custom_fields (try2) →", { id: subId2, status: rp2.status });
        }
        return withUnlockCookie(json({ ok: true, via: "subscribers" }));
      }

      const text2 = await safeText(r2);
      console.error("ERROR both attempts failed", { s1: r1.status, s2: r2.status, t2: text2.slice(0, 300) });
      // still unlock to keep UX smooth
      return withUnlockCookie(json({ ok: true, warn: "beehiiv_error" }));
    }

    // Attempt 1 succeeded
    return withUnlockCookie(json({ ok: true, via: "publications_subscriptions" }));
  } catch (e) {
    console.error("Subscribe error", e);
    return withUnlockCookie(json({ ok: true, warn: "subscribe_error" }));
  }
}

// --- helpers ---
function json(obj: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function withUnlockCookie(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("Set-Cookie", "dkai_captured=1; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax");
  return new Response(res.body, { status: res.status, headers });
}

async function safeText(r: Response): Promise<string> {
  try { return await r.text(); } catch { return ""; }
}
