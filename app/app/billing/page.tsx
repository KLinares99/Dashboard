import { AddInvoiceForm, InvoiceRows } from "@/components/Managers";
import { TopBar } from "@/components/Shell";
import { loadWorkspace, unpaidCents } from "@/lib/data";
import { money } from "@/lib/format";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const ws = await loadWorkspace();
  const paying = ws.clients.filter((c) => c.type !== "internal");
  const mrr = paying.filter((c) => c.type === "retainer").reduce((a, c) => a + c.price_cents, 0);
  const owed = unpaidCents(ws.invoices);
  const owing = new Set(ws.invoices.filter((i) => i.status === "sent").map((i) => i.client_id)).size;
  const paid = ws.invoices.filter((i) => i.status === "paid").reduce((a, i) => a + i.amount_cents, 0);
  const drafts = ws.invoices.filter((i) => i.status === "draft").reduce((a, i) => a + i.amount_cents, 0);
  const sorted = [...ws.invoices].sort((a, b) => {
    const rank = { sent: 0, draft: 1, paid: 2, void: 3 } as const;
    return rank[a.status] - rank[b.status] || (b.issued_on ?? "").localeCompare(a.issued_on ?? "");
  });
  return (
    <>
      <TopBar eyebrow="Retainers & invoices" title="Billing" />
      <main className="view">
        <section className="hero">
          <h2>{owed ? <><em>{money(owed)}</em> is waiting to be collected.</> : <>Everyone is <em>paid up</em>.</>}</h2>
          <p>Retainers bring in <b>{money(mrr)}/mo</b>{owing ? <> · {owing} client{owing === 1 ? " owes" : "s owe"} money</> : null}.</p>
        </section>
        <section className="tiles">
          <div className="tile"><span className="label">Monthly retainer</span><span className="v">{money(mrr)}</span><span className="d">{money(mrr * 12)} / year pace</span></div>
          <div className={`tile ${owed ? "alert" : "good"}`}><span className="label">Unpaid</span><span className="v">{money(owed)}</span><span className="d">{owing} client{owing === 1 ? "" : "s"}</span></div>
          <div className="tile"><span className="label">Collected</span><span className="v">{money(paid)}</span><span className="d">All paid invoices</span></div>
          <div className="tile"><span className="label">Drafts</span><span className="v">{money(drafts)}</span><span className="d">Not sent yet</span></div>
        </section>
        <section className="panel">
          <div className="panel-h"><span className="label">All invoices</span><span className="muted" style={{ fontSize: 14 }}>Unpaid first</span></div>
          <InvoiceRows invoices={sorted} clients={ws.clients} editable showClient />
          <details className="drawer"><summary>+ Add an invoice</summary><div className="panel-b"><AddInvoiceForm clients={paying} /></div></details>
        </section>
      </main>
    </>
  );
}
