import { PortalOverview } from "@/components/Portal";
import { TopBar } from "@/components/Shell";
import { todayISO } from "@/lib/format";
import { portalBundle } from "./data";

export const metadata = { title: "Overview" };

export default async function PortalHome() {
  const bundle = await portalBundle();
  return (
    <>
      <TopBar eyebrow="Client portal" title={bundle.client.name} />
      <main className="view"><PortalOverview bundle={bundle} today={todayISO()} /></main>
    </>
  );
}
