// app/api/chat/route.ts
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs"; // cookie updates + supabase-js are simpler on node

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

/** Ensure we have a chat_session and a cookie to tie messages together */
async function ensureSession(req: NextRequest) {
  const cookies = req.headers.get("cookie") || "";
  const sidMatch = cookies.match(/(?:^|;\s*)dkai_sid=([^;]+)/);
  let sessionId = sidMatch ? decodeURIComponent(sidMatch[1]) : null;

  if (!sessionId) {
    // create a session row
    const { data, error } = await supabaseAdmin
      .from("chat_session")
      .insert({})
      .select("id")
      .single();
    if (error) throw error;
    sessionId = data.id as string;
  }

  return sessionId!;
}

/** Insert one message row */
async function logMessage(args: {
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  token_usage?: number | null;
  tags?: string[] | null;
  meta?: Record<string, any> | null;
}) {
  const { error } = await supabaseAdmin.from("chat_message").insert({
    session_id: args.sessionId,
    role: args.role,
    content: args.content,
    model: args.model ?? null,
    token_usage: args.token_usage ?? null,
    tags: args.tags ?? null,
    meta: args.meta ?? null,
  });
  if (error) console.error("logMessage error:", error.message);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response("OPENAI_API_KEY missing", { status: 500 });

  // ---- Parse body (your existing contract: { messages: [...] })
  const { messages = [] } = await req.json();

  // ---- Gating (unchanged)
  const cookieHeader = req.headers.get("cookie") || "";
  const captured = /(?:^|;\s*)dkai_captured=1/.test(cookieHeader);
  const countMatch = cookieHeader.match(/(?:^|;\s*)dkai_c=(\d+)/);
  const priorCount = countMatch ? parseInt(countMatch[1], 10) || 0 : 0;

  if (!captured && priorCount >= 3) {
    return new Response(
      "You've reached the free limit. Please sign up to keep chatting.",
      { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
  const newCount = captured ? priorCount : priorCount + 1;

  // ---- Ensure/obtain a session for logging
  let sessionId: string;
  try {
    sessionId = await ensureSession(req);
  } catch (e: any) {
    console.error("ensureSession error:", e?.message);
    return new Response("Failed to start session", { status: 500 });
  }

  // ---- Log the latest user message (if any)
  // We’ll log only the final user turn in the array to avoid duplicating prior history.
  const lastUser = [...messages].reverse().find((m: any) => m?.role === "user");
  if (lastUser?.content) {
    await logMessage({
      sessionId,
      role: "user",
      content: String(lastUser.content),
      meta: { from: "api/chat", gated: !captured, priorCount },
    });
  }

  // ---- Call OpenAI (stream) – identical behavior to your original
  const upstream = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You are DadKnowsAI — a calm, practical helper for adults 45+. Be concise, step-by-step, and down-to-earth.",
        },
        ...messages,
      ],
      temperature: 0.3,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "Upstream error");
    return new Response(text, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();

  // We’ll accumulate the streamed tokens to log the assistant message when done.
  let fullAnswer = "";

  const stream = new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();

      if (done) {
        // Stream finished — log the assistant reply
        try {
          if (fullAnswer.trim().length > 0) {
            await logMessage({
              sessionId,
              role: "assistant",
              content: fullAnswer,
              model: MODEL,
              meta: { streamed: true },
            });
          }
        } catch (e: any) {
          console.error("assistant log error:", e?.message);
        }
        controller.close();
        return;
      }

      const chunk = new TextDecoder().decode(value);
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content ?? "";
          if (token) {
            fullAnswer += token;
            controller.enqueue(encoder.encode(token));
          }
        } catch {
          // ignore JSON parse errors on keep-alives
        }
      }
    },
  });

  // ---- Set/refresh cookies: counter + session id
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Set-Cookie": [
      `dkai_c=${newCount}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`,
      // keep a session cookie so we tie future turns to the same session row
      `dkai_sid=${encodeURIComponent(
        sessionId
      )}; Path=/; Max-Age=1209600; HttpOnly; Secure; SameSite=Lax`, // 14 days
    ].join(", "),
  });

  return new Response(stream, { status: 200, headers });
}

