import "server-only";
import { JWT } from "google-auth-library";

/**
 * Read-only Google Drive access through a service account.
 * Each client's folder is shared (Viewer) with the service account's email,
 * so nothing else in Elevate's Drive is reachable.
 */

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  thumbnailLink?: string;
  size?: string;
};

export const FOLDER = "application/vnd.google-apps.folder";

let jwt: JWT | null = null;
export function driveConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim());
}
export function serviceAccountEmail(): string | null {
  try {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "").client_email ?? null;
  } catch {
    return null;
  }
}

async function token(): Promise<string> {
  if (!jwt) {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("Google Drive isn't connected yet.");
    const key = JSON.parse(raw);
    jwt = new JWT({ email: key.client_email, key: key.private_key, scopes: ["https://www.googleapis.com/auth/drive.readonly"] });
  }
  const { token: t } = await jwt.getAccessToken();
  if (!t) throw new Error("Couldn't get a Google access token.");
  return t;
}

async function api(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  Object.entries({ supportsAllDrives: "true", ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404) throw new DriveError("Folder not found, or it isn't shared with the service account.", 404);
    throw new DriveError(`Google Drive error ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  return res.json();
}

export class DriveError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}

const ID = /^[A-Za-z0-9_-]{10,}$/;

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  if (!ID.test(folderId)) throw new DriveError("Invalid folder.", 400);
  const out: DriveFile[] = [];
  let pageToken = "";
  do {
    const data = await api("files", {
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, thumbnailLink, size)",
      orderBy: "folder, modifiedTime desc",
      pageSize: "200",
      includeItemsFromAllDrives: "true",
      ...(pageToken ? { pageToken } : {}),
    });
    out.push(...data.files);
    pageToken = data.nextPageToken ?? "";
  } while (pageToken && out.length < 600);
  return out;
}

export async function getFile(fileId: string): Promise<DriveFile & { parents?: string[] }> {
  if (!ID.test(fileId)) throw new DriveError("Invalid file.", 400);
  return api(`files/${fileId}`, { fields: "id, name, mimeType, modifiedTime, webViewLink, thumbnailLink, size, parents" });
}

/** True if fileId is rootId or sits somewhere below it (max 6 levels). */
export async function isInside(fileId: string, rootId: string): Promise<boolean> {
  let current = fileId;
  for (let depth = 0; depth < 7; depth++) {
    if (current === rootId) return true;
    const f = await getFile(current);
    const parent = f.parents?.[0];
    if (!parent) return false;
    current = parent;
  }
  return false;
}

/** Streams file bytes (images, video, PDF). Forwards Range for video seeking. */
export async function fetchMedia(fileId: string, range?: string | null) {
  const headers: Record<string, string> = { Authorization: `Bearer ${await token()}` };
  if (range) headers.Range = range;
  return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers, cache: "no-store" });
}

export async function fetchThumbnail(file: DriveFile, size = 600) {
  if (!file.thumbnailLink) return null;
  const url = file.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
  return fetch(url, { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
}

export function kind(mime: string): "folder" | "image" | "video" | "pdf" | "doc" | "other" {
  if (mime === FOLDER) return "folder";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("application/vnd.google-apps.")) return "doc";
  return "other";
}

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

/**
 * Picks what the client sees as "this month":
 *  1. a subfolder named for the current month, else
 *  2. loose files at the top of the folder (newest first), else
 *  3. the most recent month folder.
 * Every other folder is listed as an earlier month.
 */
export function pickThisMonth(items: DriveFile[], today: string) {
  const [ty, tm] = today.split("-").map(Number);
  const folders = items.filter((f) => f.mimeType === FOLDER);
  const files = items.filter((f) => f.mimeType !== FOLDER);
  const dated = folders
    .map((f) => ({ f, m: monthOf(f.name) }))
    .map(({ f, m }) => ({ f, key: m ? (m.year ?? (m.month <= tm ? ty : ty - 1)) * 12 + m.month : -1 }));
  const nowKey = ty * 12 + tm;
  const current = dated.find((d) => d.key === nowKey)?.f ?? null;
  const sorted = dated.filter((d) => d.f !== current).sort((a, b) => b.key - a.key || b.f.modifiedTime.localeCompare(a.f.modifiedTime));
  if (current) return { folder: current, files: null, earlier: sorted.map((d) => d.f), fallback: false };
  if (files.length) return { folder: null, files, earlier: sorted.map((d) => d.f), fallback: false };
  const latest = sorted.find((d) => d.key > 0 && d.key < nowKey)?.f ?? null;
  return { folder: latest, files: null, earlier: sorted.filter((d) => d.f !== latest).map((d) => d.f), fallback: Boolean(latest) };
}
