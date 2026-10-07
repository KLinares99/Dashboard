"use client";

import { useActionState, useState, useTransition } from "react";
import {
  type ActionResult, addEvent, recordPayment, addInvoice, addProspect, archiveClient, createClientRecord,
  deleteEvent, deleteInvoice, deleteProspect, deleteUpload, inviteClientUser, revokeClientUser,
  setEventDone, setInvoiceStatus, updateClientQuick, updateClientRecord, uploadAnalytics,
} from "@/app/app/actions";
import { INVOICE_LABEL, STATUS_LABEL, daysBetween, fmtDate, money } from "@/lib/format";
import type { AnalyticsUpload, Payment, Client, ClientStatus, EventItem, Invoice, Prospect } from "@/lib/types";
import { Icon } from "./Icon";
import { ConfirmDelete } from "./TaskList";

/** Runs a server action in a transition and keeps its message. */
function useRun() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) after?.();
    });
  return { pending, result, run, clear: () => setResult(null) };
}

function Result({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  if (!r.ok) return <div className="notice err" role="alert">{r.error}</div>;
  return r.message ? <div className="notice ok" role="status">{r.message}</div> : null;
}

// ---------------------------------------------------------------------------
// Client form (create + edit)
// ---------------------------------------------------------------------------
export function ClientForm({ client }: { client?: Client }) {
  const action = client ? updateClientRecord.bind(null, client.id) : createClientRecord;
  const [state, formAction, pending] = useActionState(action, null);
  const v = client;
  const p = client ? "edit" : "new";
  return (
    <form action={formAction} className="stack" style={{ gap: 16 }}>
      <div className="form-grid">
        <label className="field"><span>Business name</span><input id={`${p}-name`} className="input" name="name" required defaultValue={v?.name} /></label>
        <label className="field"><span>Contact person</span><input id={`${p}-contact_name`} className="input" name="contact_name" defaultValue={v?.contact_name ?? ""} /></label>
        <label className="field"><span>Contact email</span><input id={`${p}-contact_email`} className="input" name="contact_email" type="email" defaultValue={v?.contact_email ?? ""} /></label>
        <label className="field"><span>Color on the dashboard</span>
          <select id={`${p}-color`} className="input" name="color" defaultValue={v?.color ?? "blue"}>
            {["blue", "purple", "orange", "teal", "green", "pink"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </label>
        <label className="field"><span>Plan</span>
          <select id={`${p}-type`} className="input" name="type" defaultValue={v?.type ?? "retainer"}>
            <option value="retainer">Monthly retainer</option>
            <option value="project">One-time project</option>
            <option value="internal">Own brand (no billing)</option>
          </select>
        </label>
        <label className="field"><span>Price in dollars (monthly for retainers)</span>
          <input id={`${p}-price`} className="input" name="price" type="number" min="0" step="1" defaultValue={v ? v.price_cents / 100 : ""} />
        </label>
        <label className="field"><span>Status</span>
          <select id={`${p}-status`} className="input" name="status" defaultValue={v?.status ?? "active"}>
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="field"><span>Services (comma separated)</span><input id={`${p}-services`} className="input" name="services" defaultValue={v?.services.join(", ") ?? ""} placeholder="Social, Website, SEO" /></label>
        <label className="field wide"><span>Headline. Wrap one word in *stars* to make it blue.</span><input id={`${p}-headline`} className="input" name="headline" defaultValue={v?.headline ?? ""} placeholder="Getting *found*, on purpose." /></label>
        <label className="field wide"><span>Next step</span><input id={`${p}-next_step`} className="input" name="next_step" defaultValue={v?.next_step ?? ""} /></label>
        <label className="field wide"><span>About this client</span><textarea id={`${p}-summary`} className="input" name="summary" defaultValue={v?.summary ?? ""} /></label>
        <label className="field"><span>Google Drive folder link</span><input id={`${p}-drive`} className="input" name="drive_folder_id" defaultValue={v?.drive_folder_id ? `https://drive.google.com/drive/folders/${v.drive_folder_id}` : ""} placeholder="https://drive.google.com/drive/folders/…" /></label>
        <label className="field"><span>Notion page link</span><input id={`${p}-notion`} className="input" name="notion_url" type="url" defaultValue={v?.notion_url ?? ""} /></label>
      </div>
      <Result r={state} />
      <div className="form-actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : client ? "Save changes" : "Add client"}</button>
      </div>
    </form>
  );
}

export function ArchiveClient({ client }: { client: Client }) {
  const { run, result, pending } = useRun();
  const [asking, setAsking] = useState(false);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="muted" style={{ margin: 0 }}>Archiving hides {client.name} everywhere, including their portal. Nothing is deleted.</p>
      {asking ? (
        <div className="row-gap">
          <button className="btn danger" type="button" disabled={pending} onClick={() => run(() => archiveClient(client.id))}>Archive {client.name}</button>
          <button className="btn" type="button" onClick={() => setAsking(false)}>Keep</button>
        </div>
      ) : (
        <div><button className="btn danger" type="button" onClick={() => setAsking(true)}>Archive client</button></div>
      )}
      <Result r={result} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status + next step (quick edit on the overview)
// ---------------------------------------------------------------------------
export function QuickStatus({ client }: { client: Client }) {
  const { run, result, pending } = useRun();
  const [next, setNext] = useState(client.next_step ?? "");
  const [editing, setEditing] = useState(false);
  return (
    <div className="next-card">
      <div className="row-gap" style={{ justifyContent: "space-between" }}>
        <span className="label">Next step</span>
        <label className="sr-only" htmlFor={`status-${client.id}`}>Status</label>
        <select id={`status-${client.id}`} className="input" style={{ width: "auto", padding: "5px 10px", fontSize: 14 }}
          defaultValue={client.status} disabled={pending}
          onChange={(e) => run(() => updateClientQuick(client.id, { status: e.target.value as ClientStatus }))}>
          {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {editing ? (
        <form style={{ display: "flex", gap: 8, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); run(() => updateClientQuick(client.id, { next_step: next }), () => setEditing(false)); }}>
          <label className="sr-only" htmlFor={`next-${client.id}`}>Next step</label>
          <input id={`next-${client.id}`} className="input" value={next} onChange={(e) => setNext(e.target.value)} autoFocus maxLength={500} />
          <button className="btn primary small" type="submit" disabled={pending}>Save</button>
        </form>
      ) : (
        <p style={{ cursor: "text" }} onClick={() => setEditing(true)} title="Click to edit">{client.next_step || <span className="muted">Click to set the next step</span>}</p>
      )}
      <Result r={result && !result.ok ? result : null} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Events (dates)
// ---------------------------------------------------------------------------
export function EventRows({ events, clients, today, editable }: {
  events: EventItem[]; clients: Pick<Client, "id" | "name" | "color">[]; today: string; editable: boolean;
}) {
  const { run, pending } = useRun();
  const byId = new Map(clients.map((c) => [c.id, c]));
  return (
    <>
      {events.map((e) => {
        const c = byId.get(e.client_id);
        const diff = daysBetween(today, e.on_date);
        const st = e.done ? ["done", "Done"] : diff < 0 ? ["late", `${-diff}d late`] : diff === 0 ? ["urgent", "Today"] : ["upcoming", `In ${diff}d`];
        return (
          <div key={e.id} className={`ev${e.done ? " past" : ""}`}>
            <div className="date"><b>{Number(e.on_date.slice(8, 10))}</b><span>{fmtDate(e.on_date, { month: "short" })}</span></div>
            <div>
              <div className="t">{e.label}</div>
              {c && <div className="s"><i className="dot" style={{ "--c": `var(--c-${c.color})` } as React.CSSProperties} />{c.name}{editable && !e.visible_to_client ? " · internal" : ""}</div>}
            </div>
            <div className="row-gap ev-tools" style={{ gap: 6 }}>
              <span className={`pill p-${st[0]}`}>{st[1]}</span>
              {editable && (
                <>
                  <input type="checkbox" className="check" id={`ev-${e.id}`} checked={e.done} disabled={pending}
                    aria-label={e.done ? "Mark not done" : "Mark done"} onChange={(x) => run(() => setEventDone(e.id, x.target.checked))} />
                  <ConfirmDelete label={e.label} onConfirm={() => run(() => deleteEvent(e.id))} />
                </>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function AddEventForm({ clients, fixedClientId }: { clients: Pick<Client, "id" | "name">[]; fixedClientId?: string }) {
  const { run, result, pending } = useRun();
  const [clientId, setClientId] = useState(fixedClientId ?? clients[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [shared, setShared] = useState(true);
  const k = fixedClientId ?? "all";
  return (
    <form className="stack" style={{ gap: 12 }} onSubmit={(e) => {
      e.preventDefault();
      run(() => addEvent({ client_id: clientId, on_date: date, label, visible_to_client: shared }), () => { setLabel(""); setDate(""); });
    }}>
      <div className="form-grid">
        {!fixedClientId && (
          <label className="field"><span>Client</span>
            <select id={`ev-client-${k}`} className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="field"><span>Date</span><input id={`ev-date-${k}`} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label className="field wide"><span>What happens</span><input id={`ev-label-${k}`} className="input" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={200} placeholder="October reels go live" /></label>
      </div>
      <div className="row-gap" style={{ justifyContent: "space-between" }}>
        <label className="toggle"><input id={`ev-shared-${k}`} type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Client can see this date</label>
        <button className="btn primary" type="submit" disabled={pending}>Add date</button>
      </div>
      <Result r={result && !result.ok ? result : null} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
export function InvoiceRows({ invoices, clients, editable, showClient }: {
  invoices: Invoice[]; clients: Pick<Client, "id" | "name" | "color">[]; editable: boolean; showClient: boolean;
}) {
  const { run, pending, result } = useRun();
  const byId = new Map(clients.map((c) => [c.id, c]));
  if (!invoices.length) return <div className="panel-b empty">No invoices yet.</div>;
  return (
    <div className="tbl-wrap">
      {result && !result.ok && <div className="panel-b"><Result r={result} /></div>}
      <table style={{ minWidth: showClient ? 680 : 560 }}>
        <thead><tr>{showClient && <th>Client</th>}<th>Invoice</th><th>Dates</th><th className="r">Amount</th><th>Status</th>{editable && <th className="r"><span className="sr-only">Actions</span></th>}</tr></thead>
        <tbody>
          {invoices.map((i) => {
            const c = byId.get(i.client_id);
            return (
              <tr key={i.id}>
                {showClient && <td><span className="row-gap" style={{ gap: 8, color: "var(--ink)", fontWeight: 500 }}><i className="dot" style={{ "--c": `var(--c-${c?.color})` } as React.CSSProperties} />{c?.name}</span></td>}
                <td>{i.label}{i.pay_url && <div className="muted" style={{ fontSize: 13 }}>Has payment link</div>}</td>
                <td className="muted" style={{ fontSize: 14 }}>
                  {i.paid_on ? `Paid ${fmtDate(i.paid_on)}` : i.issued_on ? `Issued ${fmtDate(i.issued_on)}` : "Not issued"}
                </td>
                <td className="r">
                  <span className="num">{money(i.amount_cents)}</span>
                  {i.status === "sent" && i.paid_cents > 0 && <div className="muted num" style={{ fontSize: 13 }}>{money(i.paid_cents, { cents: true })} paid · {money(i.amount_cents - i.paid_cents, { cents: true })} left</div>}
                </td>
                <td><span className={`pill p-${i.status === "sent" && i.paid_cents > 0 ? "waiting" : i.status}`}>{i.status === "sent" && i.paid_cents > 0 ? "Part paid" : INVOICE_LABEL[i.status]}</span></td>
                {editable && (
                  <td className="r">
                    <span className="row-gap" style={{ gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      {i.status === "sent" && <button className="btn small" type="button" disabled={pending} onClick={() => run(() => setInvoiceStatus(i.id, "paid"))}>{i.paid_cents > 0 ? "Mark rest paid" : "Mark paid"}</button>}
                      {i.status === "draft" && <button className="btn small" type="button" disabled={pending} onClick={() => run(() => setInvoiceStatus(i.id, "sent"))}>Mark sent</button>}
                      {i.status === "paid" && <button className="btn small" type="button" disabled={pending} onClick={() => run(() => setInvoiceStatus(i.id, "sent"))}>Undo paid</button>}
                      <ConfirmDelete label={i.label} onConfirm={() => run(() => deleteInvoice(i.id))} />
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AddInvoiceForm({ clients, fixedClientId, defaultAmount }: { clients: Pick<Client, "id" | "name">[]; fixedClientId?: string; defaultAmount?: number }) {
  const { run, result, pending } = useRun();
  const [clientId, setClientId] = useState(fixedClientId ?? clients[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount / 100) : "");
  const [status, setStatus] = useState<"draft" | "sent" | "paid">("sent");
  const [issued, setIssued] = useState(new Date().toISOString().slice(0, 10));
  const [payUrl, setPayUrl] = useState("");
  const k = fixedClientId ?? "all";
  return (
    <form className="stack" style={{ gap: 12 }} onSubmit={(e) => {
      e.preventDefault();
      run(() => addInvoice({ client_id: clientId, label, amount, status, issued_on: issued, due_on: "", pay_url: payUrl }), () => { setLabel(""); setPayUrl(""); });
    }}>
      <div className="form-grid">
        {!fixedClientId && (
          <label className="field"><span>Client</span>
            <select id={`inv-client-${k}`} className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="field"><span>What it&apos;s for</span><input id={`inv-label-${k}`} className="input" value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="October 2026 retainer" /></label>
        <label className="field"><span>Amount ($)</span><input id={`inv-amount-${k}`} className="input" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
        <label className="field"><span>Status</span>
          <select id={`inv-status-${k}`} className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="draft">Draft (client can&apos;t see it)</option>
            <option value="sent">Sent, unpaid</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <label className="field"><span>Issued on</span><input id={`inv-issued-${k}`} className="input" type="date" value={issued} onChange={(e) => setIssued(e.target.value)} /></label>
        <label className="field wide"><span>Payment link (optional). The client gets a &ldquo;Pay&rdquo; button, e.g. your QuickBooks invoice link.</span><input id={`inv-pay-${k}`} className="input" type="url" value={payUrl} onChange={(e) => setPayUrl(e.target.value)} placeholder="https://" /></label>
      </div>
      <div className="form-actions"><button className="btn primary" type="submit" disabled={pending}>Add invoice</button></div>
      <Result r={result && !result.ok ? result : null} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Client logins
// ---------------------------------------------------------------------------
export function ClientAccess({ client, logins }: { client: Client; logins: { id: string; email: string; full_name: string | null }[] }) {
  const { run, result, pending } = useRun();
  const [email, setEmail] = useState(client.contact_email ?? "");
  const [name, setName] = useState("");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="list-rows">
        {logins.map((l) => (
          <div key={l.id}>
            <span><b style={{ fontWeight: 500 }}>{l.email}</b>{l.full_name ? <span className="muted"> · {l.full_name}</span> : null}</span>
            <ConfirmDelete label={l.email} text="Remove access" onConfirm={() => run(() => revokeClientUser(l.id))} />
          </div>
        ))}
        {!logins.length && <div className="empty">No one from {client.name} can sign in yet.</div>}
      </div>
      <form className="stack" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); run(() => inviteClientUser(client.id, email, name), () => setName("")); }}>
        <div className="form-grid">
          <label className="field"><span>Email</span><input id={`inv-email-${client.id}`} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="field"><span>Name (optional)</span><input id={`inv-name-${client.id}`} className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        </div>
        <div className="form-actions"><button className="btn primary" type="submit" disabled={pending}><Icon name="mail" size={18} />{pending ? "Sending…" : "Send portal invite"}</button></div>
      </form>
      <Result r={result} />
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        They get an email with a one-click link. After that they sign in at /login with the same email. They see three things: invoices due, their to-dos (which they can tick off), and the content in their Client Portal folder. They never see Elevate&apos;s own tasks, drafts or other clients.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics upload
// ---------------------------------------------------------------------------
export function UploadAnalytics({ clientId, uploads }: { clientId: string; uploads: AnalyticsUpload[] }) {
  const [state, formAction, pending] = useActionState(uploadAnalytics, null);
  const del = useRun();
  const SOURCE: Record<string, string> = { ga4: "Google Analytics 4", meta: "Meta (Facebook / Instagram)", gbp: "Google Business Profile", generic: "Other spreadsheet" };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <form action={formAction} className="stack" style={{ gap: 12 }}>
        <input type="hidden" name="client_id" value={clientId} />
        <div className="form-grid">
          <label className="field"><span>CSV export</span><input id={`up-file-${clientId}`} className="input" type="file" name="file" accept=".csv,text/csv" required /></label>
          <label className="field"><span>Where it came from</span>
            <select id={`up-source-${clientId}`} className="input" name="source" defaultValue="ga4">
              {Object.entries(SOURCE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Export the report broken down by day. Any file with a date column and number columns works. Uploading the same dates again replaces the old numbers.
        </p>
        <div className="form-actions"><button className="btn primary" type="submit" disabled={pending}><Icon name="upload" size={18} />{pending ? "Reading file…" : "Upload and chart"}</button></div>
        <Result r={state} />
      </form>
      {uploads.length > 0 && (
        <div className="list-rows">
          {uploads.map((u) => (
            <div key={u.id}>
              <span style={{ minWidth: 0 }}>
                <b style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{u.filename}</b>
                <span className="muted" style={{ display: "block", fontSize: 13 }}>
                  {SOURCE[u.source] ?? u.source} · {u.date_from && u.date_to ? `${fmtDate(u.date_from)} – ${fmtDate(u.date_to, { month: "short", day: "numeric", year: "numeric" })}` : ""} · {u.row_count} values
                </span>
              </span>
              <ConfirmDelete label={u.filename} onConfirm={() => del.run(() => deleteUpload(u.id))} />
            </div>
          ))}
        </div>
      )}
      <Result r={del.result && !del.result.ok ? del.result : null} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------
export function ProspectsManager({ prospects }: { prospects: Prospect[] }) {
  const { run, result, pending } = useRun();
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="stack">
      <div className="pgrid">
        {prospects.map((p) => (
          <article key={p.id} className="pcard">
            <div className="row-gap" style={{ justifyContent: "space-between" }}>
              <span className={`pill p-${p.status}`}>{STATUS_LABEL[p.status]}</span>
              <ConfirmDelete label={p.name} onConfirm={() => run(() => deleteProspect(p.id))} />
            </div>
            <h3>{p.name}</h3>
            {p.detail && <div className="muted">{p.detail}</div>}
            {p.note && <div>{p.note}</div>}
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="panel-h"><span className="label">Add a prospect</span></div>
        <form className="panel-b stack" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); run(() => addProspect({ name, detail, note }), () => { setName(""); setDetail(""); setNote(""); }); }}>
          <div className="form-grid">
            <label className="field"><span>Name</span><input id="pr-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></label>
            <label className="field"><span>Who they are</span><input id="pr-detail" className="input" value={detail} onChange={(e) => setDetail(e.target.value)} /></label>
            <label className="field wide"><span>Where it stands</span><input id="pr-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <div className="form-actions"><button className="btn primary" type="submit" disabled={pending}>Add prospect</button></div>
          <Result r={result && !result.ok ? result : null} />
        </form>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export function RecordPayment({ clientId, owed }: { clientId: string; owed: number }) {
  const { run, result, pending } = useRun();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  return (
    <form className="stack" style={{ gap: 12 }} onSubmit={(e) => {
      e.preventDefault();
      run(() => recordPayment({ client_id: clientId, amount, paid_on: date, method, reference }), () => { setAmount(""); setReference(""); });
    }}>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Applied to unpaid invoices oldest first. Part of an invoice can be paid. They owe {money(owed, { cents: owed % 100 !== 0 })} right now.
      </p>
      <div className="form-grid">
        <label className="field"><span>Amount received ($)</span><input id={`pay-amount-${clientId}`} className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
        <label className="field"><span>Paid on</span><input id={`pay-date-${clientId}`} className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label className="field"><span>How (optional)</span><input id={`pay-method-${clientId}`} className="input" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Apple Pay, check, Zelle" /></label>
        <label className="field"><span>Reference (optional)</span><input id={`pay-ref-${clientId}`} className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="QuickBooks #1094" /></label>
      </div>
      <div className="form-actions"><button className="btn primary" type="submit" disabled={pending || !owed}>Record payment</button></div>
      <Result r={result} />
    </form>
  );
}

export function PaymentRows({ payments }: { payments: Payment[] }) {
  if (!payments.length) return <div className="panel-b empty">No payments recorded yet.</div>;
  return (
    <div className="tbl-wrap">
      <table style={{ minWidth: 480 }}>
        <thead><tr><th>Paid on</th><th>How</th><th>Reference</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{fmtDate(p.paid_on, { month: "short", day: "numeric", year: "numeric" })}</td>
              <td className="muted">{p.method ?? "–"}</td>
              <td className="muted">{p.reference ?? "–"}</td>
              <td className="r"><span className="num">{money(p.amount_cents, { cents: p.amount_cents % 100 !== 0 })}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
