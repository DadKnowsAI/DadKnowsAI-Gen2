"use client";
import { useState } from "react";

export default function EmailWall({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  async function submit() {
    setError(null);
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) return setError("Enter a valid email");
    setSubmitting(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Subscribe failed");
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-2 text-2xl font-bold">Keep chatting with DadKnowsAI</h2>
        <p className="mb-4 text-slate-600">
          Enter your email to continue. We’ll add you to the beta list.
        </p>

        <input
          type="email"
          className="mb-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-lg outline-none"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
        {error && <div className="mb-2 text-sm text-red-600">{error}</div>}

        <div className="mt-3 flex gap-2">
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Continue"}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Not now
          </button>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          By continuing, you agree to our Terms and Privacy.
        </div>
      </div>
    </div>
  );
}
