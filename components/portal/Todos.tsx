"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setMyTaskDone } from "@/app/portal/actions";
import { fmtDate } from "@/lib/format";
import type { Task } from "@/lib/types";

/** The client's action items, Reminders style. Ticked items stay visible until the next visit. */
export function Todos({ tasks, today, interactive }: { tasks: Task[]; today: string; interactive: boolean }) {
  const [items, apply] = useOptimistic(tasks, (s: Task[], p: { id: string; done: boolean }) =>
    s.map((t) => (t.id === p.id ? { ...t, done: p.done } : t)));
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [keep] = useState(() => new Set(tasks.filter((t) => !t.done).map((t) => t.id)));
  const [showDone, setShowDone] = useState(false);

  const visible = items.filter((t) => keep.has(t.id) || showDone);
  const doneEarlier = items.filter((t) => t.done && !keep.has(t.id)).length;

  const toggle = (t: Task, done: boolean) =>
    start(async () => {
      setError(null);
      apply({ id: t.id, done });
      const r = await setMyTaskDone(t.id, done);
      if (!r.ok) setError(r.error ?? "Couldn't save that.");
    });

  return (
    <>
      <div className="ios-card">
        {visible.length ? (
          visible.map((t) => {
            const late = !t.done && t.due_on && t.due_on < today;
            return (
              <label key={t.id} className={`ios-todo${t.done ? " done" : ""}`} htmlFor={`todo-${t.id}`}>
                <input id={`todo-${t.id}`} type="checkbox" className="ios-check" checked={t.done} disabled={!interactive}
                  onChange={(e) => toggle(t, e.target.checked)} aria-label={t.title} />
                <span className="t">
                  {t.title}
                  {(t.notes || t.due_on) && (
                    <small>
                      {t.due_on && <span className={late ? "due" : ""}>{late ? "Was due " : "Due "}{fmtDate(t.due_on, { weekday: "short", month: "short", day: "numeric" })}</span>}
                      {t.due_on && t.notes && " · "}
                      {t.notes}
                    </small>
                  )}
                </span>
              </label>
            );
          })
        ) : (
          <div className="ios-empty">
            <span className="glyph" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <b>You&apos;re all caught up</b>
            Nothing needs you right now.
          </div>
        )}
      </div>
      {error && <p className="ios-foot" role="alert" style={{ color: "var(--red)" }}>{error}</p>}
      {doneEarlier > 0 && (
        <p className="ios-foot">
          <button type="button" className="ios-text-btn" style={{ fontSize: 13 }} onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide completed" : `Show ${doneEarlier} completed`}
          </button>
        </p>
      )}
    </>
  );
}
