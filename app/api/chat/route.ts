import { NextRequest } from "next/server";

export const runtime = "edge"; // works on Vercel edge or Node if you remove this line

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

// Log once at startup so you know whether the key is loaded
console.log("OPENAI_API_KEY?", process.env.OPENAI_API_KEY ? "set" : "missing");

export async function POST(req: NextRequest) {
  const { messages = [] } = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response(
      "No OPENAI_API_KEY set in .env.local — add it and restart dev server",
      { status: 500 }
    );
  }

  // Call OpenAI with streaming enabled
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
    const text = await upstream.text().catch(() => "Unknown upstream error");
    return new Response(`[upstream error]\n${text}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Convert OpenAI’s SSE stream into plain text chunks
  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      const s = new TextDecoder().decode(value);
      const lines = s.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content ?? "";
          if (token) controller.enqueue(encoder.encode(token));
        } catch {
          // ignore non-JSON lines
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
