import Link from "next/link";
import { notFound } from "next/navigation";
import { DriveSection } from "@/components/DriveSection";
import { Icon } from "@/components/Icon";
import {
  AddEventForm, AddInvoiceForm, ArchiveClient, BlockerList, ClientAccess, ClientForm, EventRows, InvoiceRows, QuickStatus, UploadAnalytics,
} from "@/components/Managers";
import { MetricsView } from "@/components/MetricsView";
import { Headline } from "@/components/Portal";
import { TopBar } from "@/components/Shell";
import { TaskList } from "@/components/TaskList";
import { loadClient, loadClientLogins, loadWorkspace, progress, unpaidCents } from "@/lib/data";
import { STATUS_LABEL, TYPE_LABEL, money, priceLabel, todayISO } from "@/lib/format";

const TABS = [
  ["overview", "Overview"], ["tasks", "Tasks"], ["content", "Content"], ["analytics", "Analytics"],
  ["billing", "Billing"], ["access", "Portal access"], ["settings", "Settings"],
] as const;
type Tab = (typeof TABS)[number][0];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await loadClient({ slug });
  return { title: b?.client.name ?? "Client" };
}

export default async function ClientPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string; folder?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const tab: Tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? "overview") as Tab;
  const [bundle, ws] = await Promise.all([loadClient({ slug }), loadWorkspace()]);
  if (!bundle) notFound();
  const { client: c, tasks, events, invoices, blockers, uploads, metrics } = bundle;
  const today = todayISO();
  const p = progress(tasks);
  const owed = unpaidCents(invoices);
  const flagged = tasks.filter((t) => !t.done && (t.flag || (t.due_on && t.due_on < today)));
  const logins = tab === "access" ? await loadClientLogins(c.id) : [];
  const base = `/app/clients/${c.slug}`;

  return (
    <>
      <TopBar eyebrow="Client" title={c.name} actions={<Link className="btn" href={`${base}/preview`}><Icon name="eye" size={18} /><span>Preview as client</span></Link>}>
        <nav className="chips" aria-label="Switch client">
          {ws.clients.map((x) => (
            <Link key={x.id} href={`/app/clients/${x.slug}${tab !== "overview" ? `?tab=${tab}` : ""}`} className="chip" aria-current={x.id === c.id ? "page" : undefined}>
              <b><i className="dot" style={{ "--c": `var(--c-${x.color})` } as React.CSSProperties} />{x.name}</b>
              <span>{TYPE_LABEL[x.type]} · {STATUS_LABEL[x.status]}</span>
            </Link>
          ))}
        </nav>
        <nav className="tabs" aria-label="Client sections">
          {TABS.map(([k, l]) => <Link key={k} href={k === "overview" ? base : `${base}?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>)}
        </nav>
      </TopBar>

      <main className="view" style={{ "--c": `var(--c-${c.color})` } as React.CSSProperties}>
        {tab === "overview" && (
          <>
            <section className="hero">
              {c.summary && <div className="meta">{c.summary}</div>}
              <h2><Headline text={c.headline || `*${c.name}*`} /></h2>
              <p>{TYPE_LABEL[c.type]} · <b>{priceLabel(c)}</b>{c.contact_name ? ` · ${c.contact_name}` : ""}</p>
            </section>
            <section className="tiles">
              <div className="tile"><span className="label">Status</span><span className="v" style={{ fontSize: 24, paddingTop: 8 }}><span className={`pill p-${c.status}`} style={{ fontSize: 14 }}>{STATUS_LABEL[c.status]}</span></span><span className="d">{c.services.slice(0, 2).join(" · ") || " "}</span></div>
              <div className="tile"><span className="label">Progress</span><span className="v">{p.done}/{p.total}</span><span className="d">{p.pct}% of tasks done</span></div>
              <div className={`tile ${flagged.length ? "alert" : "good"}`}><span className="label">Needs you</span><span className="v">{flagged.length}</span><span className="d">{flagged.length ? "urgent, blocked or overdue" : "Nothing flagged"}</span></div>
              <Link href={`${base}?tab=billing`} className={`tile ${owed ? "alert" : ""}`} style={{ textDecoration: "none" }}><span className="label">{owed ? "Owes" : "Balance"}</span><span className="v">{money(owed)}</span><span className="d">{owed ? `${invoices.filter((i) => i.status === "sent").length} unpaid invoice(s)` : "Paid up"}</span></Link>
            </section>
            <div className="cols">
              <div className="stack">
                <QuickStatus client={c} />
                <section className="panel">
                  <div className="panel-h"><span className="label">Tasks</span><span className="num muted" style={{ fontSize: 14 }}>{p.done}/{p.total}</span></div>
                  <div className="panel-b tight"><TaskList clientId={c.id} tasks={tasks} editable today={today} /></div>
                </section>
              </div>
              <div className="stack">
                <section className="panel">
                  <div className="panel-h"><span className="label">Waiting on client</span><span className="pill p-hidden">Internal</span></div>
                  <div className="panel-b"><BlockerList clientId={c.id} blockers={blockers} /></div>
                </section>
                <section className="panel">
                  <div className="panel-h"><span className="label">Dates</span></div>
                  {events.length ? <EventRows events={events} clients={[c]} today={today} editable /> : <div className="panel-b empty">No dates yet.</div>}
                  <details className="drawer"><summary>+ Add a date</summary><div className="panel-b"><AddEventForm clients={[c]} fixedClientId={c.id} /></div></details>
                </section>
                {c.notion_url && <a className="btn" href={c.notion_url} target="_blank" rel="noopener">Open in Notion <Icon name="arrow" size={16} /></a>}
              </div>
            </div>
          </>
        )}

        {tab === "tasks" && (
          <section className="panel">
            <div className="panel-h"><span className="label">All tasks</span><span className="muted" style={{ fontSize: 14 }}>Double-click a task to edit. The eye shows whether the client can see it.</span></div>
            <div className="panel-b tight"><TaskList clientId={c.id} tasks={tasks} editable today={today} /></div>
          </section>
        )}

        {tab === "content" && (
          <section className="panel">
            <div className="panel-h"><span className="label">Content from Google Drive</span>{c.drive_folder_id && <a className="seg" href={`https://drive.google.com/drive/folders/${c.drive_folder_id}`} target="_blank" rel="noopener">Open folder in Drive</a>}</div>
            <div className="panel-b"><DriveSection client={c} folder={sp.folder} base={`${base}?tab=content`} staff /></div>
          </section>
        )}

        {tab === "analytics" && (
          <>
            <MetricsView metrics={metrics} emptyText="No analytics yet. Upload a CSV export below to create charts." />
            <section className="panel">
              <div className="panel-h"><span className="label">Upload analytics</span></div>
              <div className="panel-b"><UploadAnalytics clientId={c.id} uploads={uploads} /></div>
            </section>
          </>
        )}

        {tab === "billing" && (
          <>
            <section className="tiles" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div className="tile"><span className="label">Plan</span><span className="v">{priceLabel(c)}</span><span className="d">{TYPE_LABEL[c.type]}</span></div>
              <div className={`tile ${owed ? "alert" : "good"}`}><span className="label">Unpaid</span><span className="v">{money(owed)}</span><span className="d">{owed ? "Sent, not paid" : "All clear"}</span></div>
              <div className="tile"><span className="label">Paid to date</span><span className="v">{money(invoices.filter((i) => i.status === "paid").reduce((a, i) => a + i.amount_cents, 0))}</span><span className="d">{invoices.filter((i) => i.status === "paid").length} invoice(s)</span></div>
            </section>
            <section className="panel">
              <div className="panel-h"><span className="label">Invoices</span><span className="muted" style={{ fontSize: 14 }}>Drafts stay hidden from the client.</span></div>
              <InvoiceRows invoices={invoices} clients={[c]} editable showClient={false} />
              <details className="drawer"><summary>+ Add an invoice</summary><div className="panel-b"><AddInvoiceForm clients={[c]} fixedClientId={c.id} defaultAmount={c.type === "retainer" ? c.price_cents : undefined} /></div></details>
            </section>
          </>
        )}

        {tab === "access" && (
          <section className="panel">
            <div className="panel-h"><span className="label">Who can sign in to {c.name}&apos;s portal</span><Link className="seg" href={`${base}/preview`}>See what they see</Link></div>
            <div className="panel-b"><ClientAccess client={c} logins={logins} /></div>
          </section>
        )}

        {tab === "settings" && (
          <>
            <section className="panel"><div className="panel-h"><span className="label">Client details</span></div><div className="panel-b"><ClientForm client={c} /></div></section>
            <section className="panel"><div className="panel-h"><span className="label">Archive</span></div><div className="panel-b"><ArchiveClient client={c} /></div></section>
          </>
        )}
      </main>
    </>
  );
}
