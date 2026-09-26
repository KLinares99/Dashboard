import { Shell } from "@/components/Shell";
import { requireClientUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireClientUser();
  const db = await createClient();
  const { data: unpaid } = await db.from("invoices").select("amount_cents").eq("status", "sent");
  const owes = (unpaid ?? []).length > 0;
  return (
    <Shell footLabel="CLIENT PORTAL" who={me.email} nav={[
      { href: "/portal", label: "Overview", icon: "home" },
      { href: "/portal/content", label: "Content", icon: "content" },
      { href: "/portal/results", label: "Results", icon: "chart" },
      { href: "/portal/invoices", label: "Invoices", icon: "billing", badge: owes ? { text: "$", tone: "red" } : undefined },
    ]}>
      {children}
    </Shell>
  );
}
