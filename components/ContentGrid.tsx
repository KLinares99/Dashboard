import Link from "next/link";
import { type DriveFile, kind } from "@/lib/drive";
import { fmtDate } from "@/lib/format";
import { Icon } from "./Icon";

/** Server component. `base` is the page URL that accepts ?folder=. */
export function ContentGrid({ files, clientId, base, staff }: { files: DriveFile[]; clientId: string; base: string; staff: boolean }) {
  if (!files.length) return <div className="empty">This folder is empty.</div>;
  const q = staff ? `?client=${clientId}` : "";
  const amp = staff ? "&" : "?";
  return (
    <div className="content-grid">
      {files.map((f) => {
        const k = kind(f.mimeType);
        if (k === "folder")
          return (
            <Link key={f.id} href={`${base}${base.includes("?") ? "&" : "?"}folder=${f.id}`} className="content-card">
              <div className="thumb" style={{ aspectRatio: "4 / 3" }}><Icon name="folder" size={40} /></div>
              <div className="cap">{f.name}<small>Folder</small></div>
            </Link>
          );
        return (
          <a key={f.id} href={`/api/drive/${f.id}${q}`} target="_blank" rel="noopener" className="content-card">
            <div className="thumb">
              {f.thumbnailLink ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/drive/${f.id}${q}${amp}thumb=1`} alt="" loading="lazy" />
              ) : (
                <Icon name={k === "video" ? "video" : k === "image" ? "content" : "file"} size={40} />
              )}
            </div>
            <div className="cap">
              <span style={{ overflowWrap: "anywhere" }}>{f.name}</span>
              <small>{k === "video" ? "Video" : k === "image" ? "Image" : k === "pdf" ? "PDF" : k === "doc" ? "Google file" : "File"} · {fmtDate(f.modifiedTime.slice(0, 10))}</small>
            </div>
          </a>
        );
      })}
    </div>
  );
}
