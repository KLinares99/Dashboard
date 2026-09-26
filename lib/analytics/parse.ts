import Papa from "papaparse";

/**
 * Turns an analytics export (GA4, Meta Business Suite, Google Business Profile,
 * or any spreadsheet with a date column) into daily metric values.
 *
 * Rules:
 * - Lines starting with "#" are comments (GA4 puts report metadata there).
 * - The date column is found by name first, then by content.
 * - Every other column where most values are numbers becomes a metric.
 * - Rows without a readable date (totals, blanks) are skipped.
 * - Several rows for the same date (a breakdown by page or campaign) are
 *   summed, except rates and averages, which are averaged.
 */

export type MetricPoint = { date: string; metric: string; value: number };

export type ParseResult = {
  points: MetricPoint[];
  metrics: string[];
  dateColumn: string;
  dateFrom: string;
  dateTo: string;
  skippedRows: number;
};

export class ParseError extends Error {}

const DATE_HEADER = /^(date|day|reporting starts|reporting start|start date|week|month|fecha)$/i;
export const RATE_HEADER = /(rate|%|avg|average|ctr|per |duration|position|frequency|cpm|cpc|cost per)/i;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

function validDate(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // e.g. Feb 30
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Returns an ISO date (YYYY-MM-DD) or null. */
export function parseDate(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return validDate(+m[1], +m[2], +m[3]); // GA4: 20260926
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) return validDate(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
    // US order (M/D/Y): all Elevate clients are US-based.
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return validDate(y, +m[1], +m[2]);
  }
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/))) {
    const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    return mo ? validDate(+m[3], mo, +m[2]) : null;
  }
  return null;
}

/** Returns a number or null. Accepts 1,234 / $12.50 / 4.5% / (12) negatives. */
export function parseNumber(raw: unknown): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || s === "--" || s === "-") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[$€£,\s%]/g, "");
  if (!/^-?\d*\.?\d+(e-?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export function parseAnalyticsCsv(text: string): ParseResult {
  const cleaned = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n")
    .trim();
  if (!cleaned) throw new ParseError("The file is empty.");

  const parsed = Papa.parse<Record<string, string>>(cleaned, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  const headers = (parsed.meta.fields ?? []).filter((h) => h && h.trim());
  if (!rows.length || headers.length < 2) {
    throw new ParseError("Couldn't find a table with a header row and at least two columns.");
  }

  const share = (col: string, test: (v: unknown) => boolean) => {
    const vals = rows.map((r) => r[col]).filter((v) => v != null && String(v).trim() !== "");
    return vals.length ? vals.filter(test).length / vals.length : 0;
  };

  const dateColumn =
    headers.find((h) => DATE_HEADER.test(h.trim()) && share(h, (v) => parseDate(v) !== null) >= 0.5) ??
    headers.find((h) => share(h, (v) => parseDate(v) !== null) >= 0.8);
  if (!dateColumn) {
    throw new ParseError("Couldn't find a date column. Export the report broken down by day.");
  }

  const metricCols = headers.filter(
    (h) => h !== dateColumn && share(h, (v) => parseNumber(v) !== null) >= 0.8,
  );
  if (!metricCols.length) throw new ParseError("Couldn't find any number columns to chart.");

  const sums = new Map<string, { total: number; count: number }>();
  let skippedRows = 0;
  for (const row of rows) {
    const date = parseDate(row[dateColumn]);
    if (!date) { skippedRows++; continue; }
    for (const col of metricCols) {
      const v = parseNumber(row[col]);
      if (v == null) continue;
      const key = `${col.trim()}\u0000${date}`;
      const cur = sums.get(key) ?? { total: 0, count: 0 };
      cur.total += v; cur.count += 1;
      sums.set(key, cur);
    }
  }

  const points: MetricPoint[] = [];
  for (const [key, { total, count }] of sums) {
    const [metric, date] = key.split("\u0000");
    const value = RATE_HEADER.test(metric) ? total / count : total;
    points.push({ metric, date, value: Math.round(value * 10000) / 10000 });
  }
  if (!points.length) throw new ParseError("No rows had both a date and a number.");

  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.metric.localeCompare(b.metric)));
  return {
    points,
    metrics: metricCols.map((c) => c.trim()),
    dateColumn,
    dateFrom: points[0].date,
    dateTo: points[points.length - 1].date,
    skippedRows,
  };
}

/** Best guess at where an export came from, used to pre-select the source. */
export function guessSource(filename: string, text: string): "ga4" | "meta" | "gbp" | "generic" {
  const head = text.slice(0, 2000).toLowerCase();
  const f = filename.toLowerCase();
  if (head.includes("# ") && (head.includes("analytics") || head.includes("property"))) return "ga4";
  if (f.includes("ga4") || head.includes("sessions") || head.includes("active users")) return "ga4";
  if (f.includes("meta") || f.includes("facebook") || f.includes("instagram") || head.includes("reach") || head.includes("impressions")) return "meta";
  if (f.includes("gbp") || f.includes("business profile") || head.includes("direction requests") || head.includes("calls")) return "gbp";
  return "generic";
}
