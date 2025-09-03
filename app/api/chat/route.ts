import { NextRequest } from "next/server";

export const runtime = "nodejs"; // cookie updates are simpler on node runtime

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response("OPENAI_API_KEY missing", { status: 500 });

  const { messages = [] } = await req.json();

  // Read cookies for gating
  const cookies = req.headers.get("cookie") || "";
  const captured = /(?:^|;\s*)dkai_captured=1/.test(cookies);
  const countMatch = cookies.match(/(?:^|;\s*)dkai_c=(\d+)/);
  const priorCount = countMatch ? parseInt(countMatch[1], 10) || 0 : 0;

  // Gate: allow first 3 messages without signup
  if (!captured && priorCount >= 3) {
    return new Response(
      "You've reached the free limit. Please sign up to keep chatting.",
      { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  // Increment count for this request (only matters pre-capture)
  const newCount = captured ? priorCount : priorCount + 1;

  // Call OpenAI (stream)
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

  const stream = new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
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
          if (token) controller.enqueue(encoder.encode(token));
        } catch {}
      }
    },
  });

  // Set/refresh the counter cookie for 24h
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Set-Cookie": `dkai_c=${newCount}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`,
  });

  return new Response(stream, { status: 200, headers });
}
