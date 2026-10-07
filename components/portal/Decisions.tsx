"use client";

import { useState, useTransition } from "react";
import { answerDecision, signApproval } from "@/app/portal/actions";
import { fmtDate } from "@/lib/format";
import type { Approval, ApprovalItem, DecisionResponse } from "@/lib/types";

const Check = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

/** Every decision, answered in place, then the signature. */
export function Decisions({ approval, items, interactive }: { approval: Approval; items: ApprovalItem[]; interactive: boolean }) {
  const [answers, setAnswers] = useState<Record<string, DecisionResponse | null>>(() => Object.fromEntries(items.map((i) => [i.id, i.response])));
  const signed = approval.status === "signed";
  const canEdit = interactive && !signed;
  const done = items.filter((i) => answers[i.id]).length;

  return (
    <>
      <section className="ios-section">
        <div className="ios-section-h"><h2>Your decisions <span className="count">{done} of {items.length}</span></h2></div>
        {items.map((it) => (
          <Decision key={it.id} item={it} answer={answers[it.id]} canEdit={canEdit}
            onSaved={(r) => setAnswers((s) => ({ ...s, [it.id]: r }))} />
        ))}
      </section>
      <SignOff approval={approval} ready={done === items.length} total={items.length} canEdit={canEdit} />
    </>
  );
}

function Decision({ item, answer, canEdit, onSaved }: {
  item: ApprovalItem; answer: DecisionResponse | null; canEdit: boolean; onSaved: (r: DecisionResponse) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(answer?.text ?? answer?.note ?? "");
  const [changing, setChanging] = useState(answer?.approved === false);
  const [editing, setEditing] = useState(!answer);

  const save = (r: DecisionResponse) =>
    start(async () => {
      setError(null);
      const res = await answerDecision(item.id, r);
      if (res.ok) { onSaved(r); setEditing(false); } else setError(res.error ?? "Couldn't save that.");
    });

  const state = answer
    ? <span className="dc-state"><Check size={14} />{answer.approved === false ? "Change requested" : "Answered"}</span>
    : <span className="dc-state todo">To decide</span>;

  return (
    <article className="dc" aria-label={item.label}>
      <div className="dc-h">
        <span className="dc-label">{item.label}</span>
        {item.tag && <span className="dc-tag">{item.tag}</span>}
        {state}
      </div>
      {item.detail && <p className="dc-detail">{item.detail}</p>}

      {item.kind === "choice" && (
        <div className="dc-opts" role="radiogroup" aria-label={item.label}>
          {item.options.map((o) => {
            const on = answer?.choice === o.label;
            return (
              <button key={o.label} type="button" role="radio" aria-checked={on} className="dc-opt" disabled={!canEdit || pending}
                onClick={() => save({ choice: o.label })}>
                <span className="grow"><b>{o.label}</b>{o.recommended && <span className="rec">Recommended</span>}{o.detail && <small>{o.detail}</small>}</span>
                <span className="tick">{on && <Check size={20} />}</span>
              </button>
            );
          })}
        </div>
      )}

      {item.kind === "approve" && (
        <>
          <div className="dc-actions">
            <button type="button" className={`dc-btn${answer?.approved === true ? " on" : ""}`} disabled={!canEdit || pending}
              onClick={() => { setChanging(false); save({ approved: true }); }}>
              {answer?.approved === true ? "Approved" : "Approve"}
            </button>
            <button type="button" className={`dc-btn${changing ? " on" : ""}`} disabled={!canEdit || pending}
              onClick={() => { setChanging(true); setEditing(true); }}>
              Request a change
            </button>
          </div>
          {changing && (canEdit && editing ? (
            <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) save({ approved: false, note: draft.trim() }); }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="sr-only" htmlFor={`note-${item.id}`}>What should change?</label>
              <textarea id={`note-${item.id}`} className="dc-field" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What should change?" maxLength={2000} />
              <button type="submit" className="dc-btn on" disabled={pending || !draft.trim()}>Send change request</button>
            </form>
          ) : answer?.note ? <div className="dc-answer">{answer.note}</div> : null)}
        </>
      )}

      {(item.kind === "text" || item.kind === "date") && (
        canEdit && editing ? (
          <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) save({ text: draft.trim() }); }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label className="sr-only" htmlFor={`text-${item.id}`}>{item.label}</label>
            {item.kind === "date"
              ? <input id={`text-${item.id}`} className="dc-field" type="date" value={draft} onChange={(e) => setDraft(e.target.value)} />
              : <textarea id={`text-${item.id}`} className="dc-field" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your answer" maxLength={2000} />}
            <button type="submit" className="dc-btn on" disabled={pending || !draft.trim()}>Save</button>
          </form>
        ) : answer?.text ? (
          <>
            <div className="dc-answer">{item.kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(answer.text) ? fmtDate(answer.text, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : answer.text}</div>
            {canEdit && <button type="button" className="ios-text-btn" style={{ alignSelf: "flex-start", fontSize: 15 }} onClick={() => setEditing(true)}>Edit</button>}
          </>
        ) : <div className="dc-answer" style={{ color: "var(--label-2)" }}>Not answered yet</div>
      )}

      {error && <p className="dc-err" role="alert">{error}</p>}
    </article>
  );
}

function SignOff({ approval, ready, total, canEdit }: { approval: Approval; ready: boolean; total: number; canEdit: boolean }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [signedAs, setSignedAs] = useState<string | null>(approval.signed_name);
  const signedOn = approval.signed_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  if (signedAs) {
    return (
      <section className="sign">
        <div className="done"><Check size={22} />Approved by {signedAs}</div>
        <p>Signed {fmtDate(signedOn, { month: "long", day: "numeric", year: "numeric" })}. Elevate has your answers and will take it from here.</p>
      </section>
    );
  }
  return (
    <section className="sign">
      <h3>Sign to approve</h3>
      <p>{ready ? "Type your full name. Signing approves the decisions above." : `Answer all ${total} decisions to sign.`}</p>
      <form onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await signApproval(approval.id, name);
          if (r.ok) setSignedAs(name.trim()); else setError(r.error ?? "Couldn't sign.");
        });
      }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label className="sr-only" htmlFor={`sign-${approval.id}`}>Full name</label>
        <input id={`sign-${approval.id}`} className="dc-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" disabled={!canEdit || !ready} maxLength={120} />
        <button type="submit" className="ios-btn" style={{ marginTop: 0 }} disabled={!canEdit || !ready || pending || name.trim().length < 2}>Approve and sign</button>
      </form>
      {error && <p className="dc-err" role="alert">{error}</p>}
    </section>
  );
}
