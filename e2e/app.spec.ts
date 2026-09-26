import { type Browser, type Page, expect, test } from "@playwright/test";
import path from "node:path";
import { admin, ensureStaff, latestLink, signIn } from "./helpers";

const STAFF = "staff@elevate.test";
const CLIENT = "client@warriors.test";

test.describe.configure({ mode: "serial" });

test("signed-out visitors can't reach the app", async ({ page }) => {
  for (const p of ["/app", "/app/clients/warriors", "/portal", "/portal/invoices"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/login$/);
  }
  const res = await page.request.get("/api/drive/abcdefghijklmnop", { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(res.status());
});

test("an unknown email gets the same answer and no email", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("stranger@nowhere.test");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(latestLink("stranger@nowhere.test", Date.now() - 3000)).rejects.toThrow();
});

let staff: Page;
test.describe("staff", () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    await ensureStaff(STAFF);
    staff = await (await browser.newContext()).newPage();
    await signIn(staff, STAFF);
  });

  test("lands on Pulse with every client", async () => {
    await expect(staff).toHaveURL(/\/app$/);
    await expect(staff.getByRole("heading", { level: 1, name: "Pulse" })).toBeVisible();
    for (const name of ["Relevate Solutions", "NYTI", "The Warriors Project", "Landscaping Website"]) {
      await expect(staff.locator(".roster-row", { hasText: name })).toBeVisible();
    }
    await expect(staff.locator(".tile", { hasText: "Unpaid" })).toContainText("$888");
  });

  test("adds, edits, completes and deletes a task", async () => {
    await staff.goto("/app/clients/warriors?tab=tasks");
    const input = staff.getByPlaceholder("Add a task, then press Enter");
    await input.fill("E2E: draft October carousel");
    await input.press("Enter");
    const row = staff.locator(".task", { hasText: "E2E: draft October carousel" });
    await expect(row.getByRole("button", { name: "Edit task" })).toBeVisible(); // saved (has a real id)
    await staff.reload();
    await expect(row).toBeVisible(); // persisted

    await row.getByRole("button", { name: "Edit task" }).click();
    const editor = staff.locator(".task-edit");
    await editor.getByLabel("Task").fill("E2E: final October carousel");
    await editor.getByLabel("Priority").selectOption("urgent");
    await editor.getByLabel("Client can see this").uncheck();
    await editor.getByRole("button", { name: "Save" }).click();
    const edited = staff.locator(".task", { hasText: "E2E: final October carousel" });
    await expect(edited.locator(".pill", { hasText: "urgent" })).toBeVisible();
    await expect(edited.locator(".pill", { hasText: "Internal" })).toBeVisible();

    await edited.getByRole("checkbox").check();
    await expect(staff.locator('ul.task-list[aria-busy="false"]')).toBeVisible();
    await expect(staff.locator(".task.done", { hasText: "E2E: final October carousel" })).toBeVisible(); // stays visible
    await staff.reload();
    await staff.getByRole("button", { name: /Show all \d+ completed/ }).click();
    await expect(staff.locator(".task.done", { hasText: "E2E: final October carousel" })).toBeVisible();

    const done = staff.locator(".task", { hasText: "E2E: final October carousel" });
    await done.getByRole("button", { name: /Delete/ }).click();
    await done.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(done).toHaveCount(0);
    await staff.reload();
    await expect(staff.locator(".task", { hasText: "E2E: final October carousel" })).toHaveCount(0);
  });

  test("uploads a GA4 export and charts it", async () => {
    await staff.goto("/app/clients/warriors?tab=analytics");
    await staff.getByLabel("CSV export").setInputFiles(path.join(__dirname, "fixtures/warriors-ga4.csv"));
    await staff.getByRole("button", { name: "Upload and chart" }).click();
    await expect(staff.getByRole("status")).toContainText("Imported 3 metrics");
    await expect(staff.locator(".chart-head", { hasText: "Sessions" })).toBeVisible();
    await expect(staff.locator(".chart svg").first()).toBeVisible();
  });

  test("rejects a file it can't chart, with a reason", async () => {
    await staff.goto("/app/clients/warriors?tab=analytics");
    await staff.getByLabel("CSV export").setInputFiles({ name: "pages.csv", mimeType: "text/csv", buffer: Buffer.from("Page,Views\n/home,4\n") });
    await staff.getByRole("button", { name: "Upload and chart" }).click();
    await expect(staff.locator(".notice.err")).toContainText("date column");
  });

  test("marks an invoice paid", async () => {
    await staff.goto("/app/clients/warriors?tab=billing");
    const aug = staff.locator("tr", { hasText: "August 2026 retainer" });
    await aug.getByRole("button", { name: "Mark paid" }).click();
    await expect(aug.locator(".pill")).toHaveText("Paid");
    await expect(staff.locator(".tile", { hasText: "Unpaid" })).toContainText("$444");
  });

  test("creates a client", async () => {
    await staff.goto("/app/clients/new");
    await staff.getByLabel("Business name").fill("E2E Bakery");
    await staff.getByLabel("Price in dollars (monthly for retainers)").fill("300");
    await staff.getByRole("button", { name: "Add client" }).click();
    await expect(staff).toHaveURL(/\/app\/clients\/e2e-bakery$/);
    await expect(staff.getByRole("heading", { level: 1, name: "E2E Bakery" })).toBeVisible();
  });

  test("invites the Warriors contact", async () => {
    await staff.goto("/app/clients/warriors?tab=access");
    await staff.getByLabel("Email").fill(CLIENT);
    await staff.getByRole("button", { name: "Send portal invite" }).click();
    await expect(staff.getByRole("status")).toContainText(`Invite sent to ${CLIENT}`);
    await expect(staff.locator(".list-rows", { hasText: CLIENT })).toBeVisible();
  });
});

test.describe("client", () => {
  let client: Page;
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    client = await (await browser.newContext()).newPage();
    await client.goto(await latestLink(CLIENT, Date.now() - 120_000)); // the invite email
  });

  test("sees only their own shared work", async () => {
    await expect(client).toHaveURL(/\/portal$/);
    await expect(client.getByRole("heading", { level: 1, name: "The Warriors Project" })).toBeVisible();
    await expect(client.getByText("Rebatch content starting Mon Oct 5")).toBeVisible();
    await expect(client.getByText("Collect unpaid retainer")).toHaveCount(0); // internal task
    await expect(client.getByText("Masterclass price not set")).toHaveCount(0); // blocker
    await expect(client.getByText("Relevate")).toHaveCount(0);
  });

  test("sees results and invoices", async () => {
    await client.goto("/portal/results");
    await expect(client.locator(".chart-head", { hasText: "Active users" })).toBeVisible();
    await client.goto("/portal/invoices");
    await expect(client.getByRole("heading", { name: /\$444 due/ })).toBeVisible();
  });

  test("can't open staff pages or other clients", async () => {
    await client.goto("/app");
    await expect(client).toHaveURL(/\/portal$/);
    await client.goto("/app/clients/relevate");
    await expect(client).toHaveURL(/\/portal$/);
    const res = await client.request.get("/api/drive/abcdefghijklmnop?client=11111111-0000-4000-8000-000000000001");
    expect(res.status()).toBe(404);
  });

  test("the database refuses a client's direct writes", async () => {
    // Uses the client's own session token against the Supabase API, bypassing the app.
    const cookies = await client.context().cookies();
    const auth = cookies.find((c) => c.name.includes("auth-token"));
    expect(auth).toBeTruthy();
    let raw = decodeURIComponent(cookies.filter((c) => c.name.startsWith(auth!.name.replace(/\.\d+$/, ""))).sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.value).join(""));
    if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64").toString();
    const token = JSON.parse(raw).access_token as string;
    const res = await fetch("http://127.0.0.1:54321/rest/v1/tasks?client_id=eq.11111111-0000-4000-8000-000000000004", {
      method: "PATCH",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ done: true }),
    });
    expect(await res.json()).toEqual([]); // nothing updated
    const read = await fetch("http://127.0.0.1:54321/rest/v1/clients?select=slug", {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
    });
    expect((await read.json()).map((c: { slug: string }) => c.slug)).toEqual(["warriors"]);
  });

  test("loses access as soon as staff removes it", async () => {
    await staff.goto("/app/clients/warriors?tab=access");
    const row = staff.locator(".list-rows > div", { hasText: CLIENT });
    await row.getByRole("button", { name: /Remove access/ }).click();
    await row.getByRole("button", { name: "Remove access", exact: true }).click();
    await expect(staff.getByRole("status")).toContainText("Access removed");
    await client.goto("/portal");
    await expect(client).toHaveURL(/\/login\?error=no-access/);
    const { data } = await admin().from("profiles").select("client_id").eq("email", CLIENT).single();
    expect(data?.client_id).toBeNull();
  });
});
