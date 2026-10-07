import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { type Post, monthLabel, monthParam } from "@/lib/content";
import { loadMonth, loadPost } from "@/lib/content-server";
import { type DriveFile, FOLDER, driveConfigured, getFile, isInside, kind, listFolder } from "@/lib/drive";
import { fmtDate } from "@/lib/format";
import type { Client } from "@/lib/types";
import { CopyButton } from "./CopyButton";

const Chevron = () => (
  <svg className="chev" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1 1 6 6-6 6" /></svg>
);
const FolderGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.7c.6 0 1.2.3 1.6.7L12 6h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" /></svg>
);
const Stack = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 3h12a2 2 0 0 1 2 2v12h-2V5H7z" /><rect x="3" y="7" width="14" height="14" rx="2" /></svg>
);
const Play = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1v8l7-4z" /></svg>;

/** Builds a link on `base` (which may already have a query) with extra params. */
export function withParams(base: string, params: Record<string, string | undefined>) {
  const [path, q] = base.split("?");
  const sp = new URLSearchParams(q ?? "");
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
    else sp.delete(k);
  }
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="ios-card"><div className="ios-empty"><span className="glyph" aria-hidden="true"><FolderGlyph /></span><b>{title}</b>{text}</div></div>;
}

const TYPE_NAME = { carousel: "Carousels", reel: "Reels", static: "Statics" } as const;
const ONE = { carousel: "Carousel", reel: "Reel", static: "Post" } as const;

function mediaSrc(f: DriveFile, clientId: string, staff: boolean, thumb?: number) {
  const p = new URLSearchParams();
  if (staff) p.set("client", clientId);
  if (thumb) { p.set("thumb", "1"); p.set("size", String(thumb)); }
  const s = p.toString();
  return `/api/drive/${f.id}${s ? `?${s}` : ""}`;
}

function PostTile({ post, href, clientId, staff }: { post: Post; href: string; clientId: string; staff: boolean }) {
  return (
    <Link href={href} className="post-tile" aria-label={`${ONE[post.type]}${post.date ? `, ${fmtDate(post.date)}` : ""}: ${post.title}`}>
      <span className="ios-tile">
        {post.cover?.thumbnailLink
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={mediaSrc(post.cover, clientId, staff, 500)} alt="" loading="lazy" />
          : <span className="ph"><span>{post.title}</span></span>}
        {post.type === "carousel" && <span className="badge"><Stack />{post.media.length}</span>}
        {post.type === "reel" && <span className="badge"><Play />Reel</span>}
      </span>
      <span className="post-cap">
        <b>{post.date ? fmtDate(post.date, { month: "short", day: "numeric" }) : ONE[post.type]}</b>
        <span>{post.title}</span>
      </span>
    </Link>
  );
}

/** The month's content on the client home: filter, post grid, earlier months, other files. */
export async function ThisMonth({ client, today, base, month, type }: {
  client: Client; today: string; base: string; month?: string; type?: string;
}) {
  const monthName = fmtDate(today, { month: "long" });
  if (!driveConfigured() || !client.drive_folder_id) {
    return (
      <section className="ios-section">
        <div className="ios-section-h"><h2>{monthName} content</h2></div>
        <Empty title="Coming soon" text="Your posts, reels and graphics will appear here." />
      </section>
    );
  }
  const staff = (await getProfile())?.role === "staff";
  try {
    const m = await loadMonth(client.drive_folder_id, today, month);
    const counts = { carousel: 0, reel: 0, static: 0 };
    m.posts.forEach((p) => counts[p.type]++);
    const shown = type && type in counts ? m.posts.filter((p) => p.type === type) : m.posts;
    const title = m.group ? monthLabel(m.group).replace(` ${today.slice(0, 4)}`, "") : `${monthName} content`;
    const earlier = m.groups.filter((g) => g !== m.group);
    const files = m.other.filter((f) => f.mimeType !== FOLDER);
    const folders = m.other.filter((f) => f.mimeType === FOLDER);
    return (
      <>
        <section className="ios-section" id="content">
          <div className="ios-section-h">
            <h2>{title} {m.posts.length > 0 && <span className="count">{m.posts.length} post{m.posts.length === 1 ? "" : "s"}</span>}</h2>
            {month && <Link href={withParams(base, { month: undefined, type: undefined })}>This month</Link>}
          </div>
          {m.fallback && <p className="ios-foot" style={{ marginTop: -4 }}>{monthName}&apos;s content isn&apos;t up yet. Here&apos;s the latest.</p>}
          {m.posts.length > 0 && (Object.values(counts).filter(Boolean).length > 1) && (
            <nav className="ios-seg" aria-label="Filter posts">
              <Link href={withParams(base, { type: undefined })} aria-current={!type ? "page" : undefined}>All</Link>
              {(Object.keys(counts) as (keyof typeof counts)[]).filter((k) => counts[k]).map((k) => (
                <Link key={k} href={withParams(base, { type: k })} aria-current={type === k ? "page" : undefined}>{TYPE_NAME[k]} {counts[k]}</Link>
              ))}
            </nav>
          )}
          {shown.length
            ? <div className="post-grid">{shown.map((p) => <PostTile key={p.id} post={p} href={withParams(base, { post: p.id, type: undefined })} clientId={client.id} staff={staff} />)}</div>
            : <Empty title="Nothing here yet" text={`${monthName}'s content will appear here as it's ready.`} />}
        </section>
        {(earlier.length > 0 || folders.length > 0) && (
          <section className="ios-section">
            <div className="ios-section-h"><h2>Earlier</h2></div>
            <div className="ios-card">
              {earlier.map((g) => (
                <Link key={g.key} className="ios-row" href={withParams(base, { month: monthParam(g), type: undefined })}>
                  <span style={{ color: "var(--tint)", display: "grid" }}><FolderGlyph /></span>
                  <span className="grow">{monthLabel(g)}</span><Chevron />
                </Link>
              ))}
              {folders.map((f) => (
                <Link key={f.id} className="ios-row" href={withParams(base, { folder: f.id })}>
                  <span style={{ color: "var(--tint)", display: "grid" }}><FolderGlyph /></span>
                  <span className="grow">{f.name}</span><Chevron />
                </Link>
              ))}
            </div>
          </section>
        )}
        {files.length > 0 && (
          <section className="ios-section">
            <div className="ios-section-h"><h2>Files</h2></div>
            <div className="ios-card">
              {files.map((f) => (
                <a key={f.id} className="ios-row" href={mediaSrc(f, client.id, staff)} target="_blank" rel="noopener">
                  <span className="grow">{f.name}<span className="sub">{kind(f.mimeType) === "pdf" ? "PDF" : "File"} · {fmtDate(f.modifiedTime.slice(0, 10))}</span></span><Chevron />
                </a>
              ))}
            </div>
          </section>
        )}
      </>
    );
  } catch {
    return (
      <section className="ios-section">
        <div className="ios-section-h"><h2>{monthName} content</h2></div>
        <Empty title="Can't load content right now" text="Please try again in a little while." />
      </section>
    );
  }
}

/** One post: swipeable slides for a carousel, a player for a reel, the caption below. */
export async function PostView({ client, postId, back, today }: { client: Client; postId: string; back: string; today: string }) {
  const staff = (await getProfile())?.role === "staff";
  if (!driveConfigured() || !client.drive_folder_id) return <Empty title="Not found" text="This post isn't available." />;
  let loaded: Awaited<ReturnType<typeof loadPost>> = null;
  try { loaded = await loadPost(client.drive_folder_id, postId, today); } catch { loaded = null; }
  if (!loaded) return <><Link href={back}>‹ Back</Link><Empty title="Not found" text="This post isn't part of your content." /></>;
  const { post, caption } = loaded;
  const video = post.media.find((m) => m.mimeType.startsWith("video/"));
  return (
    <>
      <div className="ios-hello" style={{ paddingTop: 8 }}>
        <Link href={back} style={{ fontSize: 17 }}>‹ Back</Link>
        <h1 style={{ marginTop: 10, fontSize: 28 }}>{post.title}</h1>
        <p>{ONE[post.type]}{post.date ? ` · ${fmtDate(post.date, { weekday: "long", month: "long", day: "numeric" })}` : ""}</p>
      </div>
      {video ? (
        <div className="post-video">
          <video controls playsInline preload="metadata" poster={post.cover && post.cover.id !== video.id && post.cover.thumbnailLink ? mediaSrc(post.cover, client.id, staff, 1080) : undefined}
            src={mediaSrc(video, client.id, staff)} />
        </div>
      ) : (
        <>
          <div className="post-slides" tabIndex={0} aria-label={`${post.media.length} slide${post.media.length === 1 ? "" : "s"}`}>
            {post.media.map((m, i) => (
              <a key={m.id} className="post-slide" href={mediaSrc(m, client.id, staff)} target="_blank" rel="noopener" aria-label={`Slide ${i + 1}: open full size`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaSrc(m, client.id, staff, 1600)} alt={`Slide ${i + 1} of ${post.media.length}`} loading={i < 2 ? "eager" : "lazy"} />
              </a>
            ))}
          </div>
          {post.media.length > 1 && <p className="ios-foot" style={{ textAlign: "center" }}>Swipe for all {post.media.length} slides · tap a slide for full size</p>}
        </>
      )}
      {caption && (
        <section className="ios-section">
          <div className="ios-section-h"><h2>Caption</h2><CopyButton text={caption} /></div>
          <div className="ios-card"><p className="post-caption">{caption}</p></div>
        </section>
      )}
    </>
  );
}

/** Any folder inside the client's content (used for non-month folders). */
export async function FolderView({ client, folderId, back }: { client: Client; folderId: string; back: string }) {
  const staff = (await getProfile())?.role === "staff";
  if (!driveConfigured() || !client.drive_folder_id) return <Empty title="Nothing here" text="This folder isn't available." />;
  try {
    if (!(await isInside(folderId, client.drive_folder_id))) return <Empty title="Not found" text="This folder isn't part of your content." />;
    const [meta, items] = await Promise.all([getFile(folderId), listFolder(folderId)]);
    const files = items.filter((f) => f.mimeType !== FOLDER).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const sub = items.filter((f) => f.mimeType === FOLDER);
    return (
      <>
        <div className="ios-hello" style={{ paddingTop: 8 }}>
          <Link href={back} style={{ fontSize: 17 }}>‹ Back</Link>
          <h1 style={{ marginTop: 10 }}>{meta.name}</h1>
          <p>{files.length} item{files.length === 1 ? "" : "s"}</p>
        </div>
        {sub.length > 0 && (
          <div className="ios-card">
            {sub.map((f) => (
              <Link key={f.id} className="ios-row" href={withParams(back, { folder: f.id })}>
                <span style={{ color: "var(--tint)", display: "grid" }}><FolderGlyph /></span><span className="grow">{f.name}</span><Chevron />
              </Link>
            ))}
          </div>
        )}
        {files.length ? (
          <div className="ios-grid">
            {files.map((f) => (
              <a key={f.id} className="ios-tile" href={mediaSrc(f, client.id, staff)} target="_blank" rel="noopener" title={f.name}>
                {f.thumbnailLink
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={mediaSrc(f, client.id, staff, 500)} alt={f.name} loading="lazy" />
                  : <span className="ph"><span>{f.name}</span></span>}
              </a>
            ))}
          </div>
        ) : !sub.length ? <Empty title="Empty folder" text="Nothing has been added here yet." /> : null}
      </>
    );
  } catch {
    return <Empty title="Can't load content right now" text="Please try again in a little while." />;
  }
}
