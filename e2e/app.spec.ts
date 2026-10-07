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
    for (const name of ["Relevate Solutions", "NYTI", "The Warriors Project"]) {
      await expect(staff.locator(".client-row", { hasText: name })).toBeVisible();
    }
    // Same numbers as Rob's portal: $244 left on September + $444 October
    await expect(staff.locator(".tile", { hasText: "Owed to you" })).toContainText("$688");
    await expect(staff.locator(".client-row", { hasText: "The Warriors Project" })).toContainText("$688 owed");
    await expect(staff.locator(".panel", { hasText: "Recent payments" })).toContainText("$644");
    await expect(staff.locator(".tile", { hasText: "Waiting on approval" })).toContainText("Forged");
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
    await editor.getByLabel("Who").selectOption("elevate");
    await editor.getByRole("button", { name: "Save" }).click();
    const edited = staff.locator(".task", { hasText: "E2E: final October carousel" });
    await expect(edited.locator(".pill", { hasText: "urgent" })).toBeVisible();

    await edited.getByRole("checkbox").check();
    await expect(staff.locator('ul.task-list[aria-busy="true"]')).toHaveCount(0);
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

  test("shows a part-paid invoice and records a payment oldest-first", async () => {
    await staff.goto("/app/clients/warriors?tab=billing");
    const sep = staff.locator("tr", { hasText: "September 2026 retainer" });
    await expect(sep.locator(".pill")).toHaveText("Part paid");
    await expect(sep).toContainText("$200.00 paid · $244.00 left");
    await expect(staff.locator("tr", { hasText: "QuickBooks #1094" })).toContainText("$644");
    // Too much is refused
    await staff.getByLabel("Amount received ($)").fill("1000");
    await staff.getByRole("button", { name: "Record payment" }).click();
    await expect(staff.locator(".notice.err")).toContainText("more than the $688.00 they owe");
    // $244 clears September
    await staff.getByLabel("Amount received ($)").fill("244");
    await staff.getByLabel("Reference (optional)").fill("Check 1001");
    await staff.getByRole("button", { name: "Record payment" }).click();
    await expect(staff.getByRole("status")).toContainText("September 2026 retainer paid in full");
    await expect(sep.locator(".pill")).toHaveText("Paid");
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

  test("attaches a PDF to the Forged approval", async () => {
    await staff.goto("/app/clients/warriors?tab=approvals");
    const panel = staff.locator("section.panel", { hasText: "Forged" }).first();
    await expect(panel.getByText("0 of 8 answered")).toBeVisible();
    await panel.locator('input[type="file"]').setInputFiles({ name: "Forged - Course Approval.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") });
    await expect(panel.getByRole("status")).toContainText("PDF attached");
    await expect(panel.getByText("Forged - Course Approval.pdf")).toBeVisible();
  });

  test("invites the Warriors contact", async () => {
    await staff.goto("/app/clients/warriors?tab=access");
    await staff.getByLabel("Email").fill(CLIENT);
    await staff.getByRole("button", { name: "Send portal invite" }).click();
    await expect(staff.getByRole("status")).toContainText(`Invite sent to ${CLIENT}`);
    await expect(staff.locator(".list-rows", { hasText: CLIENT })).toBeVisible();
  });
});

test("staff adds a to-do for the client", async () => {
  await staff.goto("/app/clients/warriors?tab=tasks");
  const theirs = staff.locator("section.panel", { hasText: "Client to-dos" });
  const input = theirs.getByPlaceholder("Add something the client needs to do");
  await input.fill("E2E: approve October posts");
  await input.press("Enter");
  await expect(theirs.locator(".task", { hasText: "E2E: approve October posts" }).getByRole("button", { name: "Edit task" })).toBeVisible();
  // It is not in Elevate's own list
  await expect(staff.locator("section.panel", { hasText: "Our tasks" }).getByText("E2E: approve October posts")).toHaveCount(0);
});

test.describe("client", () => {
  let client: Page;
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    client = await (await browser.newContext()).newPage();
    await client.goto(await latestLink(CLIENT, Date.now() - 120_000)); // the invite email
  });

  test("sees one simple page: invoice, their to-dos, content", async () => {
    await expect(client).toHaveURL(/\/portal$/);
    await expect(client.getByRole("heading", { level: 1, name: /Good (morning|afternoon|evening)/ })).toBeVisible();
    await expect(client.getByText(/The Warriors Project ·/)).toBeVisible();
    // Invoice due (Aug and Sep are paid after the payments above)
    const invoice = client.locator(".ios-invoice");
    await expect(invoice).toHaveCount(1);
    await expect(invoice).toContainText("October 2026 retainer");
    await expect(invoice).toContainText("$444");
    // Their own action items only
    await expect(client.getByText("Set the masterclass price")).toBeVisible();
    await expect(client.getByText("E2E: approve October posts")).toBeVisible();
    await expect(client.getByText("Rebatch content starting Mon Oct 5")).toHaveCount(0); // Elevate's task
    await expect(client.getByText("Collect unpaid retainer")).toHaveCount(0);
    await expect(client.getByText("Send staff photos")).toHaveCount(0); // another client's
    // Content placeholder until Drive is linked
    await expect(client.getByText("Coming soon")).toBeVisible();
  });

  test("ticks off a to-do, and staff see it done", async () => {
    await client.getByLabel("E2E: approve October posts").check();
    await expect(client.getByLabel("E2E: approve October posts")).toBeChecked();
    await expect(client.locator(".ios-todo.done", { hasText: "E2E: approve October posts" })).toBeVisible();
    await expect.poll(async () => (await admin().from("tasks").select("done").eq("title", "E2E: approve October posts").single()).data?.done).toBe(true);
    await client.reload();
    await expect(client.getByRole("button", { name: "Show 1 completed" })).toBeVisible();
    await staff.goto("/app/clients/warriors?tab=tasks");
    await expect(staff.locator(".task.done", { hasText: "E2E: approve October posts" })).toBeVisible();
  });

  test("opens the Forged card, answers every decision and signs", async () => {
    await client.goto("/portal");
    const card = client.getByRole("link", { name: /Forged: needs your approval/ });
    await expect(card).toContainText("Needs your approval · 8 decisions");
    await card.click();
    await expect(client.getByRole("heading", { level: 1, name: "Forged" })).toBeVisible();
    await expect(client.getByRole("link", { name: "Download the full PDF" })).toHaveAttribute("href", /documents/);
    const sign = client.getByRole("button", { name: "Approve and sign" });
    await expect(sign).toBeDisabled();

    const decision = (name: string) => client.getByRole("article", { name });
    await decision("Course name").getByRole("radio", { name: /^Forged/ }).click();
    await expect(decision("Course name").getByText("Answered")).toBeVisible();
    await decision("Price").getByLabel("Price").fill("Monthly, $29 public, founding members free");
    await decision("Price").getByRole("button", { name: "Save" }).click();
    await decision("Access for the 14").getByRole("button", { name: "Approve" }).click();
    await decision("Pace").getByRole("radio", { name: /One module a week/ }).click();
    await decision("Phases").getByRole("button", { name: "Request a change" }).click();
    await decision("Phases").getByLabel("What should change?").fill("Call Phase III \"The Battle\"");
    await decision("Phases").getByRole("button", { name: "Send change request" }).click();
    await decision("Recording load").getByRole("radio", { name: /Lean/ }).click();
    await decision("Weekly call").getByRole("radio", { name: /Thursday/ }).click();
    await decision("Launch date").getByLabel("Launch date").fill("2026-11-12");
    await decision("Launch date").getByRole("button", { name: "Save" }).click();
    await expect(client.getByText("8 of 8")).toBeVisible();

    await client.getByLabel("Full name").fill("Rev. Robert Lindenberg");
    await sign.click();
    await expect(client.getByText("Approved by Rev. Robert Lindenberg")).toBeVisible();

    await client.goto("/portal");
    await expect(client.getByRole("link", { name: /Forged: approved/ })).toBeVisible();
  });

  test("staff see Rob's answers", async () => {
    await staff.goto("/app/clients/warriors?tab=approvals");
    const panel = staff.locator("section.panel", { hasText: "Forged" }).first();
    await expect(panel.getByText("Signed by Rev. Robert Lindenberg")).toBeVisible();
    await expect(panel.locator("tr", { hasText: "Course name" })).toContainText("Forged (recommended)");
    await expect(panel.locator("tr", { hasText: "Phases" })).toContainText('Change requested: Call Phase III "The Battle"');
    await expect(panel.locator("tr", { hasText: "Launch date" })).toContainText("November 12, 2026");
    await expect(panel.locator("tr", { hasText: "Recording load" })).toContainText("Lean");
  });

  test("sees all invoices", async () => {
    await client.goto("/portal");
    await client.getByRole("link", { name: "See all" }).click();
    await expect(client.getByRole("heading", { level: 1, name: "Invoices" })).toBeVisible();
    await expect(client.locator(".ios-row", { hasText: "August 2026 retainer" })).toContainText("Paid");
    await expect(client.locator(".ios-row", { hasText: "QuickBooks #1094" })).toContainText("$644");
    await expect(client.getByText("NYTI enrollment campaign")).toHaveCount(0); // another client's invoice
  });

  test("sees this month's posts from Drive, filtered by type", async () => {
    // e2e/fake-drive.mjs serves Rob's real layout: October Statics / Reels / Carousels, one folder per carousel
    const db = admin();
    await db.from("clients").update({ drive_folder_id: "fake0001xxxxxxxxxxxx" }).eq("slug", "warriors");
    try {
      await client.goto("/portal");
      const grid = client.locator(".post-grid");
      await expect(grid.locator(".post-tile")).toHaveCount(12);
      await client.getByRole("link", { name: /^Carousels/ }).click();
      await expect(grid.locator(".post-tile")).toHaveCount(5);
      await grid.locator(".post-tile", { hasText: "What You Won't Say Out Loud" }).click();
      await expect(client.getByRole("heading", { level: 1, name: "What You Won't Say Out Loud" })).toBeVisible();
      await expect(client.locator(".post-slides img")).toHaveCount(7);
      await expect(client.locator(".post-caption")).toContainText("You don't have to carry it alone");
      await client.getByRole("link", { name: "‹ Back" }).click();
      await client.getByRole("link", { name: /^Reels/ }).click();
      await expect(grid.locator(".post-tile")).toHaveCount(2);
      await grid.locator(".post-tile").first().click();
      await expect(client.locator(".post-video video")).toHaveAttribute("poster", /thumb=1/);
      await client.goto("/portal");
      await client.getByRole("link", { name: /September 2026/ }).click();
      await expect(grid.locator(".post-tile")).toHaveCount(1);
    } finally {
      await db.from("clients").update({ drive_folder_id: null }).eq("slug", "warriors");
    }
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
