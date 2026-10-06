import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { type DriveFile, FOLDER, driveConfigured, getFile, isInside, kind, listFolder, pickThisMonth } from "@/lib/drive";
import { fmtDate } from "@/lib/format";
import type { Client } from "@/lib/types";

const Chevron = () => (
  <svg className="chev" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1 1 6 6-6 6" /></svg>
);
const FolderGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.7c.6 0 1.2.3 1.6.7L12 6h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" /></svg>
);

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="ios-card"><div className="ios-empty"><span className="glyph" aria-hidden="true"><FolderGlyph /></span><b>{title}</b>{text}</div></div>
  );
}

/** Photos-style grid. Tapping a tile opens the file in a new tab. */
export function Tiles({ files, clientId, staff }: { files: DriveFile[]; clientId: string; staff: boolean }) {
  const q = staff ? `?client=${clientId}` : "";
  const amp = staff ? "&" : "?";
  return (
    <div className="ios-grid">
      {files.map((f) => {
        const k = kind(f.mimeType);
        return (
          <a key={f.id} className="ios-tile" href={`/api/drive/${f.id}${q}`} target="_blank" rel="noopener" title={f.name}>
            {f.thumbnailLink ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/drive/${f.id}${q}${amp}thumb=1&size=500`} alt={f.name} loading="lazy" />
            ) : (
              <span className="ph"><span>{f.name}</span></span>
            )}
            {k === "video" && (
              <span className="badge"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1v8l7-4z" /></svg>Video</span>
            )}
            {k === "pdf" && <span className="badge">PDF</span>}
          </a>
        );
      })}
    </div>
  );
}

function monthTitle(name: string) {
  return name.replace(/^\d+\s*[-–·.]\s*/, "");
}

/** "This month" section on the client home. `base` is the page that accepts ?folder=. */
export async function ThisMonth({ client, today, base }: { client: Client; today: string; base: string }) {
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
    const root = await listFolder(client.drive_folder_id);
    const pick = pickThisMonth(root, today);
    const files = pick.folder ? (await listFolder(pick.folder.id)).filter((f) => f.mimeType !== FOLDER) : pick.files ?? [];
    const title = pick.folder ? `${monthTitle(pick.folder.name)}` : `${monthName} content`;
    const sep = base.includes("?") ? "&" : "?";
    return (
      <>
        <section className="ios-section">
          <div className="ios-section-h">
            <h2>{title} {files.length > 0 && <span className="count">{files.length}</span>}</h2>
          </div>
          {pick.fallback && <p className="ios-foot" style={{ marginTop: -4 }}>{monthName}&apos;s content isn&apos;t up yet. Here&apos;s the latest.</p>}
          {files.length ? <Tiles files={files} clientId={client.id} staff={staff} /> : <Empty title="Nothing here yet" text={`${monthName}'s content will appear here as it's ready.`} />}
        </section>
        {pick.earlier.length > 0 && (
          <section className="ios-section">
            <div className="ios-section-h"><h2>Earlier</h2></div>
            <div className="ios-card">
              {pick.earlier.map((f) => (
                <Link key={f.id} className="ios-row" href={`${base}${sep}folder=${f.id}`}>
                  <span style={{ color: "var(--tint)", display: "grid" }}><FolderGlyph /></span>
                  <span className="grow">{monthTitle(f.name)}</span>
                  <Chevron />
                </Link>
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

/** A single earlier folder, opened from "Earlier". */
export async function FolderView({ client, folderId, back }: { client: Client; folderId: string; back: string }) {
  const staff = (await getProfile())?.role === "staff";
  if (!driveConfigured() || !client.drive_folder_id) return <Empty title="Nothing here" text="This folder isn't available." />;
  try {
    if (!(await isInside(folderId, client.drive_folder_id))) return <Empty title="Not found" text="This folder isn't part of your content." />;
    const [meta, items] = await Promise.all([getFile(folderId), listFolder(folderId)]);
    const files = items.filter((f) => f.mimeType !== FOLDER);
    return (
      <>
        <div className="ios-hello" style={{ paddingTop: 8 }}>
          <Link href={back} style={{ fontSize: 17 }}>‹ Home</Link>
          <h1 style={{ marginTop: 10 }}>{monthTitle(meta.name)}</h1>
          <p>{files.length} item{files.length === 1 ? "" : "s"}</p>
        </div>
        {files.length ? <Tiles files={files} clientId={client.id} staff={staff} /> : <Empty title="Empty folder" text="Nothing has been added here yet." />}
      </>
    );
  } catch {
    return <Empty title="Can't load content right now" text="Please try again in a little while." />;
  }
}
