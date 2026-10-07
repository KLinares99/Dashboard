import Link from "next/link";
import { notFound } from "next/navigation";
import { AllInvoices, ClientHome, PortalBar } from "@/components/Portal";
import { ApprovalView } from "@/components/portal/Approval";
import { FolderView } from "@/components/portal/Content";
import { loadClient } from "@/lib/data";
import { todayISO } from "@/lib/format";
import "@/app/portal/portal.css";

export const metadata = { title: "Client preview" };

/** Staff see exactly the client's page, with a banner. To-dos can't be ticked here. */
export default async function PreviewPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ folder?: string; view?: string; approval?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const bundle = await loadClient({ slug });
  if (!bundle) notFound();
  const base = `/app/clients/${slug}/preview`;
  const firstName = bundle.client.contact_name?.trim().split(/\s+/)[0] ?? null;
  return (
    <div className="ios" style={{ minHeight: "100vh" }}>
      <div className="ios-preview">
        Previewing {bundle.client.name}&apos;s portal. <Link href={`/app/clients/${slug}`}>Back to staff view</Link>
      </div>
      <PortalBar signOut={false} />
      {sp.approval && bundle.approvals.some((a) => a.id === sp.approval) ? (
        <ApprovalView approval={bundle.approvals.find((a) => a.id === sp.approval)!} items={bundle.approvalItems.filter((i) => i.approval_id === sp.approval)} back={base} interactive={false} />
      ) : sp.view === "invoices" ? <AllInvoices bundle={bundle} back={base} />
        : sp.folder ? <main className="ios-page"><FolderView client={bundle.client} folderId={sp.folder} back={base} /></main>
        : <ClientHome bundle={bundle} today={todayISO()} firstName={firstName} base={base} interactive={false} />}
    </div>
  );
}
