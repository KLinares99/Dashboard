import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/Shell";
import { loadWorkspace, progress, unpaidCents } from "@/lib/data";
import { STATUS_LABEL, TYPE_LABEL, money, priceLabel } from "@/lib/format";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const ws = await loadWorkspace();
  return (
    <>
      <TopBar eyebrow="Everyone we work with" title="Clients" actions={<Link className="btn primary" href="/app/clients/new"><Icon name="plus" size={18} /><span>New client</span></Link>} />
      <main className="view">
        <section className="panel">
          <div className="tbl-wrap">
            <table style={{ minWidth: 760 }}>
              <thead><tr><th>Client</th><th>Plan</th><th>Status</th><th>Progress</th><th className="r">Owes</th></tr></thead>
              <tbody>
                {ws.clients.map((c) => {
                  const p = progress(ws.tasks.filter((t) => t.client_id === c.id));
                  const owed = unpaidCents(ws.invoices, c.id);
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/app/clients/${c.slug}`} className="row-gap" style={{ gap: 10, color: "var(--ink)", fontWeight: 500, textDecoration: "none" }}><i className="dot" style={{ "--c": `var(--c-${c.color})` } as React.CSSProperties} />{c.name}</Link><div className="muted" style={{ fontSize: 13 }}>{c.contact_name}</div></td>
                      <td>{TYPE_LABEL[c.type]}<div className="muted num" style={{ fontSize: 13 }}>{priceLabel(c)}</div></td>
                      <td><span className={`pill p-${c.status}`}>{STATUS_LABEL[c.status]}</span></td>
                      <td style={{ minWidth: 140, "--c": `var(--c-${c.color})` } as React.CSSProperties}><div className="prog"><span className="bar"><i style={{ width: `${p.pct}%` }} /></span><span className="num">{p.done}/{p.total}</span></div></td>
                      <td className="r"><span className="num" style={{ color: owed ? "var(--red)" : "var(--faint)" }}>{owed ? money(owed) : "–"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
