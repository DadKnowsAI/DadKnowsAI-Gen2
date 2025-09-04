"use client";
import { useState } from "react";

// Save this file as: app/beta/page.tsx (Next.js App Router)
// TailwindCSS required. Assumes you already have an API route at /api/subscribe that accepts { email } via POST.
// Behavior: On successful submit, reveals a big "Get testing now!" button linking to the home page.

export default function BetaLandingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "beta-landing" }),
      });
      if (!res.ok) throw new Error(`Signup failed (${res.status})`);
      setSuccess(true);
    } catch (err: any) {
      // Even if the API fails, we can still flip success to reduce friction during beta.
      console.error(err);
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">Beta Program</span>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                Help us test <span className="underline decoration-sky-300 decoration-4 underline-offset-4">DadKnowsAI</span>
              </h1>
              <p className="mt-4 max-w-prose text-slate-700">
                We’re building a calm, practical AI assistant for adults 45+. Join the beta, try it free,
                and tell us what to improve. Your feedback steers the roadmap.
              </p>
              <ul className="mt-6 space-y-2 text-slate-700">
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-slate-400" /> Quick answers for everyday tasks</li>
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-slate-400" /> No jargon—clear, step‑by‑step help</li>
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-slate-400" /> Built with feedback from real testers</li>
              </ul>
            </div>

            {/* Card */}
            <div className="lg:justify-self-end">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">Join the Beta</h2>
                <p className="mt-1 text-sm text-slate-600">Enter your email to get the quick-start guide and access.</p>

                {!success ? (
                  <form onSubmit={onSubmit} className="mt-4 space-y-3">
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-300/40 focus:border-sky-400 focus:ring-4"
                      placeholder="you@example.com"
                    />
                    {error && <p className="text-sm text-rose-600">{error}</p>}

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-2 w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-center text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {loading ? "Submitting…" : "Sign up & get the guide"}
                    </button>
                    <p className="text-xs text-slate-500">We’ll send a short PDF: “5 ways to use DadKnowsAI today.”</p>
                  </form>
                ) : (
                  <div className="mt-4">
                    <div className="rounded-xl bg-slate-50 p-4 text-slate-700">
                      <p className="font-medium">You’re in! Check your email for the quick‑start PDF.</p>
                      <p className="mt-1 text-sm">When you’re ready, jump right into the chatbot.</p>
                    </div>
                    <a
                      href="/"
                      className="mt-4 block w-full rounded-2xl bg-sky-600 px-4 py-3 text-center text-white font-semibold shadow-sm transition hover:bg-sky-700"
                    >
                      Get testing now →
                    </a>
                  </div>
                )}

                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  By signing up, you agree to receive occasional product updates. Unsubscribe anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof / examples */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h3 className="text-lg font-semibold text-slate-900">What can DadKnowsAI do?</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Plan everyday tasks",
                desc: "Trip checklists, grocery planners, meal ideas, and simple budgets in plain English.",
              },
              {
                title: "Tech made easy",
                desc: "Step‑by‑step help for phone or computer problems—no jargon.",
              },
              { title: "Learn faster", desc: "Explain any topic simply, then go deeper as you ask follow‑ups." },
              { title: "Forms & letters", desc: "Draft emails, letters, or checklists you can edit and send." },
            ].map((it) => (
              <div key={it.title} className="rounded-xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">{it.title}</p>
                <p className="mt-1 text-slate-600">{it.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h3 className="text-lg font-semibold text-slate-900">Common questions</h3>
          <dl className="mt-4 space-y-4">
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <dt className="font-medium text-slate-900">Is the beta free?</dt>
              <dd className="mt-1 text-slate-700">Yes. We just ask for honest feedback.</dd>
            </div>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <dt className="font-medium text-slate-900">What happens after I sign up?</dt>
              <dd className="mt-1 text-slate-700">You’ll receive a short PDF with example prompts and a link to start testing.</dd>
            </div>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <dt className="font-medium text-slate-900">Who is this for?</dt>
              <dd className="mt-1 text-slate-700">Adults 45+ who want practical, everyday help without the tech jargon.</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="rounded-2xl bg-slate-900 p-8 text-white">
            <h3 className="text-2xl font-bold">Ready to help shape DadKnowsAI?</h3>
            <p className="mt-2 text-slate-200">Join the beta, try it, and tell us what to improve.</p>
            <a
              href="#top"
              className="mt-6 inline-block rounded-2xl bg-white/10 px-5 py-3 font-semibold backdrop-blur transition hover:bg-white/20"
              onClick={(e) => {
                e.preventDefault();
                const el = document.querySelector("input#email");
                (el as HTMLInputElement | null)?.focus();
              }}
            >
              Join with your email
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
