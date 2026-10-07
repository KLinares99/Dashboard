import "server-only";
import { JWT } from "google-auth-library";

/**
 * Read-only Google Drive access through a service account.
 * Each client's folder is shared (Viewer) with the service account's email,
 * so nothing else in Elevate's Drive is reachable.
 */

export type { DriveFile } from "./drive-types";
import type { DriveFile } from "./drive-types";

export const FOLDER = "application/vnd.google-apps.folder";

let jwt: JWT | null = null;
// Tests can point the app at a local fake Drive (e2e/fake-drive.mjs).
const API = process.env.DRIVE_API_BASE ?? "https://www.googleapis.com/drive/v3";

export function driveConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || process.env.DRIVE_TEST_TOKEN);
}
export function serviceAccountEmail(): string | null {
  try {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "").client_email ?? null;
  } catch {
    return null;
  }
}

async function token(): Promise<string> {
  if (process.env.DRIVE_TEST_TOKEN) return process.env.DRIVE_TEST_TOKEN;
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
  const url = new URL(`${API}/${path}`);
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
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, thumbnailLink, size, parents)",
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

// Short cache: a page of thumbnails checks the same parent folders many times.
const fileCache = new Map<string, { at: number; file: DriveFile }>();
const CACHE_MS = 5 * 60 * 1000;

export async function getFile(fileId: string): Promise<DriveFile> {
  if (!ID.test(fileId)) throw new DriveError("Invalid file.", 400);
  const hit = fileCache.get(fileId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.file;
  const file: DriveFile = await api(`files/${fileId}`, { fields: "id, name, mimeType, modifiedTime, webViewLink, thumbnailLink, size, parents" });
  if (fileCache.size > 2000) fileCache.clear();
  fileCache.set(fileId, { at: Date.now(), file });
  return file;
}

/** Direct children of several folders in as few requests as possible. */
export async function listChildrenOf(folderIds: string[]): Promise<Map<string, DriveFile[]>> {
  const out = new Map<string, DriveFile[]>(folderIds.map((id) => [id, []]));
  const ids = folderIds.filter((id) => ID.test(id));
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    let pageToken = "";
    do {
      const data = await api("files", {
        q: `(${chunk.map((id) => `'${id}' in parents`).join(" or ")}) and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, thumbnailLink, size, parents)",
        pageSize: "1000",
        includeItemsFromAllDrives: "true",
        ...(pageToken ? { pageToken } : {}),
      });
      for (const f of data.files as DriveFile[]) {
        for (const p of f.parents ?? []) out.get(p)?.push(f);
        if (!fileCache.has(f.id)) fileCache.set(f.id, { at: Date.now(), file: f });
      }
      pageToken = data.nextPageToken ?? "";
    } while (pageToken);
  }
  return out;
}

/** Text of a small text file (captions). */
export async function readText(fileId: string, maxBytes = 20000): Promise<string> {
  const res = await fetchMedia(fileId);
  if (!res.ok) return "";
  return (await res.text()).slice(0, maxBytes);
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
  return fetch(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`, { headers, cache: "no-store" });
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

export { monthOf } from "./drive-types";
