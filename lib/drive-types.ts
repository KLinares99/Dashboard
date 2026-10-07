// Shared Drive types and pure helpers (no server-only imports).

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  thumbnailLink?: string;
  size?: string;
  parents?: string[];
};

// ---------------------------------------------------------------------------
// Month folders: "October 2026", "Octubre 2026", "2026-10", "10 - October"…
// ---------------------------------------------------------------------------
const MONTH_NAMES: [number, RegExp][] = [
  [1, /\b(jan(uary)?|ene(ro)?)\b/i], [2, /\b(feb(ruary)?|feb(rero)?)\b/i], [3, /\b(mar(ch)?|mar(zo)?)\b/i],
  [4, /\b(apr(il)?|abr(il)?)\b/i], [5, /\b(may(o)?)\b/i], [6, /\b(june?|jun(io)?)\b/i],
  [7, /\b(july?|jul(io)?)\b/i], [8, /\b(aug(ust)?|ago(sto)?)\b/i], [9, /\b(sep(t(ember)?)?|sep(tiembre)?|set(iembre)?)\b/i],
  [10, /\b(oct(ober)?|oct(ubre)?)\b/i], [11, /\b(nov(ember)?|nov(iembre)?)\b/i], [12, /\b(dec(ember)?|dic(iembre)?)\b/i],
];

/** Reads a month (and year, if present) from a folder name. */
export function monthOf(name: string): { month: number; year: number | null } | null {
  const year = name.match(/\b(20\d{2})\b/)?.[1];
  const iso = name.match(/\b(20\d{2})[-_. /](0?[1-9]|1[0-2])\b/);
  if (iso) return { year: +iso[1], month: +iso[2] };
  for (const [m, re] of MONTH_NAMES) if (re.test(name)) return { month: m, year: year ? +year : null };
  return null;
}

