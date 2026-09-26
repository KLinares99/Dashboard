import { AddEventForm, EventRows } from "@/components/Managers";
import { TopBar } from "@/components/Shell";
import { loadWorkspace } from "@/lib/data";
import { fmtDate, todayISO } from "@/lib/format";
import type { EventItem } from "@/lib/types";

export const metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const ws = await loadWorkspace();
  const today = todayISO();
  // Group by month, with a "today" marker between past and future.
  const groups: { month: string; items: EventItem[]; todayBefore?: number }[] = [];
  for (const e of ws.events) {
    const m = fmtDate(e.on_date, { month: "long", year: "numeric" });
    let g = groups.at(-1);
    if (!g || g.month !== m) groups.push((g = { month: m, items: [] }));
    g.items.push(e);
  }
  const todayMonth = fmtDate(today, { month: "long", year: "numeric" });
  return (
    <>
      <TopBar eyebrow="Deadlines & drops" title="Schedule" />
      <main className="view">
        <section className="hero"><h2>Every date, <em>in order</em>.</h2><p>Content drops, deadlines and scheduling windows across all clients. Late items are flagged red.</p></section>
        <div className="cols">
          <section className="panel">
            {!ws.events.length && <div className="panel-b empty">No dates yet.</div>}
            {groups.map((g) => {
              const past = g.items.filter((e) => e.on_date < today);
              const future = g.items.filter((e) => e.on_date >= today);
              const marker = g.month === todayMonth || (past.length > 0 && future.length > 0);
              return (
                <div key={g.month}>
                  <div className="month">{g.month}</div>
                  <EventRows events={past} clients={ws.clients} today={today} editable />
                  {marker && <div className="today-line">TODAY · {fmtDate(today, { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}</div>}
                  <EventRows events={future} clients={ws.clients} today={today} editable />
                </div>
              );
            })}
          </section>
          <section className="panel">
            <div className="panel-h"><span className="label">Add a date</span></div>
            <div className="panel-b"><AddEventForm clients={ws.clients} /></div>
          </section>
        </div>
      </main>
    </>
  );
}
