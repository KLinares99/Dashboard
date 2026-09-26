import { PortalInvoices } from "@/components/Portal";
import { TopBar } from "@/components/Shell";
import { portalBundle } from "../data";

export const metadata = { title: "Invoices" };

export default async function PortalInvoicesPage() {
  const bundle = await portalBundle();
  return (
    <>
      <TopBar eyebrow="Client portal" title="Invoices" />
      <main className="view"><PortalInvoices bundle={bundle} /></main>
    </>
  );
}
