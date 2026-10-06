import { AllInvoices, ClientHome } from "@/components/Portal";
import { FolderView } from "@/components/portal/Content";
import { requireClientUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { portalBundle } from "./data";

export const metadata = { title: "Home" };

/** The client's single page. ?folder= opens an earlier month, ?view=invoices lists all invoices. */
export default async function PortalHome({ searchParams }: { searchParams: Promise<{ folder?: string; view?: string }> }) {
  const [sp, me, bundle] = await Promise.all([searchParams, requireClientUser(), portalBundle()]);
  if (sp.view === "invoices") return <AllInvoices bundle={bundle} back="/portal" />;
  if (sp.folder) return <main className="ios-page"><FolderView client={bundle.client} folderId={sp.folder} back="/portal" /></main>;
  const firstName = me.full_name?.trim().split(/\s+/)[0] ?? null;
  return <ClientHome bundle={bundle} today={todayISO()} firstName={firstName} base="/portal" interactive />;
}
