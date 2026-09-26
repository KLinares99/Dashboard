import { ProspectsManager } from "@/components/Managers";
import { TopBar } from "@/components/Shell";
import { loadProspects } from "@/lib/data";

export const metadata = { title: "Prospects" };

export default async function ProspectsPage() {
  const prospects = await loadProspects();
  return (
    <>
      <TopBar eyebrow="Pipeline" title="Prospects" />
      <main className="view">
        <section className="hero"><h2>Who&apos;s <em>next</em>.</h2><p>Leads and quotes that aren&apos;t clients yet. Only Elevate staff can see this page.</p></section>
        <ProspectsManager prospects={prospects} />
      </main>
    </>
  );
}
