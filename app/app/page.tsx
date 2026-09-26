import Link from "next/link";
import { Icon } from "@/components/Icon";
import { EventRows } from "@/components/Managers";
import { TopBar } from "@/components/Shell";
import { loadWorkspace, progress, unpaidCents } from "@/lib/data";
import { STATUS_LABEL, fmtDate, money, priceLabel, todayISO } from "@/lib/format";

export const metadata = { title: "Pulse" };
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export default async function Pulse() {
  const ws = await loadWorkspace();
  const today = todayISO();
  const paying = ws.clients.filter((c) => c.type !== "internal");
  const mrr = paying.filter((c) => c.type === "retainer").reduce((a, c) => a + c.price_cents, 0);
  const owed = unpaidCents(ws.invoices);
  const open = ws.tasks.filter((t) => !t.done);
  const urgent = open.filter((t) => t.flag === "urgent");
  const overdue = open.filter((t) => t.due_on && t.due_on < today);
  const needs = ws.clients.filter((c) => c.status === "urgent").length;
  const upcoming = ws.events.filter((e) => !e.done).slice(0, 5);
  const byId = new Map(ws.clients.map((c) => [c.id, c]));
  const mixTotal = paying.reduce((a, c) => a + c.price_cents, 0) || 1;
  const attention = [...urgent, ...overdue.filter((t) => t.flag !== "urgent")];

  return (
    <>
      <TopBar eyebrow="Command center" title="Pulse" actions={<Link className="btn primary" href="/app/clients/new"><Icon name="plus" size={18} /><span>New client</span></Link>} />
      <main className="view">
        <section className="hero">
          <div className="meta">{paying.length} active clients · {fmtDate(today, { weekday: "long", month: "long", day: "numeric" })}</div>
          <h2>{WORDS[needs] ?? needs} client{needs === 1 ? "" : "s"} <em>need you</em> this week.</h2>
          <p><b>{money(mrr)}/mo</b> on retainer, <b>{money(owed)}</b> unpaid, {urgent.length} urgent task{urgent.length === 1 ? "" : "s"}{overdue.length ? `, ${overdue.length} overdue` : ""}.</p>
        </section>
        <section className="tiles">
          <div className="tile"><span className="label">Active clients</span><span className="v">{paying.length}</span><span className="d">{ws.clients.length - paying.length ? "+ Elevate in-house" : " "}</span></div>
          <div className="tile"><span className="label">Monthly retainer</span><span className="v">{money(mrr)}</span><span className="d">{paying.filter((c) => c.type === "retainer").length} retainers</span></div>
          <Link href="/app/billing" className={`tile ${owed ? "alert" : "good"}`} style={{ textDecoration: "none" }}><span className="label">Unpaid</span><span className="v">{money(owed)}</span><span className="d">{owed ? "Collect now" : "All clear"}</span></Link>
          <Link href="/app/tasks" className={`tile ${urgent.length ? "alert" : ""}`} style={{ textDecoration: "none" }}><span className="label">Urgent tasks</span><span className="v">{urgent.length}</span><span className="d">{open.length} open · {open.filter((t) => t.flag === "blocked").length} blocked</span></Link>
        </section>
        <div className="cols">
          <section className="panel">
            <div className="panel-h"><span className="label">Needs you</span><Link className="seg" href="/app/tasks">All tasks</Link></div>
            <div className="panel-b">
              {attention.length ? (
                <div className="acts">
                  {attention.map((t) => {
                    const c = byId.get(t.client_id)!;
                    const late = t.due_on && t.due_on < today;
                    return (
                      <Link key={t.id} href={`/app/clients/${c.slug}?tab=tasks`} className="act">
                        <i className="dot" style={{ "--c": `var(--c-${c.color})` } as React.CSSProperties} />
                        <div><div className="t">{t.title}</div><div className="s">{c.name}{t.flag === "urgent" && <span className="pill p-urgent">urgent</span>}{late && <span className="pill p-late">due {fmtDate(t.due_on!)}</span>}</div></div>
                        <span className="go"><Icon name="arrow" size={20} /></span>
                      </Link>
                    );
                  })}
                </div>
              ) : <div className="empty">Nothing urgent or overdue.</div>}
            </div>
          </section>
          <div className="stack">
            <section className="panel">
              <div className="panel-h"><span className="label">Where the money comes from</span></div>
              <div className="panel-b">
                <div className="mix" role="img" aria-label="Revenue by client">{paying.map((c) => <i key={c.id} style={{ "--c": `var(--c-${c.color})`, width: `${(c.price_cents / mixTotal) * 100}%` } as React.CSSProperties} />)}</div>
                <div className="mix-legend">{paying.map((c) => [
                  <span key={c.id + "n"} className="row-gap" style={{ gap: 8, flexWrap: "nowrap" }}><i className="dot" style={{ "--c": `var(--c-${c.color})` } as React.CSSProperties} />{c.name}</span>,
                  <span key={c.id + "v"}>{priceLabel(c)}</span>,
                ])}</div>
              </div>
            </section>
            <section className="panel">
              <div className="panel-h"><span className="label">Coming up</span><Link className="seg" href="/app/schedule">Schedule</Link></div>
              {upcoming.length ? <EventRows events={upcoming} clients={ws.clients} today={today} editable={false} /> : <div className="panel-b empty">No dates yet.</div>}
            </section>
          </div>
        </div>
        <section className="panel">
          <div className="panel-h"><span className="label">All clients</span><Link className="seg" href="/app/clients/new">Add client</Link></div>
          <div>
            {ws.clients.map((c) => {
              const p = progress(ws.tasks.filter((t) => t.client_id === c.id));
              return (
                <Link key={c.id} href={`/app/clients/${c.slug}`} className="roster-row" style={{ "--c": `var(--c-${c.color})` } as React.CSSProperties}>
                  <span className="n"><i className="dot" /><span>{c.name}<small>{priceLabel(c)}</small></span></span>
                  <span><span className={`pill p-${c.status}`}>{STATUS_LABEL[c.status]}</span></span>
                  <span className="prog"><span className="bar"><i style={{ width: `${p.pct}%` }} /></span><span className="num">{p.done}/{p.total} done</span></span>
                  <span className="nx">{c.next_step}</span>
                  <Icon name="chev" size={18} />
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
