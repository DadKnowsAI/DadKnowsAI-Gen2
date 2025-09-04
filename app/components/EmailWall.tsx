"use client";

import { useState } from "react";

export default function EmailWall({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      // ✅ success
      setSuccess(true);

      // auto-close after 2.5s
      setTimeout(() => {
        onClose();
      }, 2500);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white rounded-2xl p-6 w-[95%] max-w-md shadow-lg text-center">
        {!success ? (
          <>
            <h2 className="text-xl font-bold mb-2">Keep chatting with DadKnowsAI</h2>
            <p className="text-gray-600 mb-4">
              Enter your email to continue. We’ll add you to the beta list.
            </p>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border rounded-lg px-3 py-2 mb-3"
              disabled={loading}
            />

            {error && (
              <p className="text-sm text-red-500 mb-3 whitespace-pre-wrap">{error}</p>
            )}

            <div className="flex justify-center gap-3">
              <button
                onClick={submit}
                disabled={loading || !email}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Continue"}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="bg-gray-200 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300"
              >
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-2 text-green-600">
              Thanks for signing up as a beta tester!
            </h2>
            <p className="text-gray-700">
              You can now continue your conversation.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
