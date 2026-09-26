import { RATE_HEADER } from "./parse";
import type { Metric } from "@/lib/types";

export type Series = { metric: string; source: string; isRate: boolean; points: { date: string; value: number }[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);
export const shiftISO = (s: string, days: number) => {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};

/** Groups raw metric rows into one series per source + metric. */
export function toSeries(rows: Metric[]): Series[] {
  const map = new Map<string, Series>();
  for (const r of rows) {
    const key = `${r.source}\u0000${r.metric}`;
    let s = map.get(key);
    if (!s) map.set(key, (s = { metric: r.metric, source: r.source, isRate: RATE_HEADER.test(r.metric), points: [] }));
    s.points.push({ date: r.on_date, value: Number(r.value) });
  }
  for (const s of map.values()) s.points.sort((a, b) => (a.date < b.date ? -1 : 1));
  return [...map.values()].sort((a, b) => a.source.localeCompare(b.source) || b.points.length - a.points.length);
}

/**
 * Summary for a window ending at `end` (inclusive), compared with the
 * window of the same length right before it. Counts are summed, rates averaged.
 */
export function summarize(s: Series, end: string, days: number | null) {
  const start = days ? shiftISO(end, -(days - 1)) : s.points[0]?.date ?? end;
  const prevEnd = shiftISO(start, -1);
  const prevStart = days ? shiftISO(prevEnd, -(days - 1)) : null;
  const inWin = s.points.filter((p) => p.date >= start && p.date <= end);
  const inPrev = prevStart ? s.points.filter((p) => p.date >= prevStart && p.date <= prevEnd) : [];
  const agg = (ps: { value: number }[]) =>
    ps.length ? (s.isRate ? ps.reduce((a, p) => a + p.value, 0) / ps.length : ps.reduce((a, p) => a + p.value, 0)) : null;
  const value = agg(inWin);
  const prev = agg(inPrev);
  const change = value != null && prev != null && prev !== 0 ? (value - prev) / Math.abs(prev) : null;
  return { points: inWin, value, prev, change, start, end };
}

export function formatValue(v: number | null, isRate: boolean) {
  if (v == null) return "–";
  if (isRate && Math.abs(v) <= 1) return (v * 100).toFixed(1) + "%";
  if (isRate) return v.toFixed(v < 10 ? 2 : 1);
  if (Math.abs(v) >= 10000) return Math.round(v).toLocaleString("en-US");
  return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** Round axis ticks: 0 .. a "nice" max, in 4 steps. */
export function niceTicks(max: number, min = 0): number[] {
  const lo = Math.min(0, min);
  const span = Math.max(max - lo, 1e-9);
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const bottom = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = bottom; v <= top + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
