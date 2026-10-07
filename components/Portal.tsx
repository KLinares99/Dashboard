import Link from "next/link";
import type { ClientBundle } from "@/lib/data";
import { fmtDate, money } from "@/lib/format";
import { owedOn } from "@/lib/types";
import type { Invoice } from "@/lib/types";
import { Mark } from "./Icon";
import { ApprovalCard } from "./portal/Approval";
import { ThisMonth } from "./portal/Content";
import { Todos } from "./portal/Todos";

/** Turns *word* emphasis markup into <em>. Used by the staff client header. */
export function Headline({ text }: { text: string }) {
  const parts = text.split(/\*(.+?)\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <em key={i}>{p}</em> : p))}</>;
}

/** Only what a client should ever see, filtered here too so staff previews match exactly. */
export function clientView(b: ClientBundle) {
  return {
    client: b.client,
    todos: b.tasks.filter((t) => t.assignee === "client"),
    invoices: b.invoices.filter((i) => i.status === "sent" || i.status === "paid"),
    approvals: [...b.approvals].sort((x, y) => (x.status === y.status ? 0 : x.status === "open" ? -1 : 1)),
    approvalItems: b.approvalItems,
    payments: b.payments,
  };
}

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(now));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function PortalBar({ signOut }: { signOut: boolean }) {
  return (
    <header className="ios-bar">
      <div className="ios-bar-in">
        <Mark size={28} />
        <span className="brand-word">Elevate</span>
        <span className="spacer" />
        {signOut && (
          <form action="/auth/signout" method="post"><button className="ios-text-btn" type="submit">Sign out</button></form>
        )}
      </div>
    </header>
  );
}

function InvoiceCard({ inv, today }: { inv: Invoice; today: string }) {
  const paid = inv.status === "paid";
  const dueDate = inv.due_on || inv.issued_on;
  const pastDue = !paid && dueDate != null && dueDate < today;
  const left = owedOn(inv);
  return (
    <div className="ios-invoice">
      <span className="what">{inv.label}</span>
      <span className="amount">{paid ? money(inv.amount_cents, { cents: inv.amount_cents % 100 !== 0 }) : money(left, { cents: left % 100 !== 0 })}</span>
      {!paid && inv.paid_cents > 0 && (
        <span className="what">{money(inv.paid_cents, { cents: inv.paid_cents % 100 !== 0 })} of {money(inv.amount_cents)} paid · {money(left, { cents: left % 100 !== 0 })} left</span>
      )}
      <span className={`status ${paid ? "paid" : pastDue ? "late" : "due"}`}>
        {paid ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4Z" /></svg>
            Paid{inv.paid_on ? ` ${fmtDate(inv.paid_on, { month: "short", day: "numeric" })}` : ""}
          </>
        ) : (
          <>{pastDue ? "Past due · was due" : "Due"}{dueDate ? ` ${fmtDate(dueDate, { month: "short", day: "numeric" })}` : ""}</>
        )}
      </span>
      {!paid && inv.pay_url && <a className="ios-btn" href={inv.pay_url} target="_blank" rel="noopener">Pay {money(left, { cents: left % 100 !== 0 })}</a>}
    </div>
  );
}

/** Invoices due now. If nothing is due, this month's paid invoice, else a quiet "all paid" card. */
export function InvoiceSection({ invoices, today, allHref }: { invoices: Invoice[]; today: string; allHref: string }) {
  const due = invoices.filter((i) => owedOn(i) > 0).sort((a, b) => (a.issued_on ?? "").localeCompare(b.issued_on ?? ""));
  const month = today.slice(0, 7);
  const paidThisMonth = invoices.filter((i) => i.status === "paid" && (i.paid_on ?? i.issued_on ?? "").startsWith(month));
  const show = due.length ? due : paidThisMonth.slice(0, 1);
  const total = due.reduce((a, i) => a + owedOn(i), 0);
  return (
    <section className="ios-section">
      <div className="ios-section-h">
        <h2>{due.length > 1 ? <>Invoices due <span className="count">{money(total)}</span></> : due.length ? "Invoice due" : "Invoice"}</h2>
        {invoices.length > 0 && <Link href={allHref}>See all</Link>}
      </div>
      <div className="ios-card">
        {show.length ? show.map((i) => <InvoiceCard key={i.id} inv={i} today={today} />) : (
          <div className="ios-empty">
            <span className="glyph" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
            <b>You&apos;re all paid up</b>
            Thank you!
          </div>
        )}
      </div>
      {due.some((i) => !i.pay_url) && <p className="ios-foot">Questions about an invoice? Reply to any Elevate email.</p>}
    </section>
  );
}

/** The whole client home: hello, invoice, to-dos, this month's content. */
export function ClientHome({ bundle, today, firstName, base, interactive }: {
  bundle: ClientBundle; today: string; firstName: string | null; base: string; interactive: boolean;
}) {
  const v = clientView(bundle);
  const open = v.todos.filter((t) => !t.done).length;
  return (
    <main className="ios-page">
      <div className="ios-hello">
        <h1>{greeting()}{firstName ? `, ${firstName}` : ""}</h1>
        <p>{v.client.name} · {fmtDate(today, { month: "long", year: "numeric" })}</p>
      </div>
      {v.approvals.map((a) => (
        <ApprovalCard key={a.id} approval={a} items={v.approvalItems.filter((i) => i.approval_id === a.id)}
          href={`${base}${base.includes("?") ? "&" : "?"}approval=${a.id}`} />
      ))}
      <InvoiceSection invoices={v.invoices} today={today} allHref={`${base}${base.includes("?") ? "&" : "?"}view=invoices`} />
      <section className="ios-section">
        <div className="ios-section-h"><h2>Your to-dos {open > 0 && <span className="count">{open}</span>}</h2></div>
        <Todos tasks={v.todos} today={today} interactive={interactive} />
      </section>
      <ThisMonth client={v.client} today={today} base={base} />
    </main>
  );
}

/** Every sent or paid invoice, newest first. */
export function AllInvoices({ bundle, back }: { bundle: ClientBundle; back: string }) {
  const v = clientView(bundle);
  const list = [...v.invoices].sort((a, b) => (b.issued_on ?? "").localeCompare(a.issued_on ?? ""));
  return (
    <main className="ios-page">
      <div className="ios-hello" style={{ paddingTop: 8 }}>
        <Link href={back} style={{ fontSize: 17 }}>‹ Home</Link>
        <h1 style={{ marginTop: 10 }}>Invoices</h1>
      </div>
      <div className="ios-card">
        {list.length ? list.map((i) => (
          <div key={i.id} className="ios-row">
            <span className="grow">{i.label}<span className="sub">{i.status === "paid" ? `Paid ${i.paid_on ? fmtDate(i.paid_on, { month: "short", day: "numeric", year: "numeric" }) : ""}` : i.paid_cents > 0 ? `${money(i.paid_cents, { cents: i.paid_cents % 100 !== 0 })} paid · ${money(owedOn(i), { cents: owedOn(i) % 100 !== 0 })} left` : "Due"}</span></span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: i.status === "paid" ? "var(--label-2)" : "var(--label)" }}>{money(i.amount_cents, { cents: i.amount_cents % 100 !== 0 })}</span>
            {i.status === "sent" && i.pay_url && <a href={i.pay_url} target="_blank" rel="noopener">Pay</a>}
          </div>
        )) : <div className="ios-empty">No invoices yet.</div>}
      </div>
      {v.payments.length > 0 && (
        <section className="ios-section">
          <div className="ios-section-h"><h2>Payments</h2></div>
          <div className="ios-card">
            {v.payments.map((p) => (
              <div key={p.id} className="ios-row">
                <span className="grow">{fmtDate(p.paid_on, { month: "long", day: "numeric", year: "numeric" })}<span className="sub">{[p.method, p.reference].filter(Boolean).join(" · ") || "Payment"}</span></span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--green)" }}>{money(p.amount_cents, { cents: p.amount_cents % 100 !== 0 })}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
