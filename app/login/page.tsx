import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mark } from "@/components/Icon";
import { getProfile } from "@/lib/auth";
import { sendMagicLink } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  email: "That doesn't look like an email address.",
  send: "We couldn't send the link. Try again in a minute.",
  rate: "Too many links requested. Wait a minute, then try again.",
  link: "That sign-in link has expired or was already used. Request a new one below.",
  "no-access": "Your login isn't linked to a client yet. Ask Elevate to finish setting up your access.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  const p = await getProfile();
  if (p && !(error === "no-access")) redirect(p.role === "staff" ? "/app" : "/portal");

  return (
    <main className="login">
      <section className="login-art">
        <div className="brand"><Mark /><div><div className="brand-name">Elevate</div><div className="brand-sub">BUSINESS<br />SOLUTIONS</div></div></div>
        <h1>Your brand, <em>in one place.</em></h1>
        <p style={{ color: "rgba(255,255,255,.82)", maxWidth: "40ch", margin: 0 }}>
          Progress, content, results and invoices for every Elevate client.
        </p>
      </section>
      <section className="login-form">
        {sent ? (
          <form action={sendMagicLink}>
            <h2>Check your email</h2>
            <p className="muted" style={{ margin: 0 }}>
              If <b style={{ color: "var(--text)" }}>{sent}</b> has access, a sign-in link is on its way. It works once and expires in an hour.
            </p>
            <input type="hidden" name="email" value={sent} />
            <button className="btn" type="submit">Send another link</button>
            <a href="/login" className="muted" style={{ fontSize: 15 }}>Use a different email</a>
          </form>
        ) : (
          <form action={sendMagicLink}>
            <div className="eyebrow">Client portal</div>
            <h2>Sign in</h2>
            <p className="muted" style={{ margin: 0 }}>Enter the email Elevate invited. We&apos;ll send you a one-click sign-in link. No password needed.</p>
            {error && ERRORS[error] && <div className="notice err" role="alert">{ERRORS[error]}</div>}
            <label className="field">
              <span>Email</span>
              <input className="input" id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
            </label>
            <button className="btn primary" type="submit">Email me a sign-in link</button>
          </form>
        )}
      </section>
    </main>
  );
}
