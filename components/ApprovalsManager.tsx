"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { type ActionResult, createApproval, deleteApproval, reopenApproval, setApprovalPdf } from "@/app/app/actions";
import { fmtDate } from "@/lib/format";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Approval, ApprovalItem, DecisionKind, DecisionOption, DecisionResponse } from "@/lib/types";
import { Icon } from "./Icon";
import { ConfirmDelete } from "./TaskList";

function Result({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  if (!r.ok) return <div className="notice err" role="alert">{r.error}</div>;
  return r.message ? <div className="notice ok" role="status">{r.message}</div> : null;
}

/** Plain-language summary of one answer, for the staff table. */
function answerText(item: ApprovalItem, r: DecisionResponse | null) {
  if (!r) return <span className="muted">Not answered</span>;
  if (r.approved === true) return <span style={{ color: "var(--green)", fontWeight: 500 }}>Approved</span>;
  if (r.approved === false) return <span><span style={{ color: "var(--amber)", fontWeight: 500 }}>Change requested:</span> {r.note}</span>;
  if (r.choice) return <span><b style={{ fontWeight: 500 }}>{r.choice}</b>{item.options.find((o) => o.label === r.choice)?.recommended ? <span className="muted"> (recommended)</span> : null}</span>;
  if (r.text) return item.kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(r.text) ? fmtDate(r.text, { weekday: "short", month: "long", day: "numeric", year: "numeric" }) : <span style={{ whiteSpace: "pre-wrap" }}>{r.text}</span>;
  return <span className="muted">Answered</span>;
}

export function ApprovalsManager({ clientId, slug, approvals, items }: { clientId: string; slug: string; approvals: Approval[]; items: ApprovalItem[] }) {
  return (
    <div className="stack">
      {approvals.map((a) => <ApprovalPanel key={a.id} clientId={clientId} slug={slug} approval={a} items={items.filter((i) => i.approval_id === a.id)} />)}
      {!approvals.length && <div className="notice info">No approvals yet. Create one below and it appears as a card on the client&apos;s home page.</div>}
      <section className="panel">
        <details className="drawer" style={{ borderTop: 0 }} open={!approvals.length}>
          <summary>+ New approval</summary>
          <div className="panel-b"><NewApproval clientId={clientId} /></div>
        </details>
      </section>
    </div>
  );
}

function ApprovalPanel({ clientId, slug, approval: a, items }: { clientId: string; slug: string; approval: Approval; items: ApprovalItem[] }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const done = items.filter((i) => i.response).length;
  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));

  const upload = async (file: File) => {
    setResult(null);
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return setResult({ ok: false, error: "Attach a PDF file." });
    if (file.size > 45 * 1024 * 1024) return setResult({ ok: false, error: "That PDF is over 45 MB. Export a smaller version." });
    setUploading(true);
    const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120);
    const path = `${clientId}/${a.id}/${Date.now()}-${safe}`;
    const { error } = await createBrowserSupabase().storage.from("documents").upload(path, file, { contentType: "application/pdf", upsert: false });
    setUploading(false);
    if (error) return setResult({ ok: false, error: `Upload failed: ${error.message}` });
    run(() => setApprovalPdf(a.id, path, file.name));
  };

  return (
    <section className="panel">
      <div className="panel-h">
        <span className="label" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: a.card_color, borderBottom: `3px solid ${a.accent_color}` }} aria-hidden="true" />
          {a.title}
        </span>
        {a.status === "signed"
          ? <span className="pill p-done">Signed by {a.signed_name} · {fmtDate(a.signed_at!.slice(0, 10))}</span>
          : <span className={`pill ${done === items.length ? "p-active" : "p-waiting"}`}>{done} of {items.length} answered</span>}
        <Link className="seg" href={`/app/clients/${slug}/preview?approval=${a.id}`}>Preview</Link>
      </div>
      <div className="tbl-wrap">
        <table style={{ minWidth: 560 }}>
          <thead><tr><th style={{ width: "28%" }}>Decision</th><th>Answer</th><th className="r" style={{ width: 120 }}>When</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td><b style={{ fontWeight: 500, color: "var(--ink)" }}>{i.label}</b>{i.tag && <div className="muted" style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>{i.tag}</div>}</td>
                <td>{answerText(i, i.response)}</td>
                <td className="r muted" style={{ fontSize: 14 }}>{i.responded_at ? fmtDate(i.responded_at.slice(0, 10)) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel-b row-gap" style={{ borderTop: "1px solid var(--line)", justifyContent: "space-between" }}>
        <span className="row-gap">
          <Icon name="file" size={18} />
          {a.pdf_path ? <span>{a.pdf_name ?? "PDF attached"}</span> : <span className="muted">No PDF attached</span>}
          <label className="btn small" style={{ cursor: "pointer" }}>
            {uploading ? "Uploading…" : a.pdf_path ? "Replace PDF" : "Attach PDF"}
            <input id={`pdf-${a.id}`} type="file" accept="application/pdf,.pdf" hidden disabled={uploading || pending}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
          </label>
          {a.pdf_path && <button className="btn small" type="button" disabled={pending} onClick={() => run(() => setApprovalPdf(a.id, null, null))}>Remove PDF</button>}
        </span>
        <span className="row-gap">
          {a.status === "signed" && <button className="btn small" type="button" disabled={pending} onClick={() => run(() => reopenApproval(a.id))}>Reopen</button>}
          <ConfirmDelete label={a.title} onConfirm={() => run(() => deleteApproval(a.id))} />
        </span>
      </div>
      {result && <div className="panel-b" style={{ paddingTop: 0 }}><Result r={result} /></div>}
    </section>
  );
}

type Draft = { label: string; tag: string; detail: string; kind: DecisionKind; options: DecisionOption[] };
const blank = (): Draft => ({ label: "", tag: "Recommend", detail: "", kind: "approve", options: [] });

function NewApproval({ clientId }: { clientId: string }) {
  const [eyebrow, setEyebrow] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [summary, setSummary] = useState("");
  const [cardColor, setCardColor] = useState("#14213d");
  const [accent, setAccent] = useState("#c9a04a");
  const [decisions, setDecisions] = useState<Draft[]>([blank()]);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const patch = (i: number, p: Partial<Draft>) => setDecisions((ds) => ds.map((d, j) => (j === i ? { ...d, ...p } : d)));
  const patchOpt = (i: number, k: number, p: Partial<DecisionOption>) =>
    patch(i, { options: decisions[i].options.map((o, j) => (j === k ? { ...o, ...p } : o)) });

  return (
    <form className="stack" style={{ gap: 16 }} onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await createApproval({
          client_id: clientId, eyebrow, title, subtitle, summary, card_color: cardColor, accent_color: accent,
          decisions: decisions.map((d) => ({ ...d, options: d.options.filter((o) => o.label.trim()) })),
        });
        setResult(r);
        if (r.ok) { setTitle(""); setEyebrow(""); setSubtitle(""); setSummary(""); setDecisions([blank()]); }
      });
    }}>
      <div className="form-grid">
        <label className="field"><span>Small heading above the title</span><input id="ap-eyebrow" className="input" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} placeholder="Course approval · Middle-tier offer" /></label>
        <label className="field"><span>Title</span><input id="ap-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Forged" /></label>
        <label className="field"><span>Subtitle</span><input id="ap-subtitle" className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="The 12-week Warriors course" /></label>
        <div className="row-gap" style={{ alignItems: "flex-end" }}>
          <label className="field"><span>Card color</span><input id="ap-card" className="input" type="color" value={cardColor} onChange={(e) => setCardColor(e.target.value)} style={{ width: 80, height: 44, padding: 4 }} /></label>
          <label className="field"><span>Accent</span><input id="ap-accent" className="input" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 80, height: 44, padding: 4 }} /></label>
        </div>
        <label className="field wide"><span>Summary (shown on the approval page)</span><textarea id="ap-summary" className="input" value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
      </div>

      <div className="label">Decisions</div>
      {decisions.map((d, i) => (
        <div key={i} className="panel" style={{ boxShadow: "none" }}>
          <div className="panel-b stack" style={{ gap: 12 }}>
            <div className="form-grid">
              <label className="field"><span>Decision {i + 1}</span><input id={`d-label-${i}`} className="input" value={d.label} onChange={(e) => patch(i, { label: e.target.value })} required placeholder="Course name" /></label>
              <div className="row-gap" style={{ alignItems: "flex-end" }}>
                <label className="field"><span>Label</span>
                  <select id={`d-tag-${i}`} className="input" value={d.tag} onChange={(e) => patch(i, { tag: e.target.value })}>
                    {["Recommend", "Needed", "Proposed", "Options", ""].map((t) => <option key={t} value={t}>{t || "None"}</option>)}
                  </select>
                </label>
                <label className="field"><span>Answer type</span>
                  <select id={`d-kind-${i}`} className="input" value={d.kind} onChange={(e) => {
                    const kind = e.target.value as DecisionKind;
                    patch(i, { kind, options: kind === "choice" && d.options.length < 2 ? [{ label: "" }, { label: "" }] : d.options });
                  }}>
                    <option value="approve">Approve / request change</option>
                    <option value="choice">Pick one option</option>
                    <option value="text">Write an answer</option>
                    <option value="date">Pick a date</option>
                  </select>
                </label>
              </div>
              <label className="field wide"><span>What we recommend or need</span><textarea id={`d-detail-${i}`} className="input" style={{ minHeight: 60 }} value={d.detail} onChange={(e) => patch(i, { detail: e.target.value })} /></label>
            </div>
            {d.kind === "choice" && (
              <div className="stack" style={{ gap: 8 }}>
                {d.options.map((o, k) => (
                  <div key={k} className="row-gap" style={{ flexWrap: "nowrap" }}>
                    <input id={`d-${i}-o-${k}`} className="input" aria-label={`Option ${k + 1}`} value={o.label} onChange={(e) => patchOpt(i, k, { label: e.target.value })} placeholder={`Option ${k + 1}`} />
                    <input id={`d-${i}-od-${k}`} className="input" aria-label={`Option ${k + 1} detail`} value={o.detail ?? ""} onChange={(e) => patchOpt(i, k, { detail: e.target.value })} placeholder="Short explanation (optional)" />
                    <label className="toggle" style={{ whiteSpace: "nowrap" }}><input id={`d-${i}-or-${k}`} type="checkbox" checked={!!o.recommended} onChange={(e) => patchOpt(i, k, { recommended: e.target.checked })} />Recommended</label>
                  </div>
                ))}
                <button className="btn small" type="button" style={{ alignSelf: "flex-start" }} onClick={() => patch(i, { options: [...d.options, { label: "" }] })}>+ Option</button>
              </div>
            )}
            {decisions.length > 1 && <button className="btn small danger" type="button" style={{ alignSelf: "flex-start" }} onClick={() => setDecisions((ds) => ds.filter((_, j) => j !== i))}>Remove decision</button>}
          </div>
        </div>
      ))}
      <button className="btn" type="button" style={{ alignSelf: "flex-start" }} onClick={() => setDecisions((ds) => [...ds, blank()])}>+ Add decision</button>
      <Result r={result} />
      <div className="form-actions"><button className="btn primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create approval"}</button></div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>You can attach the PDF after creating it.</p>
    </form>
  );
}
