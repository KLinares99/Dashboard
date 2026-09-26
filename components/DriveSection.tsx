import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { DriveError, driveConfigured, getFile, isInside, listFolder, serviceAccountEmail } from "@/lib/drive";
import type { Client } from "@/lib/types";
import { ContentGrid } from "./ContentGrid";

/** Lists a client's Drive folder (or a subfolder inside it). Server component. */
/** `staff` controls the wording (setup hints vs. friendly client copy). */
export async function DriveSection({ client, folder, base, staff }: { client: Client; folder?: string; base: string; staff: boolean }) {
  const viewerIsStaff = (await getProfile())?.role === "staff";
  if (!driveConfigured()) {
    return staff ? (
      <div className="notice info">Google Drive isn&apos;t connected yet. Add <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> to the app&apos;s environment (see README), then paste this client&apos;s folder link in Settings.</div>
    ) : <div className="empty">Content will appear here soon.</div>;
  }
  if (!client.drive_folder_id) {
    return staff ? (
      <div className="notice info">No Drive folder linked. Paste the folder link in <Link href={`/app/clients/${client.slug}?tab=settings`}>Settings</Link>, and share the folder with <b>{serviceAccountEmail()}</b> as Viewer.</div>
    ) : <div className="empty">Content will appear here soon.</div>;
  }
  const root = client.drive_folder_id;
  const target = folder && folder !== root ? folder : root;
  try {
    let crumb: string | null = null;
    if (target !== root) {
      if (!(await isInside(target, root))) return <div className="notice err">That folder isn&apos;t part of this client&apos;s content.</div>;
      crumb = (await getFile(target)).name;
    }
    const files = await listFolder(target);
    return (
      <div className="stack" style={{ gap: 14 }}>
        {crumb && (
          <div className="row-gap" style={{ fontSize: 15 }}>
            <Link href={base}>All content</Link><span className="muted">/</span><b style={{ fontWeight: 500 }}>{crumb}</b>
          </div>
        )}
        <ContentGrid files={files} clientId={client.id} base={base} staff={viewerIsStaff} />
      </div>
    );
  } catch (e) {
    const msg = e instanceof DriveError ? e.message : "Google Drive is unavailable right now.";
    return <div className={staff ? "notice err" : "empty"}>{staff ? `${msg} Service account: ${serviceAccountEmail()}` : "Content can't be loaded right now. Try again later."}</div>;
  }
}
