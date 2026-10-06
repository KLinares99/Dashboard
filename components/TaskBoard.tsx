"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { createTask, updateTask } from "@/app/app/actions";
import { fmtDate } from "@/lib/format";
import type { Client, Task } from "@/lib/types";
import { Icon } from "./Icon";

export function TaskBoard({ tasks, clients, today, filter }: { tasks: Task[]; clients: Client[]; today: string; filter: string | null }) {
  const [items, apply] = useOptimistic(tasks, (s: Task[], p: { id: string; done: boolean }) => s.map((t) => (t.id === p.id ? { ...t, done: p.done } : t)));
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const byId = new Map(clients.map((c) => [c.id, c]));
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(filter ?? clients[0]?.id ?? "");
  const [flag, setFlag] = useState<"" | "urgent">("");
  const [adding, startAdd] = useTransition();

  const toggle = (t: Task, done: boolean) =>
    start(async () => {
      apply({ id: t.id, done });
      const r = await updateTask(t.id, { done });
      if (!r.ok) setError(r.error);
    });

  const open = items.filter((t) => !t.done);
  const overdue = (t: Task) => t.due_on && t.due_on < today;
  const cols: [string, string, Task[]][] = [
    ["Urgent", "p-urgent", open.filter((t) => t.flag === "urgent" || (overdue(t) && t.flag !== "blocked"))],
    ["Open", "p-upcoming", open.filter((t) => !t.flag && !overdue(t))],
    ["Blocked", "p-blocked", open.filter((t) => t.flag === "blocked")],
    ["Done", "p-done", items.filter((t) => t.done).sort((a, b) => ((a.done_at ?? "") < (b.done_at ?? "") ? 1 : -1))],
  ];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <form className="panel panel-b row-gap" onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        startAdd(async () => {
          const r = await createTask({ client_id: clientId, title, flag: flag || null });
          if (r.ok) setTitle(""); else setError(r.error);
        });
      }}>
        <label className="sr-only" htmlFor="board-title">New task</label>
        <input id="board-title" className="input" style={{ flex: "1 1 260px" }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" maxLength={300} />
        <label className="sr-only" htmlFor="board-client">Client</label>
        <select id="board-client" className="input" style={{ width: "auto", flex: "0 1 220px" }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="toggle"><input id="board-urgent" type="checkbox" checked={flag === "urgent"} onChange={(e) => setFlag(e.target.checked ? "urgent" : "")} /> Urgent</label>
        <button className="btn primary" type="submit" disabled={adding || !title.trim()}><Icon name="plus" size={18} />Add</button>
      </form>
      {error && <div className="notice err" role="alert">{error}</div>}
      <div className="board">
        {cols.map(([name, pill, list]) => {
          const shown = name === "Done" && !showAllDone ? list.slice(0, 5) : list;
          return (
            <section key={name} className="col" aria-label={name}>
              <div className="col-h"><span className={`pill ${pill}`}>{name}</span><span className="num muted" style={{ fontSize: 14 }}>{list.length}</span></div>
              {shown.map((t) => {
                const c = byId.get(t.client_id)!;
                return (
                  <div key={t.id} className={`tcard${t.done ? " done" : ""}`}>
                    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                      <input type="checkbox" className="check" id={`b-${t.id}`} checked={t.done} onChange={(e) => toggle(t, e.target.checked)} />
                      <span style={{ fontSize: 15, lineHeight: 1.35, textDecoration: t.done ? "line-through" : undefined, color: t.done ? "var(--faint)" : undefined }}>{t.title}</span>
                    </label>
                    <div className="row-gap" style={{ gap: 8, justifyContent: "space-between" }}>
                      <Link className="c" href={`/app/clients/${c.slug}?tab=tasks`}><i className="dot" style={{ "--c": `var(--c-${c.color})` } as React.CSSProperties} />{c.name}</Link>
                      {!t.done && t.due_on && <span className={`pill ${overdue(t) ? "p-late" : "p-upcoming"}`}>{fmtDate(t.due_on)}</span>}
                      {t.assignee === "client" && <span className="pill p-waiting">Client</span>}
                    </div>
                  </div>
                );
              })}
              {!list.length && <div className="empty" style={{ padding: 4 }}>None</div>}
              {name === "Done" && list.length > 5 && (
                <button className="seg" type="button" style={{ justifyContent: "center" }} onClick={() => setShowAllDone((v) => !v)}>{showAllDone ? "Show fewer" : `Show all ${list.length}`}</button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
