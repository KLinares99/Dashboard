// Captures screenshots of the main screens. Not a test; run with:
//   npx tsx e2e/screens.ts <outDir>
import { chromium } from "@playwright/test";
import { admin, ensureStaff, signIn } from "./helpers";

const out = process.argv[2] ?? "screens";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  await ensureStaff("staff@elevate.test");
  const db = admin();
  await db.from("profiles").update({ client_id: "11111111-0000-4000-8000-000000000004" }).eq("email", "client@warriors.test");

  for (const [who, email, pages] of [
    ["staff", "staff@elevate.test", ["/app/clients/warriors", "/app/clients/warriors?tab=tasks"]],
    ["client", "client@warriors.test", ["/portal", "/portal?view=invoices"]],
  ] as const) {
    for (const [label, width] of [["desk", 1320], ["phone", 390]] as const) {
      const ctx = await browser.newContext({ baseURL: base, viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await signIn(page, email);
      for (const p of pages) {
        await page.goto(p);
        await page.waitForLoadState("networkidle");
        const name = `${who}-${label}-${p.replace(/[/?=]+/g, "_").replace(/^_/, "") || "home"}.png`;
        await page.screenshot({ path: `${out}/${name}`, fullPage: true });
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        console.log(name, sw > width ? `OVERFLOW ${sw}` : "ok");
      }
      await ctx.close();
    }
  }
  await browser.close();
})();
