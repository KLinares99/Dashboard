import Link from "next/link";
import { notFound } from "next/navigation";
import { DriveSection } from "@/components/DriveSection";
import { PortalInvoices, PortalOverview, PortalResults } from "@/components/Portal";
import { TopBar } from "@/components/Shell";
import { loadClient } from "@/lib/data";
import { todayISO } from "@/lib/format";

const TABS = [["overview", "Overview"], ["content", "Content"], ["results", "Results"], ["invoices", "Invoices"]] as const;

export const metadata = { title: "Client preview" };

export default async function PreviewPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string; folder?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const bundle = await loadClient({ slug });
  if (!bundle) notFound();
  const tab = TABS.find(([k]) => k === sp.tab)?.[0] ?? "overview";
  const base = `/app/clients/${slug}/preview`;
  return (
    <>
      <TopBar eyebrow="Previewing client portal" title={bundle.client.name} actions={<Link className="btn" href={`/app/clients/${slug}`}>Back to staff view</Link>}>
        <div className="notice info" style={{ fontSize: 14 }}>This is exactly what {bundle.client.name} sees when they sign in. Internal tasks, blockers and draft invoices are left out.</div>
        <nav className="tabs" aria-label="Portal sections">
          {TABS.map(([k, l]) => <Link key={k} href={k === "overview" ? base : `${base}?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>)}
        </nav>
      </TopBar>
      <main className="view">
        {tab === "overview" && <PortalOverview bundle={bundle} today={todayISO()} />}
        {tab === "content" && (
          <>
            <section className="hero"><h2>Your <em>content</em>.</h2><p>Posts, reels and graphics we&apos;ve made for you. Tap any item to open it.</p></section>
            <DriveSection client={bundle.client} folder={sp.folder} base={`${base}?tab=content`} staff={false} />
          </>
        )}
        {tab === "results" && <PortalResults bundle={bundle} />}
        {tab === "invoices" && <PortalInvoices bundle={bundle} />}
      </main>
    </>
  );
}
