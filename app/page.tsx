"use client";

import { useEffect, useRef, useState } from "react";
import EmailWall from "./components/EmailWall";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };

// Safe GA wrapper (won't crash if gtag isn't loaded yet)
function trackEvent(name: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", name, params);
  }
}

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi! Ask me anything. I give practical, step-by-step answers.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showWall, setShowWall] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Keep your auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Decide whether to show the soft wall + fire wall_view
  useEffect(() => {
    const has = typeof window !== "undefined" && localStorage.getItem("dkai_signed_in") === "1";
    setShowWall(!has);
    if (!has) trackEvent("wall_view", { variant: "softwall_v1" });
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    // Track “first chat after signup” once
    try {
      const ts = localStorage.getItem("dkai_signup_ts");
      if (ts) {
        const seconds = Math.round((Date.now() - Number(ts)) / 1000);
        trackEvent("chat_first_message_after_signup", { seconds_since_signup: seconds });
        localStorage.removeItem("dkai_signup_ts"); // only once
      }
    } catch {}

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (res.status === 429) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, content: "Please sign up to keep chatting." }
              : m
          )
        );
        setShowWall(true);
        return;
      }

      const ct = res.headers.get("content-type") ?? "";
      const isText = ct.startsWith("text/") || ct.includes("charset");

      if (!res.ok || !isText) {
        const errText = await res.text().catch(() => "Unknown error");
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: `[error from server]\n${errText}` } : m
          )
        );
        return;
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: m.content + chunk } : m
            )
          );
        }
      } else {
        const full = await res.text();
        setMessages((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: full } : m))
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: `[connection error] ${msg}` } : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-3xl font-extrabold">DadKnowsAI (Beta)</h1>

      <section className="mb-36 space-y-3">
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          return (
            <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%]">
                <div
                  className={`mb-1 text-[10px] font-semibold tracking-wide uppercase ${
                    isUser ? "text-slate-500 text-right" : "text-slate-500"
                  }`}
                >
                  {isUser ? "Me" : "DadKnowsAI"}
                </div>
                <div
                  className={`whitespace-pre-wrap rounded-2xl p-3 shadow-sm text-[1.05rem] leading-7 ${
                    isUser
                      ? "bg-blue-50 border border-blue-100 text-slate-900"
                      : "bg-white border border-slate-200 text-slate-900"
                  } ${isUser ? "text-right" : "text-left"}`}
                >
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="fixed inset-x-0 bottom-0 mx-auto max-w-3xl bg-white/80 backdrop-blur px-4 pb-4"
      >
        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-md">
          <input
            className="flex-1 rounded-xl px-4 py-3 text-xl font-semibold outline-none placeholder:text-slate-400 placeholder:font-medium"
            placeholder="Type your question…"
            aria-label="Type your question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending || showWall}
          />
          <button
            type="submit"
            className="rounded-xl px-5 py-3 text-lg font-bold text-white disabled:opacity-50 bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
            disabled={sending || showWall}
          >
            Send
          </button>
        </div>
        <div className="h-3" />
      </form>

      <EmailWall
        open={showWall}
        onClose={() => setShowWall(false)}
        onSuccess={() => {
          // remember signup so the wall stays hidden and we can time the first chat
          try {
            localStorage.setItem("dkai_signed_in", "1");
            localStorage.setItem("dkai_signup_ts", String(Date.now()));
          } catch {}
          setShowWall(false);
        }}
      />
    </main>
  );
}
