"use client";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

type Props = { open: boolean; onClose: () => void; onSuccess: () => void };

export default function EmailWall({ open, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);

    try {
      // attempt event
      const domain = (email.split("@")[1] || "").toLowerCase();
      trackEvent("email_submit_attempt", { email_domain: domain, variant: "softwall_v1" });

      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // treat duplicates as success for analytics (Beehiiv often 409)
      const text = await res.text().catch(() => "");
      const duplicate = res.status === 409 || /already/i.test(text);

      if (!res.ok && !duplicate) {
        setErr(text || "Signup failed. Please try again.");
        trackEvent("error_subscribe_failed", { code: res.status || "unknown" });
        return;
      }

      // success event
      trackEvent("email_submit_success", {
        source: "softwall",
        variant: "softwall_v1",
        duplicate,
      });

      try { localStorage.setItem("dkai_signed_in", "1"); } catch {}
      setDone(true);
      onSuccess();
    } catch (e) {
      setErr("Network error. Please try again.");
      trackEvent("error_subscribe_failed", { code: "network" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
        {!done ? (
          <>
            <h2 className="mb-2 text-xl font-semibold">Join to continue</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded border p-2"
              />
              {err && <p className="text-sm text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded bg-blue-600 p-2 text-white disabled:opacity-60"
                >
                  {submitting ? "Signing up…" : "Sign up"}
                </button>
                <button type="button" onClick={onClose} className="rounded border px-3">
                  Cancel
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="font-semibold text-green-700">
              Thanks for signing up! You can now resume your chat!
            </p>
            <button onClick={onClose} className="mt-4 w-full rounded bg-blue-600 p-2 text-white">
              Back to chat
            </button>
          </>
        )}
      </div>
    </div>
  );
}
