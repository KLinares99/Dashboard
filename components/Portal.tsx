import type { ClientBundle } from "@/lib/data";
import { progress, unpaidCents } from "@/lib/data";
import { STATUS_LABEL, TYPE_LABEL, fmtDate, money, priceLabel } from "@/lib/format";
import { EventRows, InvoiceRows } from "./Managers";
import { MetricsView } from "./MetricsView";
import { TaskList } from "./TaskList";

/**
 * What a client sees. Filters to shared rows here as well as in the database,
 * so a staff preview shows exactly the client's view.
 */
export function clientSafe(b: ClientBundle): ClientBundle {
  return {
    ...b,
    tasks: b.tasks.filter((t) => t.visible_to_client),
    events: b.events.filter((e) => e.visible_to_client),
    invoices: b.invoices.filter((i) => i.status !== "draft"),
    blockers: [],
  };
}

export function Headline({ text }: { text: string }) {
  const parts = text.split(/\*(.+?)\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <em key={i}>{p}</em> : p))}</>;
}

export function PortalOverview({ bundle, today }: { bundle: ClientBundle; today: string }) {
  const b = clientSafe(bundle);
  const c = b.client;
  const p = progress(b.tasks);
  const owed = unpaidCents(b.invoices);
  const upcoming = b.events.filter((e) => !e.done && e.on_date >= today);
  const recent = b.tasks.filter((t) => t.done && t.done_at).sort((a, z) => (a.done_at! < z.done_at! ? 1 : -1)).slice(0, 4);
  return (
    <>
      <section className="hero">
        {c.summary && <div className="meta">{c.summary}</div>}
        <h2><Headline text={c.headline || `Welcome, *${c.name}*.`} /></h2>
        <p>{TYPE_LABEL[c.type]} · <b>{priceLabel(c)}</b>{c.next_step ? <> · Next: {c.next_step}</> : null}</p>
      </section>
      <section className="tiles">
        <div className="tile"><span className="label">Status</span><span className="v" style={{ fontSize: 26, paddingTop: 6 }}>{STATUS_LABEL[c.status === "urgent" ? "active" : c.status]}</span><span className="d">{c.services.slice(0, 2).join(" · ")}</span></div>
        <div className="tile"><span className="label">Progress</span><span className="v">{p.done}/{p.total}</span><span className="d">{p.pct}% of tasks done</span></div>
        <div className="tile"><span className="label">Next date</span><span className="v" style={{ fontSize: 26, paddingTop: 6 }}>{upcoming[0] ? fmtDate(upcoming[0].on_date) : "–"}</span><span className="d">{upcoming[0]?.label ?? "Nothing scheduled"}</span></div>
        <div className={`tile ${owed ? "alert" : "good"}`}><span className="label">Balance</span><span className="v">{money(owed)}</span><span className="d">{owed ? "Due now" : "All paid. Thank you!"}</span></div>
      </section>
      <div className="cols">
        <section className="panel">
          <div className="panel-h"><span className="label">What we&apos;re working on</span><span className="num muted" style={{ fontSize: 14 }}>{p.done}/{p.total}</span></div>
          <div className="panel-b tight"><TaskList clientId={c.id} tasks={b.tasks} editable={false} today={today} /></div>
        </section>
        <div className="stack">
          <section className="panel">
            <div className="panel-h"><span className="label">Coming up</span></div>
            {upcoming.length ? <EventRows events={upcoming} clients={[c]} today={today} editable={false} /> : <div className="panel-b empty">No dates scheduled yet.</div>}
          </section>
          {recent.length > 0 && (
            <section className="panel">
              <div className="panel-h"><span className="label">Recently finished</span></div>
              <div className="panel-b tight"><div className="list-rows">{recent.map((t) => <div key={t.id}><span>{t.title}</span><span className="muted" style={{ fontSize: 14, whiteSpace: "nowrap" }}>{fmtDate(t.done_at!.slice(0, 10))}</span></div>)}</div></div>
            </section>
          )}
          <section className="panel">
            <div className="panel-h"><span className="label">What&apos;s included</span></div>
            <div className="panel-b tight"><div className="list-rows">{c.services.map((s) => <div key={s}><span>{s}</span><span className="muted">Included</span></div>)}</div></div>
          </section>
        </div>
      </div>
    </>
  );
}

export function PortalResults({ bundle }: { bundle: ClientBundle }) {
  return (
    <>
      <section className="hero"><h2>How it&apos;s <em>performing</em>.</h2><p>Numbers from your website, social accounts and Google profile, updated when Elevate uploads new reports.</p></section>
      <MetricsView metrics={bundle.metrics} emptyText="Your first report will show up here once Elevate uploads it." />
    </>
  );
}

export function PortalInvoices({ bundle }: { bundle: ClientBundle }) {
  const b = clientSafe(bundle);
  const owed = unpaidCents(b.invoices);
  const paid = b.invoices.filter((i) => i.status === "paid").reduce((a, i) => a + i.amount_cents, 0);
  return (
    <>
      <section className="hero"><h2>{owed ? <>You have <em>{money(owed)}</em> due.</> : <>You&apos;re <em>all paid up</em>.</>}</h2>
        <p>{b.client.type === "retainer" ? <>Your plan is <b>{priceLabel(b.client)}</b>.</> : <>Project price: <b>{priceLabel(b.client)}</b>.</>} Questions about an invoice? Reply to any Elevate email.</p></section>
      <section className="tiles" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className={`tile ${owed ? "alert" : "good"}`}><span className="label">Balance due</span><span className="v">{money(owed)}</span><span className="d">{b.invoices.filter((i) => i.status === "sent").length} open invoice(s)</span></div>
        <div className="tile"><span className="label">Paid to date</span><span className="v">{money(paid)}</span><span className="d">{b.invoices.filter((i) => i.status === "paid").length} invoice(s)</span></div>
      </section>
      <section className="panel">
        <div className="panel-h"><span className="label">Invoices</span></div>
        <InvoiceRows invoices={b.invoices} clients={[b.client]} editable={false} showClient={false} />
      </section>
    </>
  );
}
