/**
 * Turns a client's "Client Portal" Drive folder into posts for the portal.
 *
 * Expected shape (any of these work):
 *   Client Portal/
 *     October Carousels/ 10.14.26 - Carousel (Title)/ slides…, caption.txt
 *     October Reels/     10.02.26/ cover.png, Reel 01/ video.mp4
 *     October Statics/   10.12.26 - Static (Title).png
 *     October 2026/      (everything for the month in one folder)
 *
 * A file inside a month folder is one post. A folder inside a month folder
 * is one post made of everything in it (two levels deep): a carousel's
 * slides, or a reel's video and cover. A .txt file in a post is its caption.
 */
import { monthOf, type DriveFile } from "./drive-types";

export type PostType = "carousel" | "reel" | "static";
export type Post = {
  id: string;            // the post folder, or the file for single-file posts
  isFolder: boolean;
  title: string;
  date: string | null;   // ISO, from the name
  type: PostType;
  cover: DriveFile | null;
  media: DriveFile[];    // images and videos, in name order
  captionFile: DriveFile | null;
};
export type MonthGroup = { key: number; year: number; month: number; folders: DriveFile[] };

const FOLDER = "application/vnd.google-apps.folder";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (g: { year: number; month: number }) => `${MONTHS[g.month - 1]} ${g.year}`;
export const monthParam = (g: { year: number; month: number }) => `${g.year}-${String(g.month).padStart(2, "0")}`;

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
const isMedia = (f: DriveFile) => f.mimeType.startsWith("image/") || f.mimeType.startsWith("video/");

/** "10.14.26 - Carousel (What You Won't Say Out Loud)" → date, type, title. */
export function parsePostName(raw: string, defaultYear: number): { date: string | null; type: PostType | null; title: string } {
  let name = raw.replace(/\.[a-z0-9]{2,4}$/i, "").trim();
  let date: string | null = null;
  const m = name.match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?(?=\D|$)/);
  if (m) {
    const mo = +m[1], d = +m[2];
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : defaultYear;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    name = name.slice(m[0].length).replace(/^\s*[-–—:·]\s*/, "").trim();
  }
  let type: PostType | null = null;
  const t = name.match(/^(carousel|static|reel|video|post|graphic)s?\b\s*(?:\((.*)\)|[-–—:]\s*(.*))?$/i);
  if (t) {
    type = typeOf(t[1]);
    name = (t[2] ?? t[3] ?? "").trim();
  }
  return { date, type, title: name };
}

function typeOf(s: string): PostType | null {
  if (/carousel/i.test(s)) return "carousel";
  if (/reel|video/i.test(s)) return "reel";
  if (/static|post|graphic|image|photo/i.test(s)) return "static";
  return null;
}

/** Groups month-named folders ("October Statics", "October Reels", "Octubre 2026") by month. */
export function groupByMonth(items: DriveFile[], today: string) {
  const [ty, tm] = today.split("-").map(Number);
  const groups = new Map<number, MonthGroup>();
  const other: DriveFile[] = [];
  for (const f of items) {
    const m = f.mimeType === FOLDER ? monthOf(f.name) : null;
    if (!m) { other.push(f); continue; }
    const year = m.year ?? (m.month <= tm + 1 ? ty : ty - 1);
    const key = year * 12 + m.month;
    const g = groups.get(key) ?? { key, year, month: m.month, folders: [] };
    g.folders.push(f);
    groups.set(key, g);
  }
  const sorted = [...groups.values()].sort((a, b) => b.key - a.key);
  return { groups: sorted, other, nowKey: ty * 12 + tm };
}

/**
 * Builds posts from a month's folders and their contents.
 * `children` maps a folder id to its direct children (already fetched).
 */
export function buildPosts(monthFolders: DriveFile[], children: Map<string, DriveFile[]>, year: number): Post[] {
  const posts: Post[] = [];
  for (const tf of monthFolders) {
    const folderType = typeOf(tf.name.replace(/\b(19|20)\d{2}\b/, ""));
    for (const item of children.get(tf.id) ?? []) {
      const parsed = parsePostName(item.name, year);
      if (item.mimeType === FOLDER) {
        const inner = children.get(item.id) ?? [];
        const deep = inner.filter((f) => f.mimeType === FOLDER).flatMap((f) => children.get(f.id) ?? []);
        const files = [...inner, ...deep].filter((f) => f.mimeType !== FOLDER).sort((a, b) => natural(a.name, b.name));
        const media = files.filter(isMedia);
        if (!media.length) continue;
        const video = media.find((f) => f.mimeType.startsWith("video/"));
        const type = parsed.type ?? folderType ?? (video ? "reel" : media.length > 1 ? "carousel" : "static");
        const cover = media.find((f) => f.mimeType.startsWith("image/") && /cover/i.test(f.name))
          ?? media.find((f) => f.mimeType.startsWith("image/")) ?? media[0];
        const firstDate = parsed.date ?? files.map((f) => parsePostName(f.name, year).date).find(Boolean) ?? null;
        posts.push({
          id: item.id, isFolder: true, date: firstDate, type,
          title: parsed.title || (type === "reel" ? "Reel" : type === "carousel" ? "Carousel" : "Post"),
          cover, media: type === "reel" && video ? [video] : media,
          captionFile: files.find((f) => f.mimeType === "text/plain") ?? null,
        });
      } else if (isMedia(item)) {
        const type = parsed.type ?? folderType ?? (item.mimeType.startsWith("video/") ? "reel" : "static");
        posts.push({ id: item.id, isFolder: false, date: parsed.date, type, title: parsed.title || "Post", cover: item, media: [item], captionFile: null });
      }
    }
  }
  return posts.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || natural(a.title, b.title));
}
