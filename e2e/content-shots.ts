// Screenshots of the portal content against the fake Drive (e2e/fake-drive.mjs). Not a test; run with:
//   npx tsx e2e/content-shots.ts <outDir>
import { chromium } from "@playwright/test";
import { admin, ensureStaff, signIn } from "./helpers";

const out = process.argv[2] ?? "screens";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const WARRIORS = "11111111-0000-4000-8000-000000000004";

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const db = admin();
  await db.from("clients").update({ drive_folder_id: "fake0001xxxxxxxxxxxx" }).eq("id", WARRIORS);
  await ensureStaff("client@warriors.test"); // creates the login if missing
  await db.from("profiles").update({ client_id: WARRIORS }).eq("email", "client@warriors.test");
  for (const [label, width] of [["desk", 1320], ["phone", 390]] as const) {
    const ctx = await browser.newContext({ baseURL: base, viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await signIn(page, "client@warriors.test");
    const shot = async (name: string) => {
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => [...document.images].filter((i) => i.loading !== "lazy").every((i) => i.complete));
      await page.screenshot({ path: `${out}/${label}-${name}.png`, fullPage: true });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      console.log(label, name, sw > width ? `OVERFLOW ${sw}` : "ok");
    };
    await page.goto("/portal#content");
    await shot("home");
    await page.locator(".post-tile", { hasText: "What You Won" }).first().click();
    await page.waitForURL(/post=/);
    await shot("carousel");
    await page.goto("/portal?type=reel#content");
    await shot("reels");
    await page.locator(".post-tile").first().click();
    await page.waitForURL(/post=/);
    await shot("reel");
    await ctx.close();
  }
  await browser.close();
})();
