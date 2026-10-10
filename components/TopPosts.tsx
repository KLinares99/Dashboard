"use client";

import { useMemo, useState } from "react";
import { shiftISO } from "@/lib/analytics/series";
import { fmtDate } from "@/lib/format";
import type { SocialPost } from "@/lib/types";
import { Icon } from "./Icon";

/** Ranks a client's posts (from per-post exports) by the number you pick. */
const SORTS = [["Views", "views"], ["Reach", "reach"], ["Engagements", "engagements"], ["Total clicks", "clicks"]] as const;
const WINDOWS: [number | null, string][] = [[30, "30 days"], [90, "90 days"], [null, "All time"]];
const SHOWN = 10;

const firstLine = (caption: string | null) => caption?.split(/\n/).map((l) => l.trim()).find(Boolean) ?? "Untitled post";
const num = (v: number | undefined) => (v ?? 0).toLocaleString("en-US");
const where = (url: string) => (url.includes("instagram.com") ? "Instagram" : url.includes("facebook.com") ? "Facebook" : "the post");

export function TopPosts({ posts }: { posts: SocialPost[] }) {
  const sorts = SORTS.filter(([key]) => posts.some((p) => key in p.stats));
  const [sortBy, setSortBy] = useState<string>(sorts[0]?.[0] ?? "Views");
  const [win, setWin] = useState<number | null>(90);
  const [all, setAll] = useState(false);

  const end = posts.reduce((m, p) => (p.published_on > m ? p.published_on : m), "0000-00-00");
  const ranked = useMemo(() => {
    const start = win && posts.length ? shiftISO(end, -(win - 1)) : "0000-00-00";
    return posts.filter((p) => p.published_on >= start)
      .sort((a, b) => (b.stats[sortBy] ?? 0) - (a.stats[sortBy] ?? 0) || (a.published_on < b.published_on ? 1 : -1));
  }, [posts, sortBy, win, end]);

  if (!posts.length) return null;
  const top = ranked[0]?.stats[sortBy] || 1;
  const unit = SORTS.find(([k]) => k === sortBy)?.[1] ?? sortBy.toLowerCase();
  const shown = all ? ranked : ranked.slice(0, SHOWN);

  return (
    <section className="panel" aria-label="Top posts">
      <div className="panel-h top-posts-h" style={{ flexWrap: "wrap", gap: 10 }}>
        <span className="label">Top posts <span className="muted" style={{ fontWeight: 400 }}>{ranked.length}</span></span>
        <div className="row-gap" style={{ gap: 8, minWidth: 0, flex: "0 1 auto" }}>
          <div className="segmented" role="group" aria-label="Rank by">
            {sorts.map(([k, l]) => <button key={k} type="button" aria-pressed={sortBy === k} onClick={() => setSortBy(k)}>{l === "clicks" ? "Clicks" : k}</button>)}
          </div>
          <div className="segmented" role="group" aria-label="Posts from">
            {WINDOWS.map(([d, l]) => <button key={l} type="button" aria-pressed={win === d} onClick={() => setWin(d)}>{l}</button>)}
          </div>
        </div>
      </div>
      <div className="panel-b tight">
        {!ranked.length && <div className="empty">No posts in this range.</div>}
        <ol className="top-posts">
          {shown.map((p, i) => {
            const v = p.stats[sortBy] ?? 0;
            const others = sorts.filter(([k]) => k !== sortBy).map(([k, u]) => `${num(p.stats[k])} ${u}`);
            return (
              <li key={p.id} className="top-post">
                <span className="tp-rank">{i + 1}</span>
                <div className="tp-main">
                  <div className="tp-title" title={p.caption?.slice(0, 400) ?? undefined}>{firstLine(p.caption)}</div>
                  <div className="tp-meta">{[fmtDate(p.published_on, { month: "short", day: "numeric", year: "numeric" }), p.post_type, ...others].filter(Boolean).join(" · ")}</div>
                  <div className="tp-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, (v / top) * 100)}%` }} /></div>
                </div>
                <div className="tp-num"><b>{num(v)}</b><span>{unit}</span></div>
                {p.permalink
                  ? <a className="icon-btn" href={p.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open "${firstLine(p.caption)}" on ${where(p.permalink)}`} title={`Open on ${where(p.permalink)}`}><Icon name="arrow" size={18} /></a>
                  : <span />}
              </li>
            );
          })}
        </ol>
        {ranked.length > SHOWN && (
          <button className="btn small" type="button" style={{ marginTop: 10 }} onClick={() => setAll((v) => !v)}>
            {all ? "Show top 10" : `Show all ${ranked.length}`}
          </button>
        )}
      </div>
    </section>
  );
}
