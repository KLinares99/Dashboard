import Link from "next/link";
import { TopBar } from "@/components/Shell";
import { TaskBoard } from "@/components/TaskBoard";
import { loadWorkspace } from "@/lib/data";
import { todayISO } from "@/lib/format";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  const ws = await loadWorkspace();
  const sel = ws.clients.find((c) => c.slug === client) ?? null;
  const tasks = sel ? ws.tasks.filter((t) => t.client_id === sel.id) : ws.tasks;
  return (
    <>
      <TopBar eyebrow="Across all clients" title="Tasks" />
      <main className="view">
        <nav className="row-gap" aria-label="Filter by client">
          <Link className="seg" href="/app/tasks" aria-current={!sel ? "page" : undefined}>All clients</Link>
          {ws.clients.map((c) => (
            <Link key={c.id} className="seg" href={`/app/tasks?client=${c.slug}`} aria-current={sel?.id === c.id ? "page" : undefined}>
              <i className="dot" style={{ "--c": `var(--c-${c.color})` } as React.CSSProperties} />{c.name}
            </Link>
          ))}
        </nav>
        <TaskBoard key={sel?.id ?? "all"} tasks={tasks} clients={ws.clients} today={todayISO()} filter={sel?.id ?? null} />
      </main>
    </>
  );
}
