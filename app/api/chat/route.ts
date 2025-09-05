// app/api/chat/route.ts
/* eslint-disable no-console */
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

/** Minimal message type matching your client payload */
type ChatRole = "user" | "assistant" | "system";
type ChatMessage = { role: ChatRole; content: string };

/** Type for OpenAI streaming lines we parse */
type OpenAIStreamChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
};

/** Ensure we have a chat_session (tracked via cookie dkai_sid) */
async function ensureSession(req: NextRequest): Promise<string> {
  const cookies = req.headers.get("cookie") || "";
  const sidMatch = cookies.match(/(?:^|;\s*)dkai_sid=([^;]+)/);
  let sessionId = sidMatch ? decodeURIComponent(sidMatch[1]) : null;

  if (!sessionId) {
    const { data, error } = await supabaseAdmin
      .from("chat_session")
      .insert({})
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    sessionId = String(data.id);
  }
  return sessionId;
}

async function logMessage(args: {
  sessionId: string;
  role: ChatRole;
  content: string;
  model?: string | null;
  token_usage?: number | null;
  tags?: string[] | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
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

/** Safe JSON.parse for streaming lines */
function parseStreamLine(line: string): OpenAIStreamChunk | null {
  try {
    return JSON.parse(line) as OpenAIStreamChunk;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response("OPENAI_API_KEY missing", { status: 500 });

  // ---- Parse body
  const body = (await req.json()) as { messages?: unknown };
  const messages = Array.isArray(body.messages)
    ? (body.messages.filter(
        (m): m is ChatMessage =>
          !!m &&
          typeof (m as { role?: unknown }).role === "string" &&
          typeof (m as { content?: unknown }).content === "string" &&
          ["user", "assistant", "system"].includes(
            String((m as { role: unknown }).role)
          )
      ) as ChatMessage[])
    : ([] as ChatMessage[]);

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
  } catch (e) {
    console.error("ensureSession error:", e);
    return new Response("Failed to start session", { status: 500 });
  }

  // ---- Log only the latest user turn (avoid duplicates)
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser?.content) {
    await logMessage({
      sessionId,
      role: "user",
      content: lastUser.content,
      meta: { from: "api/chat", gated: !captured, priorCount },
    });
  }

  // ---- Call OpenAI (stream)
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
  let fullAnswer = "";

  const stream = new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();

      if (done) {
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
        } catch (e) {
          console.error("assistant log error:", e);
        }
        controller.close();
        return;
      }

      const chunkText = new TextDecoder().decode(value);
      for (const rawLine of chunkText.split("\n")) {
        const trimmed = rawLine.trim();
        if (!trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        const json = parseStreamLine(data);
        const token =
          json?.choices?.[0]?.delta?.content !== undefined
            ? String(json.choices[0].delta?.content ?? "")
            : "";

        if (token) {
          fullAnswer += token;
          controller.enqueue(encoder.encode(token));
        }
      }
    },
  });

  // ---- Cookies: counter + session id
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Set-Cookie": [
      `dkai_c=${newCount}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`,
      `dkai_sid=${encodeURIComponent(
        sessionId
      )}; Path=/; Max-Age=1209600; HttpOnly; Secure; SameSite=Lax`,
    ].join(", "),
  });

  return new Response(stream, { status: 200, headers });
}
