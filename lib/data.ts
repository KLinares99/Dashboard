import "server-only";
import { createClient } from "@/lib/supabase/server";
import { owedOn } from "@/lib/types";
import type { AnalyticsUpload, Approval, ApprovalItem, Client, EventItem, Invoice, Metric, Payment, Prospect, SocialPost, Task } from "@/lib/types";

/** Everything the staff views need. RLS still applies (staff see all). */
export async function loadWorkspace() {
  const supabase = await createClient();
  const [clients, tasks, events, invoices, payments, approvals] = await Promise.all([
    supabase.from("clients").select("*").eq("archived", false).order("created_at"),
    supabase.from("tasks").select("*").order("position"),
    supabase.from("events").select("*").order("on_date"),
    supabase.from("invoices").select("*").order("issued_on", { ascending: true, nullsFirst: false }),
    supabase.from("payments").select("*").order("paid_on", { ascending: false }).limit(50),
    supabase.from("approvals").select("*").order("created_at", { ascending: false }),
  ]);
  for (const r of [clients, tasks, events, invoices, payments, approvals]) if (r.error) throw new Error(r.error.message);
  const activeIds = new Set((clients.data as Client[]).map((c) => c.id));
  return {
    clients: clients.data as Client[],
    tasks: (tasks.data as Task[]).filter((t) => activeIds.has(t.client_id)),
    events: (events.data as EventItem[]).filter((e) => activeIds.has(e.client_id)),
    invoices: (invoices.data as Invoice[]).filter((i) => activeIds.has(i.client_id)),
    payments: (payments.data as Payment[]).filter((p) => activeIds.has(p.client_id)),
    approvals: (approvals.data as Approval[]).filter((a) => activeIds.has(a.client_id)),
  };
}
export type Workspace = Awaited<ReturnType<typeof loadWorkspace>>;

/** One client with everything attached. A client login only gets its own action items and sent invoices (RLS). */
export async function loadClient(by: { slug?: string; id?: string }) {
  const supabase = await createClient();
  let q = supabase.from("clients").select("*");
  q = by.slug ? q.eq("slug", by.slug) : q.eq("id", by.id!);
  const { data: client } = await q.maybeSingle();
  if (!client) return null;
  const c = client as Client;
  const [tasks, events, invoices, uploads, metrics, approvals, payments, posts] = await Promise.all([
    supabase.from("tasks").select("*").eq("client_id", c.id).order("done").order("position"),
    supabase.from("events").select("*").eq("client_id", c.id).order("on_date"),
    supabase.from("invoices").select("*").eq("client_id", c.id).order("issued_on", { ascending: false, nullsFirst: true }),
    supabase.from("analytics_uploads").select("*").eq("client_id", c.id).order("created_at", { ascending: false }),
    supabase.from("metrics").select("metric, on_date, value, source").eq("client_id", c.id).order("on_date").limit(20000),
    supabase.from("approvals").select("*").eq("client_id", c.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("client_id", c.id).order("paid_on", { ascending: false }),
    supabase.from("social_posts").select("*").eq("client_id", c.id).order("published_on", { ascending: false }).limit(2000),
  ]);
  const approvalIds = (approvals.data ?? []).map((a: { id: string }) => a.id);
  const approvalItems = approvalIds.length
    ? await supabase.from("approval_items").select("*").in("approval_id", approvalIds).order("position")
    : { data: [] };
  return {
    client: c,
    tasks: (tasks.data ?? []) as Task[],
    events: (events.data ?? []) as EventItem[],
    invoices: (invoices.data ?? []) as Invoice[],
    uploads: (uploads.data ?? []) as AnalyticsUpload[],
    metrics: (metrics.data ?? []) as Metric[],
    approvals: (approvals.data ?? []) as Approval[],
    approvalItems: (approvalItems.data ?? []) as ApprovalItem[],
    payments: (payments.data ?? []) as Payment[],
    posts: (posts.data ?? []) as SocialPost[],
  };
}
export type ClientBundle = NonNullable<Awaited<ReturnType<typeof loadClient>>>;

export async function loadProspects() {
  const supabase = await createClient();
  const { data } = await supabase.from("prospects").select("*").order("created_at");
  return (data ?? []) as Prospect[];
}

export async function loadClientLogins(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, email, full_name, created_at").eq("client_id", clientId).order("created_at");
  return (data ?? []) as { id: string; email: string; full_name: string | null; created_at: string }[];
}

// ---------- Derived numbers ----------
export const unpaidCents = (invoices: Invoice[], clientId?: string) =>
  invoices.filter((i) => !clientId || i.client_id === clientId).reduce((a, i) => a + owedOn(i), 0);

export function progress(tasks: Task[]) {
  const done = tasks.filter((t) => t.done).length;
  return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}
