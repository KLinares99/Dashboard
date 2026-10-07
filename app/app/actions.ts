"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertStaff } from "@/lib/auth";
import { ParseError, parseAnalyticsCsv } from "@/lib/analytics/parse";
import { slugify } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const refresh = () => {
  revalidatePath("/app", "layout");
  revalidatePath("/portal", "layout");
};

async function staffDb() {
  const me = await assertStaff();
  return { me, db: await createClient() };
}

const fail = (error: string): ActionResult => ({ ok: false, error });
const uuid = z.string().uuid();
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().or(z.literal("").transform(() => null));
const optText = z.string().trim().max(2000).nullable().optional().transform((v) => (v ? v : null));
const dollars = z.coerce.number().min(0).max(1_000_000).transform((v) => Math.round(v * 100));

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
const TaskInput = z.object({
  client_id: uuid,
  title: z.string().trim().min(1, "Give the task a name.").max(300),
  flag: z.enum(["urgent", "blocked"]).nullable().optional(),
  due_on: optDate.optional(),
  assignee: z.enum(["elevate", "client"]).optional(),
  notes: optText,
});

export async function createTask(input: z.input<typeof TaskInput>): Promise<ActionResult> {
  const parsed = TaskInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { me, db } = await staffDb();
  const { error } = await db.from("tasks").insert({ ...parsed.data, created_by: me.id, position: Date.now() / 1000 });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

const TaskPatch = TaskInput.omit({ client_id: true }).partial().extend({ done: z.boolean().optional() });

export async function updateTask(id: string, patch: z.input<typeof TaskPatch>): Promise<ActionResult> {
  const parsed = TaskPatch.safeParse(patch);
  if (!uuid.safeParse(id).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Unknown task.");
  const { db } = await staffDb();
  const { error, count } = await db.from("tasks").update(parsed.data, { count: "exact" }).eq("id", id);
  if (error) return fail(error.message);
  if (!count) return fail("That task no longer exists.");
  refresh();
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Unknown task.");
  const { db } = await staffDb();
  const { error } = await db.from("tasks").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const ClientInput = z.object({
  name: z.string().trim().min(1, "Add the client's name.").max(120),
  contact_name: optText,
  contact_email: z.string().trim().toLowerCase().email("That contact email doesn't look right.").or(z.literal("")).transform((v) => v || null),
  color: z.enum(["blue", "purple", "orange", "teal", "green", "pink"]),
  type: z.enum(["retainer", "project", "internal"]),
  price: dollars,
  status: z.enum(["urgent", "active", "waiting", "done", "parked"]),
  summary: optText,
  headline: optText,
  next_step: optText,
  services: z.string().optional().transform((v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20)),
  drive_folder_id: z.string().trim().optional().transform((v) => parseDriveFolderId(v ?? "")),
  notion_url: z.string().trim().url("The Notion link should start with https://").or(z.literal("")).optional().transform((v) => v || null),
});

/** Accepts a folder ID or any Drive folder URL. */
function parseDriveFolderId(v: string): string | null {
  if (!v) return null;
  const m = v.match(/folders\/([A-Za-z0-9_-]{10,})/) ?? v.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(v) ? v : null;
}

function readClientForm(fd: FormData) {
  const get = (k: string) => (fd.get(k) as string | null) ?? "";
  return ClientInput.safeParse({
    name: get("name"), contact_name: get("contact_name"), contact_email: get("contact_email"),
    color: get("color") || "blue", type: get("type") || "retainer", price: get("price") || "0",
    status: get("status") || "active", summary: get("summary"), headline: get("headline"),
    next_step: get("next_step"), services: get("services"), drive_folder_id: get("drive_folder_id"),
    notion_url: get("notion_url"),
  });
}

export async function createClientRecord(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = readClientForm(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if ((fd.get("drive_folder_id") as string)?.trim() && !parsed.data.drive_folder_id) return fail("That Google Drive link isn't a folder link.");
  const { db } = await staffDb();
  const { price, ...rest } = parsed.data;
  const base = slugify(rest.name) || "client";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data } = await db.from("clients").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }
  const { error } = await db.from("clients").insert({ ...rest, price_cents: price, slug });
  if (error) return fail(error.message);
  refresh();
  redirect(`/app/clients/${slug}`);
}

export async function updateClientRecord(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = readClientForm(fd);
  if (!uuid.safeParse(id).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Unknown client.");
  if ((fd.get("drive_folder_id") as string)?.trim() && !parsed.data.drive_folder_id) return fail("That Google Drive link isn't a folder link.");
  const { db } = await staffDb();
  const { price, ...rest } = parsed.data;
  const { error } = await db.from("clients").update({ ...rest, price_cents: price }).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Saved." };
}

export async function updateClientQuick(id: string, patch: { status?: string; next_step?: string }): Promise<ActionResult> {
  const parsed = z.object({
    status: z.enum(["urgent", "active", "waiting", "done", "parked"]).optional(),
    next_step: z.string().trim().max(500).optional(),
  }).safeParse(patch);
  if (!uuid.safeParse(id).success || !parsed.success) return fail("Couldn't save that.");
  const { db } = await staffDb();
  const { error } = await db.from("clients").update(parsed.data).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function archiveClient(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Unknown client.");
  const { db } = await staffDb();
  const { error } = await db.from("clients").update({ archived: true }).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  redirect("/app/clients");
}

// ---------------------------------------------------------------------------
// Events (dates)
// ---------------------------------------------------------------------------
const EventInput = z.object({
  client_id: uuid,
  on_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  label: z.string().trim().min(1, "Describe what happens on that date.").max(200),
  visible_to_client: z.boolean().default(true),
});

export async function addEvent(input: z.input<typeof EventInput>): Promise<ActionResult> {
  const parsed = EventInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { db } = await staffDb();
  const { error } = await db.from("events").insert(parsed.data);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function setEventDone(id: string, done: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Unknown date.");
  const { db } = await staffDb();
  const { error } = await db.from("events").update({ done }).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Unknown date.");
  const { db } = await staffDb();
  const { error } = await db.from("events").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
const InvoiceInput = z.object({
  client_id: uuid,
  label: z.string().trim().min(1, "Name the invoice, e.g. October 2026 retainer.").max(200),
  amount: dollars,
  status: z.enum(["draft", "sent", "paid"]),
  issued_on: optDate,
  due_on: optDate,
  pay_url: z.string().trim().url("The payment link should start with https://").startsWith("https://", "The payment link should start with https://").or(z.literal("")).optional().transform((v) => v || null),
});

export async function addInvoice(input: z.input<typeof InvoiceInput>): Promise<ActionResult> {
  const parsed = InvoiceInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (parsed.data.amount <= 0) return fail("Enter an amount above $0.");
  const { db } = await staffDb();
  const { amount, ...rest } = parsed.data;
  const paid_on = rest.status === "paid" ? rest.issued_on ?? new Date().toISOString().slice(0, 10) : null;
  const { error } = await db.from("invoices").insert({ ...rest, amount_cents: amount, paid_on });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function setInvoiceStatus(id: string, status: "draft" | "sent" | "paid" | "void"): Promise<ActionResult> {
  if (!uuid.safeParse(id).success || !["draft", "sent", "paid", "void"].includes(status)) return fail("Unknown invoice.");
  const { db } = await staffDb();
  const today = new Date().toISOString().slice(0, 10);
  const patch = status === "paid" ? { status, paid_on: today } : { status, paid_on: null };
  const { error } = await db.from("invoices").update(patch).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Unknown invoice.");
  const { db } = await staffDb();
  const { error } = await db.from("invoices").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------
export async function addProspect(input: { name: string; detail?: string; note?: string }): Promise<ActionResult> {
  const parsed = z.object({ name: z.string().trim().min(1, "Add a name.").max(120), detail: optText, note: optText }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { db } = await staffDb();
  const { error } = await db.from("prospects").insert({ ...parsed.data, status: "parked" });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deleteProspect(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Unknown prospect.");
  const { db } = await staffDb();
  const { error } = await db.from("prospects").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Client logins
// ---------------------------------------------------------------------------
export async function inviteClientUser(clientId: string, emailRaw: string, name?: string): Promise<ActionResult> {
  const email = z.string().trim().toLowerCase().email().safeParse(emailRaw);
  if (!uuid.safeParse(clientId).success) return fail("Unknown client.");
  if (!email.success) return fail("That email doesn't look right.");
  const { db } = await staffDb();

  const { data: client } = await db.from("clients").select("id, name").eq("id", clientId).single();
  if (!client) return fail("Unknown client.");

  const { data: existing } = await db.from("profiles").select("id, role, client_id").eq("email", email.data).maybeSingle();
  if (existing?.role === "staff") return fail("That email belongs to Elevate staff.");
  if (existing?.client_id && existing.client_id !== clientId) return fail("That email already has access to a different client.");

  const admin = createAdminClient();
  let userId = existing?.id as string | undefined;
  let message = `Invite sent to ${email.data}.`;

  if (!userId) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email.data, {
      data: { full_name: name?.trim() || null },
      redirectTo: `${site}/`,
    });
    if (error || !data.user) return fail(error?.message ?? "Couldn't send the invite.");
    userId = data.user.id;
  } else {
    message = `${email.data} already had a login. They now have access to ${client.name} and can sign in at /login.`;
  }

  // The link to the client is set with the service role, never from user input on the auth side.
  const { error: linkErr } = await admin.from("profiles").update({ client_id: clientId, role: "client" }).eq("id", userId);
  if (linkErr) return fail(linkErr.message);
  refresh();
  return { ok: true, message };
}

export async function revokeClientUser(profileId: string): Promise<ActionResult> {
  if (!uuid.safeParse(profileId).success) return fail("Unknown login.");
  const { db } = await staffDb();
  const { error } = await db.from("profiles").update({ client_id: null }).eq("id", profileId).eq("role", "client");
  if (error) return fail(error.message);
  // Access stops on the next request: every client policy checks profiles.client_id live.
  refresh();
  return { ok: true, message: "Access removed." };
}

// ---------------------------------------------------------------------------
// Analytics uploads
// ---------------------------------------------------------------------------
const MAX_BYTES = 8 * 1024 * 1024;

export async function uploadAnalytics(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const clientId = fd.get("client_id") as string;
  const source = z.enum(["ga4", "meta", "gbp", "generic"]).safeParse(fd.get("source"));
  const file = fd.get("file");
  if (!uuid.safeParse(clientId).success) return fail("Unknown client.");
  if (!source.success) return fail("Pick where the file came from.");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a CSV file to upload.");
  if (file.size > MAX_BYTES) return fail("That file is over 8 MB. Export a shorter date range.");
  if (!/\.(csv|txt)$/i.test(file.name)) return fail("Upload a .csv file. In GA4 or Meta, choose Export → CSV.");

  const text = await file.text();
  let result;
  try {
    result = parseAnalyticsCsv(text);
  } catch (e) {
    return fail(e instanceof ParseError ? e.message : "Couldn't read that file.");
  }

  const { me, db } = await staffDb();
  const uploadId = crypto.randomUUID();
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120);
  const path = `${clientId}/${uploadId}/${safeName}`;

  const { error: upErr } = await db.storage.from("analytics").upload(path, file, { contentType: "text/csv", upsert: false });
  if (upErr) return fail(`Couldn't store the file: ${upErr.message}`);

  const { error: rowErr } = await db.from("analytics_uploads").insert({
    id: uploadId, client_id: clientId, source: source.data, filename: file.name, storage_path: path,
    row_count: result.points.length, date_from: result.dateFrom, date_to: result.dateTo, uploaded_by: me.id,
  });
  if (rowErr) {
    await db.storage.from("analytics").remove([path]);
    return fail(rowErr.message);
  }

  const rows = result.points.map((p) => ({
    client_id: clientId, upload_id: uploadId, source: source.data, metric: p.metric, on_date: p.date, value: p.value,
  }));
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await db.from("metrics").upsert(rows.slice(i, i + 1000), { onConflict: "client_id,source,metric,on_date" });
    if (error) {
      await db.from("analytics_uploads").delete().eq("id", uploadId);
      await db.storage.from("analytics").remove([path]);
      return fail(`Couldn't save the numbers: ${error.message}`);
    }
  }

  refresh();
  const skipped = result.skippedRows ? ` Skipped ${result.skippedRows} row${result.skippedRows === 1 ? "" : "s"} without a date (totals or blanks).` : "";
  return {
    ok: true,
    message: `Imported ${result.metrics.length} metric${result.metrics.length === 1 ? "" : "s"} (${result.metrics.join(", ")}) from ${result.dateFrom} to ${result.dateTo}.${skipped}`,
  };
}

export async function deleteUpload(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Unknown upload.");
  const { db } = await staffDb();
  const { data: up } = await db.from("analytics_uploads").select("storage_path").eq("id", id).single();
  // metrics rows cascade with the upload
  const { error } = await db.from("analytics_uploads").delete().eq("id", id);
  if (error) return fail(error.message);
  if (up?.storage_path) await db.storage.from("analytics").remove([up.storage_path]);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colors are hex codes like #14213d.");
const DecisionInput = z.object({
  label: z.string().trim().min(1, "Every decision needs a name.").max(120),
  tag: z.string().trim().max(40).optional().transform((v) => v || null),
  detail: z.string().trim().max(2000).optional().transform((v) => v || null),
  kind: z.enum(["approve", "choice", "text", "date"]),
  options: z.array(z.object({
    label: z.string().trim().min(1).max(120),
    detail: z.string().trim().max(600).optional(),
    recommended: z.boolean().optional(),
  })).max(8).default([]),
});
const ApprovalInput = z.object({
  client_id: uuid,
  eyebrow: optText,
  title: z.string().trim().min(1, "Give the approval a title.").max(80),
  subtitle: optText,
  summary: optText,
  card_color: hex.default("#14213d"),
  accent_color: hex.default("#c9a04a"),
  decisions: z.array(DecisionInput).min(1, "Add at least one decision.").max(30),
});

export async function createApproval(input: z.input<typeof ApprovalInput>): Promise<ActionResult & { id?: string }> {
  const parsed = ApprovalInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const bad = parsed.data.decisions.find((d) => d.kind === "choice" && d.options.length < 2);
  if (bad) return fail(`"${bad.label}" is a choice, so it needs at least two options.`);
  const { db } = await staffDb();
  const { decisions, ...head } = parsed.data;
  const { data: a, error } = await db.from("approvals").insert(head).select("id").single();
  if (error || !a) return fail(error?.message ?? "Couldn't create the approval.");
  const { error: itemErr } = await db.from("approval_items").insert(
    decisions.map((d, i) => ({ ...d, options: d.kind === "choice" ? d.options : [], approval_id: a.id, position: i + 1 })),
  );
  if (itemErr) {
    await db.from("approvals").delete().eq("id", a.id);
    return fail(itemErr.message);
  }
  refresh();
  return { ok: true, id: a.id, message: "Approval created. It's now on the client's home page." };
}

/** Records a PDF the browser already uploaded to documents/<client>/<approval>/<file>. */
export async function setApprovalPdf(approvalId: string, path: string | null, name: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(approvalId).success) return fail("Unknown approval.");
  const { db } = await staffDb();
  const { data: a } = await db.from("approvals").select("client_id, pdf_path").eq("id", approvalId).single();
  if (!a) return fail("Unknown approval.");
  if (path && !path.startsWith(`${a.client_id}/${approvalId}/`)) return fail("That file isn't in this approval's folder.");
  if (a.pdf_path && a.pdf_path !== path) await db.storage.from("documents").remove([a.pdf_path]);
  const { error } = await db.from("approvals").update({ pdf_path: path, pdf_name: name?.slice(0, 200) ?? null }).eq("id", approvalId);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: path ? "PDF attached." : "PDF removed." };
}

export async function reopenApproval(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Unknown approval.");
  const { db } = await staffDb();
  const { error } = await db.from("approvals").update({ status: "open", signed_name: null, signed_at: null, signed_by: null }).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Reopened. The client can change answers and sign again." };
}

export async function deleteApproval(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Unknown approval.");
  const { db } = await staffDb();
  const { data: a } = await db.from("approvals").select("pdf_path").eq("id", id).single();
  const { error } = await db.from("approvals").delete().eq("id", id);
  if (error) return fail(error.message);
  if (a?.pdf_path) await db.storage.from("documents").remove([a.pdf_path]);
  refresh();
  return { ok: true };
}
