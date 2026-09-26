"use client";

import { useMemo, useRef, useState } from "react";
import { type Series, formatValue, niceTicks, summarize, toSeries } from "@/lib/analytics/series";
import { fmtDate } from "@/lib/format";
import type { Metric } from "@/lib/types";

const SOURCE: Record<string, string> = { ga4: "Website · GA4", meta: "Social · Meta", gbp: "Google Business Profile", generic: "Other" };
const WINDOWS = [[30, "30 days"], [90, "90 days"], [null, "All time"]] as const;

export function MetricsView({ metrics, emptyText }: { metrics: Metric[]; emptyText: string }) {
  const series = useMemo(() => toSeries(metrics), [metrics]);
  const [win, setWin] = useState<number | null>(30);
  const [asTable, setAsTable] = useState(false);
  const sources = [...new Set(series.map((s) => s.source))];
  const [source, setSource] = useState<string>(sources[0] ?? "");

  if (!series.length) return <div className="empty">{emptyText}</div>;

  const visible = series.filter((s) => s.source === (sources.includes(source) ? source : sources[0]));
  const end = visible.reduce((m, s) => (s.points.at(-1)!.date > m ? s.points.at(-1)!.date : m), "0000-00-00");
  const sums = visible.map((s) => ({ s, sum: summarize(s, end, win) }));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row-gap" style={{ justifyContent: "space-between" }}>
        <div className="row-gap">
          {sources.length > 1 && sources.map((src) => (
            <button key={src} type="button" className="seg" aria-pressed={src === (sources.includes(source) ? source : sources[0])} onClick={() => setSource(src)}>
              {SOURCE[src] ?? src}
            </button>
          ))}
          <span className="muted" style={{ fontSize: 14 }}>Data through {fmtDate(end, { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
        <div className="row-gap">
          <div className="segmented" role="group" aria-label="Time range">
            {WINDOWS.map(([d, l]) => (
              <button key={l} type="button" aria-pressed={win === d} onClick={() => setWin(d)}>{l}</button>
            ))}
          </div>
          <button type="button" className="btn small" onClick={() => setAsTable((v) => !v)}>{asTable ? "Show charts" : "Show table"}</button>
        </div>
      </div>

      {asTable ? (
        <DataTable sums={sums} />
      ) : (
        <div className="charts">
          {sums.map(({ s, sum }) => (
            <section key={s.source + s.metric} className="panel">
              <div className="panel-b">
                <div className="chart-head">
                  <div>
                    <div className="label">{s.metric}</div>
                    <div className="v">{formatValue(sum.value, s.isRate)}</div>
                  </div>
                  <Delta change={sum.change} days={win} />
                </div>
                {sum.points.length > 1 ? <LineChart series={s} points={sum.points} /> : <div className="empty">Not enough days in this range to draw a line.</div>}
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{s.isRate ? "Average" : "Total"} for {fmtDate(sum.start)} – {fmtDate(sum.end)}</div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Delta({ change, days }: { change: number | null; days: number | null }) {
  if (change == null || !days) return null;
  if (Math.abs(change) < 0.005) return <span className="delta muted">No change <span className="muted">vs prior {days}d</span></span>;
  const up = change >= 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {Math.abs(change * 100).toFixed(0)}% <span className="muted">vs prior {days}d</span>
    </span>
  );
}

function DataTable({ sums }: { sums: { s: Series; sum: ReturnType<typeof summarize> }[] }) {
  const dates = [...new Set(sums.flatMap(({ sum }) => sum.points.map((p) => p.date)))].sort().reverse();
  const lookup = new Map(sums.map(({ s, sum }) => [s.metric, new Map(sum.points.map((p) => [p.date, p.value]))]));
  return (
    <section className="panel">
      <div className="tbl-wrap" style={{ maxHeight: 520, overflowY: "auto" }}>
        <table>
          <thead><tr><th>Date</th>{sums.map(({ s }) => <th key={s.metric} className="r">{s.metric}</th>)}</tr></thead>
          <tbody>
            {dates.map((d) => (
              <tr key={d}>
                <td>{fmtDate(d, { weekday: "short", month: "short", day: "numeric" })}</td>
                {sums.map(({ s }) => <td key={s.metric} className="r num">{formatValue(lookup.get(s.metric)?.get(d) ?? null, s.isRate)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const W = 560, H = 190, PL = 44, PR = 12, PT = 12, PB = 26;

export function LineChart({ series, points }: { series: Series; points: { date: string; value: number }[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const t = (d: string) => new Date(d + "T00:00:00Z").getTime();
  const t0 = t(points[0].date), t1 = t(points.at(-1)!.date);
  const vals = points.map((p) => p.value);
  const ticks = niceTicks(Math.max(...vals), Math.min(...vals));
  const yMin = ticks[0], yMax = ticks.at(-1)!;
  const x = (d: string) => PL + ((t(d) - t0) / Math.max(t1 - t0, 1)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PT - PB);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = `${line}L${x(points.at(-1)!.date).toFixed(1)},${y(Math.max(yMin, 0))}L${x(points[0].date).toFixed(1)},${y(Math.max(yMin, 0))}Z`;
  const xLabels = [0, 0.33, 0.66, 1].map((f) => points[Math.round(f * (points.length - 1))]).filter((p, i, a) => a.findIndex((q) => q.date === p.date) === i);
  const last = points.at(-1)!;
  const tick = (v: number) => (series.isRate && yMax <= 1 ? `${Math.round(v * 100)}%` : Math.abs(v) >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i; });
    setHover(best);
  };
  const hp = hover != null ? points[hover] : null;

  return (
    <div className="chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${series.metric} from ${fmtDate(points[0].date)} to ${fmtDate(last.date)}`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: "pan-y" }}>
        <g className="grid">{ticks.map((v) => <line key={v} x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} />)}</g>
        <g className="axis">
          {ticks.map((v) => <text key={v} x={PL - 8} y={y(v) + 4} textAnchor="end">{tick(v)}</text>)}
          {xLabels.map((p, i) => (
            <text key={p.date} x={x(p.date)} y={H - 6} textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}>{fmtDate(p.date)}</text>
          ))}
        </g>
        <path className="area" d={area} />
        <path className="line" d={line} />
        {hp && <line className="cross" x1={x(hp.date)} x2={x(hp.date)} y1={PT} y2={H - PB} />}
        <circle className="endpoint" cx={x((hp ?? last).date)} cy={y((hp ?? last).value)} r={5} />
        <rect x={PL} y={0} width={W - PL - PR} height={H} fill="transparent" />
      </svg>
      {hp && (
        <div className="tip" style={{ left: `${(x(hp.date) / W) * 100}%`, top: `${(y(hp.value) / H) * 100}%` }}>
          {fmtDate(hp.date, { weekday: "short", month: "short", day: "numeric" })} · <b>{formatValue(hp.value, series.isRate)}</b>
        </div>
      )}
    </div>
  );
}
