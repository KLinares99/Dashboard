import "server-only";
import { type MonthGroup, buildPosts, groupByMonth, monthParam } from "./content";
import { FOLDER, type DriveFile, getFile, isInside, listChildrenOf, listFolder, readText } from "./drive";

/** Children of the given folders, plus their sub-folders, two levels down. */
async function descend(folderIds: string[], levels: number) {
  const all = new Map<string, DriveFile[]>();
  let frontier = folderIds;
  for (let i = 0; i < levels && frontier.length; i++) {
    const got = await listChildrenOf(frontier);
    for (const [k, v] of got) all.set(k, v);
    frontier = [...got.values()].flat().filter((f) => f.mimeType === FOLDER).map((f) => f.id);
  }
  return all;
}

/** One month of posts (the current month by default) plus the list of other months and loose files. */
export async function loadMonth(rootId: string, today: string, month?: string) {
  const root = await listFolder(rootId);
  const { groups, other, nowKey } = groupByMonth(root, today);
  let group: MonthGroup | undefined;
  let fallback = false;
  if (month) group = groups.find((g) => monthParam(g) === month);
  if (!group) group = groups.find((g) => g.key === nowKey);
  if (!group && !month) {
    group = groups.find((g) => g.key < nowKey);
    fallback = Boolean(group);
  }
  if (!group) return { group: null, posts: [], groups, other, fallback };
  const children = await descend(group.folders.map((f) => f.id), 3);
  return { group, posts: buildPosts(group.folders, children, group.year), groups, other, fallback };
}

/** A single post (folder or file) inside the client's folder, with its caption text. */
export async function loadPost(rootId: string, postId: string, today: string) {
  if (!(await isInside(postId, rootId)) || postId === rootId) return null;
  const item = await getFile(postId);
  const parentId = item.parents?.[0];
  if (!parentId) return null;
  const parent = await getFile(parentId);
  const children = item.mimeType === FOLDER ? await descend([item.id], 2) : new Map<string, DriveFile[]>();
  children.set(parent.id, [item]);
  const [post] = buildPosts([parent], children, Number(today.slice(0, 4)));
  if (!post) return null;
  const caption = post.captionFile ? (await readText(post.captionFile.id)).trim() : "";
  return { post, caption };
}
