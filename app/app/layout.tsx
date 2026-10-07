import { Shell } from "@/components/Shell";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const db = await createClient();
  const [{ count: urgent }, { data: unpaid }, { count: clientCount }] = await Promise.all([
    db.from("tasks").select("id, clients!inner(archived)", { count: "exact", head: true }).eq("done", false).eq("flag", "urgent").eq("clients.archived", false),
    db.from("invoices").select("amount_cents, paid_cents, clients!inner(archived)").eq("status", "sent").eq("clients.archived", false),
    db.from("clients").select("id", { count: "exact", head: true }).eq("archived", false).neq("type", "internal"),
  ]);
  const owed = (unpaid ?? []).reduce((a, i) => a + i.amount_cents - i.paid_cents, 0);
  return (
    <Shell footLabel="ELEVATE STAFF" who={me.email} nav={[
      { href: "/app", label: "Pulse", icon: "pulse" },
      { href: "/app/clients", label: "Clients", icon: "clients", badge: clientCount ? { text: String(clientCount) } : undefined },
      { href: "/app/tasks", label: "Tasks", icon: "tasks", badge: urgent ? { text: String(urgent), tone: "red" } : undefined },
      { href: "/app/schedule", label: "Schedule", icon: "schedule" },
      { href: "/app/billing", label: "Billing", icon: "billing", badge: owed ? { text: "$", tone: "red" } : undefined },
      { href: "/app/prospects", label: "Prospects", icon: "prospects" },
    ]}>
      {children}
    </Shell>
  );
}
