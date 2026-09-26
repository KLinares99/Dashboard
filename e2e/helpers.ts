import { type Page, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

/** Waits for the newest email to `to` sent after `since`, and returns its /auth/confirm link. */
export async function latestLink(to: string, since: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages = [] } = await res.json();
    const fresh = messages.find((m: { Created: string }) => new Date(m.Created).getTime() >= since - 2000);
    if (fresh) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json();
      const m = String(msg.HTML).match(/href="([^"]*\/auth\/confirm\?[^"]+)"/);
      if (m) return m[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email for ${to}`);
}

export async function signIn(page: Page, email: string) {
  const since = Date.now();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await latestLink(email, since));
}

export async function ensureStaff(email: string) {
  const db = admin();
  const { data } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!data) {
    const { error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw error;
  }
}
