import { PortalResults } from "@/components/Portal";
import { TopBar } from "@/components/Shell";
import { portalBundle } from "../data";

export const metadata = { title: "Results" };

export default async function PortalResultsPage() {
  const bundle = await portalBundle();
  return (
    <>
      <TopBar eyebrow="Client portal" title="Results" />
      <main className="view"><PortalResults bundle={bundle} /></main>
    </>
  );
}
