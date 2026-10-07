"use client";

import { useOptimistic, useState, useTransition } from "react";
import { clearDoneTasks, createTask, deleteTask, updateTask } from "@/app/app/actions";
import { fmtDate } from "@/lib/format";
import type { Task, TaskAssignee, TaskFlag } from "@/lib/types";
import { Icon } from "./Icon";

/** One owner's list: Elevate's own work, or the client's action items. */
type Props = { clientId: string; tasks: Task[]; editable: boolean; today: string; assignee?: TaskAssignee };
type Op =
  | { kind: "toggle"; id: string; done: boolean }
  | { kind: "patch"; id: string; patch: Partial<Task> }
  | { kind: "delete"; id: string }
  | { kind: "clear"; ids: string[] }
  | { kind: "add"; task: Task };

export function TaskList({ clientId, tasks, editable, today, assignee = "elevate" }: Props) {
  const [optimistic, apply] = useOptimistic(tasks, (state: Task[], op: Op) => {
    switch (op.kind) {
      case "toggle": return state.map((t) => (t.id === op.id ? { ...t, done: op.done } : t));
      case "patch": return state.map((t) => (t.id === op.id ? { ...t, ...op.patch } : t));
      case "delete": return state.filter((t) => t.id !== op.id);
      case "clear": return state.filter((t) => !op.ids.includes(t.id));
      case "add": return [...state, op.task];
    }
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const run = (op: Op, fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      apply(op);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
    });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    const temp: Task = {
      id: "temp-" + Date.now(), client_id: clientId, title, notes: null, done: false, done_at: null,
      flag: null, due_on: null, assignee, position: Date.now(), created_at: new Date().toISOString(),
    };
    run({ kind: "add", task: temp }, () => createTask({ client_id: clientId, title, assignee }));
  };

  const open = optimistic.filter((t) => !t.done);
  const done = optimistic.filter((t) => t.done);
  const [showDone, setShowDone] = useState(done.length <= 5);
  // Tasks ticked off in this visit stay on screen (crossed out) even when completed ones are collapsed.
  const [justDone, setJustDone] = useState<Set<string>>(() => new Set());

  return (
    <div>
      {editable && (
        <form className="add-task" onSubmit={add}>
          <label className="sr-only" htmlFor={`new-task-${clientId}`}>New task</label>
          <input id={`new-task-${clientId}`} className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={assignee === "client" ? "Add something the client needs to do" : "Add a task, then press Enter"} maxLength={300} />
          <button className="btn primary" type="submit" disabled={!newTitle.trim()}><Icon name="plus" size={18} /><span>Add</span></button>
        </form>
      )}
      {error && <div className="notice err" role="alert" style={{ marginBottom: 10 }}>{error}</div>}
      {!optimistic.length && <div className="empty">{assignee === "client" ? "Nothing for the client to do." : "No tasks yet."}</div>}
      <ul className="task-list" aria-busy={pending}>
        {[...open, ...(showDone ? done : done.filter((t) => justDone.has(t.id)))].map((t) =>
          editing === t.id ? (
            <TaskEditor key={t.id} task={t} onCancel={() => setEditing(null)} onSave={(patch) => {
              setEditing(null);
              run({ kind: "patch", id: t.id, patch }, () => updateTask(t.id, patch));
            }} />
          ) : (
            <li key={t.id} className={`task${t.done ? " done" : ""}`}>
              <input type="checkbox" className="check" id={`t-${t.id}`} checked={t.done} disabled={!editable || t.id.startsWith("temp-")}
                aria-label={t.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                onChange={(e) => {
                  const next = e.target.checked;
                  if (next) setJustDone((s) => new Set(s).add(t.id));
                  run({ kind: "toggle", id: t.id, done: next }, () => updateTask(t.id, { done: next }));
                }} />
              <div>
                <div className="title" onDoubleClick={() => editable && setEditing(t.id)}>{t.title}</div>
                <TaskMeta task={t} today={today} />
              </div>
              {editable && !t.id.startsWith("temp-") && (
                <div className="tools">
                  <button className="icon-btn" type="button"
                    title={t.assignee === "client" ? "Move to Elevate's tasks" : "Move to the client's to-dos"}
                    aria-label={t.assignee === "client" ? "Move to Elevate's tasks" : "Move to the client's to-dos"}
                    onClick={() => {
                      const next: TaskAssignee = t.assignee === "client" ? "elevate" : "client";
                      run({ kind: "delete", id: t.id }, () => updateTask(t.id, { assignee: next }));
                    }}>
                    <Icon name={t.assignee === "client" ? "home" : "user"} size={18} />
                  </button>
                  <button className="icon-btn" type="button" aria-label="Edit task" title="Edit" onClick={() => setEditing(t.id)}><Icon name="edit" size={18} /></button>
                  <ConfirmDelete label={t.title} onConfirm={() => run({ kind: "delete", id: t.id }, () => deleteTask(t.id))} />
                </div>
              )}
            </li>
          ),
        )}
      </ul>
      {(done.length > 5 || (editable && done.length > 0)) && (
        <div className="row-gap" style={{ marginTop: 10, gap: 8 }}>
          {done.length > 5 && (
            <button className="btn small" type="button" onClick={() => setShowDone((v) => !v)}>
              {showDone ? "Hide completed" : `Show all ${done.length} completed`}
            </button>
          )}
          {editable && done.length > 0 && (
            <ClearDone count={done.length} onConfirm={() => {
              const ids = done.filter((t) => !t.id.startsWith("temp-")).map((t) => t.id);
              run({ kind: "clear", ids }, () => clearDoneTasks(ids));
            }} />
          )}
        </div>
      )}
    </div>
  );
}

function TaskMeta({ task: t, today }: { task: Task; today: string }) {
  const overdue = !t.done && t.due_on && t.due_on < today;
  const bits: React.ReactNode[] = [];
  if (!t.done && t.flag) bits.push(<span key="f" className={`pill p-${t.flag}`}>{t.flag}</span>);
  if (t.due_on) bits.push(<span key="d" className={overdue ? "pill p-late" : ""}>{overdue ? "Overdue · " : "Due "}{fmtDate(t.due_on)}</span>);
  if (t.notes) bits.push(<span key="n">{t.notes}</span>);
  return bits.length ? <div className="meta">{bits}</div> : null;
}

function TaskEditor({ task, onSave, onCancel }: { task: Task; onSave: (p: Partial<Task>) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [flag, setFlag] = useState<TaskFlag | "">(task.flag ?? "");
  const [due, setDue] = useState(task.due_on ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [owner, setOwner] = useState<TaskAssignee>(task.assignee);
  const id = `edit-${task.id}`;
  return (
    <li>
      <form className="task-edit" onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({ title: title.trim(), flag: flag || null, due_on: due || null, notes: notes.trim() || null, assignee: owner });
      }} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
        <label className="sr-only" htmlFor={`${id}-title`}>Task</label>
        <input id={`${id}-title`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={300} />
        <label className="sr-only" htmlFor={`${id}-notes`}>Notes</label>
        <input id={`${id}-notes`} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" maxLength={2000} />
        <div className="opts">
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span>Priority</span>
            <select id={`${id}-flag`} className="input" value={flag} onChange={(e) => setFlag(e.target.value as TaskFlag | "")}>
              <option value="">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span>Due</span>
            <input id={`${id}-due`} type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span>Who</span>
            <select id={`${id}-owner`} className="input" value={owner} onChange={(e) => setOwner(e.target.value as TaskAssignee)}>
              <option value="elevate">Elevate</option>
              <option value="client">Client (shows in their portal)</option>
            </select>
          </label>
          <span style={{ flex: 1 }} />
          <button className="btn small" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn small primary" type="submit">Save</button>
        </div>
      </form>
    </li>
  );
}

export function ConfirmDelete({ label, onConfirm, text = "Delete" }: { label: string; onConfirm: () => void; text?: string }) {
  const [asking, setAsking] = useState(false);
  if (asking)
    return (
      <span className="row-gap" style={{ gap: 4 }}>
        <button className="btn small danger" type="button" onClick={() => { setAsking(false); onConfirm(); }}>{text}</button>
        <button className="btn small" type="button" onClick={() => setAsking(false)}>Keep</button>
      </span>
    );
  return (
    <button className="icon-btn danger" type="button" aria-label={`${text} "${label}"`} title={text} onClick={() => setAsking(true)}>
      <Icon name="trash" size={18} />
    </button>
  );
}

/** "Clear 4 completed", then asks once before deleting them for good. */
export function ClearDone({ count, onConfirm }: { count: number; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (asking)
    return (
      <span className="row-gap" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 14 }}>Delete {count} completed for good?</span>
        <button className="btn small danger" type="button" onClick={() => { setAsking(false); onConfirm(); }}>Delete {count}</button>
        <button className="btn small" type="button" onClick={() => setAsking(false)}>Keep</button>
      </span>
    );
  return (
    <button className="btn small" type="button" onClick={() => setAsking(true)}>
      <Icon name="trash" size={16} />Clear {count} completed
    </button>
  );
}
