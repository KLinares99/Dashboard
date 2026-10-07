import Link from "next/link";
import { Icon } from "@/components/Icon";
import { EventRows } from "@/components/Managers";
import { TopBar } from "@/components/Shell";
import { getProfile } from "@/lib/auth";
import { loadWorkspace, unpaidCents } from "@/lib/data";
import { STATUS_LABEL, fmtDate, money, priceLabel, todayISO } from "@/lib/format";

export const metadata = { title: "Pulse" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const cents = (n: number) => money(n, { cents: n % 100 !== 0 });

export default async function Pulse() {
  const [ws, me] = await Promise.all([loadWorkspace(), getProfile()]);
  const today = todayISO();
  const paying = ws.clients.filter((c) => c.type !== "internal");
  const mrr = paying.filter((c) => c.type === "retainer").reduce((a, c) => a + c.price_cents, 0);
  // Same calculation as the client portal: what is still owed on each sent invoice.
  const owed = unpaidCents(ws.invoices);
  const owing = ws.clients.filter((c) => unpaidCents(ws.invoices, c.id) > 0);
  const ours = ws.tasks.filter((t) => t.assignee === "elevate" && !t.done);
  const urgent = ours.filter((t) => t.flag === "urgent");
  const overdue = ours.filter((t) => t.due_on && t.due_on < today && t.flag !== "urgent");
  const attention = [...urgent, ...overdue];
  const openApprovals = ws.approvals.filter((a) => a.status === "open");
  const upcoming = ws.events.filter((e) => !e.done).slice(0, 5);
  const byId = new Map(ws.clients.map((c) => [c.id, c]));
  const name = me?.full_name?.trim().split(/\s+/)[0] ?? null;

  return (
    <>
      <TopBar eyebrow="Elevate" title="Pulse" actions={<Link className="btn primary" href="/app/clients/new"><Icon name="plus" size={18} /><span>New client</span></Link>} />
      <main className="view">
        <section className="hero">
          <h2>{greeting()}{name ? `, ${name}` : ""}</h2>
          <p>{fmtDate(today, { weekday: "long", month: "long", day: "numeric" })} · {paying.length} active clients</p>
        </section>

        <section className="tiles">
          <Link href="/app/billing" className={`tile ${owed ? "alert" : "good"}`} style={{ textDecoration: "none" }}>
            <span className="label">Owed to you</span><span className="v">{cents(owed)}</span>
            <span className="d">{owing.length ? owing.map((c) => c.name).join(", ") : "Everyone is paid up"}</span>
          </Link>
          <div className="tile"><span className="label">Monthly retainer</span><span className="v">{money(mrr)}</span><span className="d">{paying.filter((c) => c.type === "retainer").length} retainers</span></div>
          <Link href="/app/tasks" className={`tile ${urgent.length ? "alert" : ""}`} style={{ textDecoration: "none" }}>
            <span className="label">Urgent tasks</span><span className="v">{urgent.length}</span><span className="d">{ours.length} open{overdue.length ? ` · ${overdue.length} overdue` : ""}</span>
          </Link>
          <div className="tile"><span className="label">Waiting on approval</span><span className="v">{openApprovals.length}</span>
            <span className="d">{openApprovals.length ? openApprovals.map((a) => `${a.title} (${byId.get(a.client_id)?.name})`).join(", ") : "Nothing out for sign-off"}</span>
          </div>
        </section>

        <div className="cols">
          <section className="panel">
            <div className="panel-h"><span className="label">Needs you</span><Link className="seg" href="/app/tasks">All tasks</Link></div>
            <div className="panel-b" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {attention.length ? (
                <div className="acts">
                  {attention.map((t) => {
                    const c = byId.get(t.client_id)!;
                    return (
                      <Link key={t.id} href={`/app/clients/${c.slug}?tab=tasks`} className="act">
                        <i className="dot" style={{ "--c": `var(--c-${c.color})`, marginTop: 8 } as React.CSSProperties} />
                        <div><div className="t">{t.title}</div><div className="s">{c.name}{t.flag === "urgent" ? <span className="pill p-urgent">urgent</span> : <span className="pill p-late">due {fmtDate(t.due_on!)}</span>}</div></div>
                        <span className="go"><Icon name="chev" size={18} /></span>
                      </Link>
                    );
                  })}
                </div>
              ) : <div className="empty" style={{ padding: "14px 0" }}>Nothing urgent or overdue.</div>}
            </div>
          </section>
          <div className="stack">
            <section className="panel">
              <div className="panel-h"><span className="label">Coming up</span><Link className="seg" href="/app/schedule">Schedule</Link></div>
              {upcoming.length ? <EventRows events={upcoming} clients={ws.clients} today={today} editable={false} /> : <div className="panel-b empty">No dates yet.</div>}
            </section>
            <section className="panel">
              <div className="panel-h"><span className="label">Recent payments</span><Link className="seg" href="/app/billing">Billing</Link></div>
              <div className="panel-b" style={{ paddingTop: 4, paddingBottom: 4 }}>
                {ws.payments.length ? (
                  <div className="list-rows">
                    {ws.payments.slice(0, 4).map((p) => (
                      <div key={p.id}>
                        <span><b style={{ fontWeight: 500 }}>{byId.get(p.client_id)?.name}</b><span className="muted" style={{ display: "block", fontSize: 14 }}>{fmtDate(p.paid_on, { month: "short", day: "numeric" })}{p.reference ? ` · ${p.reference}` : ""}</span></span>
                        <span className="num" style={{ color: "var(--green)", fontWeight: 600 }}>{cents(p.amount_cents)}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty" style={{ padding: "14px 0" }}>No payments recorded yet.</div>}
              </div>
            </section>
          </div>
        </div>

        <section className="panel">
          <div className="panel-h"><span className="label">Clients</span><Link className="seg" href="/app/clients/new">Add client</Link></div>
          <div>
            {ws.clients.map((c) => {
              const due = unpaidCents(ws.invoices, c.id);
              return (
                <Link key={c.id} href={`/app/clients/${c.slug}`} className="client-row" style={{ "--c": `var(--c-${c.color})` } as React.CSSProperties}>
                  <i className="dot" />
                  <span className="grow">
                    <b>{c.name}</b>
                    <span className="sub">{priceLabel(c)}{c.next_step ? ` · ${c.next_step}` : ""}</span>
                  </span>
                  {due > 0 ? <span className="owes num">{cents(due)} owed</span> : <span className={`pill p-${c.status}`}>{STATUS_LABEL[c.status]}</span>}
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
