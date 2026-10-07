import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Approval, ApprovalItem } from "@/lib/types";
import { Decisions } from "./Decisions";

const coverStyle = (a: Approval) => ({ "--ap-bg": a.card_color, "--ap-accent": a.accent_color }) as React.CSSProperties;
const answered = (items: ApprovalItem[]) => items.filter((i) => i.response).length;

/** The cover card on the client's home. Opens the approval. */
export function ApprovalCard({ approval: a, items, href }: { approval: Approval; items: ApprovalItem[]; href: string }) {
  const done = answered(items);
  const signed = a.status === "signed";
  return (
    <Link href={href} className="ap-cover" style={coverStyle(a)} aria-label={`${a.title}: ${signed ? "approved" : "needs your approval"}`}>
      {a.eyebrow && <span className="ap-eyebrow">{a.eyebrow}</span>}
      <span className="ap-title">{a.title}</span>
      {a.subtitle && <span className="ap-sub">{a.subtitle}</span>}
      <span className="ap-rule" aria-hidden="true" />
      {!signed && items.length > 0 && <span className="ap-progress" aria-hidden="true"><i style={{ width: `${(done / items.length) * 100}%` }} /></span>}
      <span className="ap-foot">
        <span className="grow">
          {signed ? `Approved ${fmtDate(a.signed_at!.slice(0, 10))}` : done ? `${done} of ${items.length} decisions made` : `Needs your approval · ${items.length} decisions`}
        </span>
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1 1 6 6-6 6" /></svg>
      </span>
    </Link>
  );
}

/** The full approval: cover with summary and PDF, each decision, then sign-off. */
export async function ApprovalView({ approval: a, items, back, interactive }: {
  approval: Approval; items: ApprovalItem[]; back: string; interactive: boolean;
}) {
  let pdfUrl: string | null = null;
  if (a.pdf_path) {
    const db = await createClient();
    const { data } = await db.storage.from("documents").createSignedUrl(a.pdf_path, 60 * 60, { download: a.pdf_name ?? `${a.title}.pdf` });
    pdfUrl = data?.signedUrl ?? null;
  }
  return (
    <main className="ios-page">
      <div style={{ paddingTop: 16 }}><Link href={back} style={{ fontSize: 17 }}>‹ Home</Link></div>
      <section className="ap-cover ap-big" style={coverStyle(a)}>
        {a.eyebrow && <span className="ap-eyebrow">{a.eyebrow}</span>}
        <h1 className="ap-title">{a.title}</h1>
        {a.subtitle && <span className="ap-sub">{a.subtitle}</span>}
        <span className="ap-rule" aria-hidden="true" />
        {a.summary && <p className="ap-summary">{a.summary}</p>}
        {pdfUrl && (
          <a className="ap-download" href={pdfUrl}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14" /></svg>
            Download the full PDF
          </a>
        )}
      </section>
      <Decisions approval={a} items={items} interactive={interactive} />
    </main>
  );
}
