import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { DriveError, fetchMedia, fetchThumbnail, getFile, isInside, kind } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/drive/<fileId>?client=<clientId>&thumb=1
 * Streams a Drive file (or its thumbnail) after checking the file lives in
 * the caller's client folder. Clients can only ever use their own folder;
 * staff pass ?client= to pick which folder to check against.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const profile = await getProfile();
  if (!profile) return new NextResponse("Sign in first.", { status: 401 });

  const clientId = profile.role === "staff" ? req.nextUrl.searchParams.get("client") : profile.client_id;
  if (!clientId) return new NextResponse("No client.", { status: 403 });

  // RLS decides whether this user may see this client at all.
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("drive_folder_id").eq("id", clientId).maybeSingle();
  const root = client?.drive_folder_id;
  if (!root) return new NextResponse("Not found.", { status: 404 });

  try {
    if (!(await isInside(fileId, root))) return new NextResponse("Not found.", { status: 404 });
    const file = await getFile(fileId);

    if (req.nextUrl.searchParams.get("thumb")) {
      const res = await fetchThumbnail(file, Number(req.nextUrl.searchParams.get("size")) || 600);
      if (!res?.ok || !res.body) return new NextResponse("No preview.", { status: 404 });
      return new NextResponse(res.body, {
        headers: { "Content-Type": res.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=3600" },
      });
    }

    const k = kind(file.mimeType);
    if (k === "folder" || k === "doc") {
      if (file.webViewLink) return NextResponse.redirect(file.webViewLink);
      return new NextResponse("Open this file in Google Drive.", { status: 415 });
    }
    const res = await fetchMedia(fileId, req.headers.get("range"));
    if (!res.ok && res.status !== 206) return new NextResponse("Couldn't load the file.", { status: 502 });
    const headers = new Headers({
      "Content-Type": file.mimeType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
    });
    for (const h of ["content-length", "content-range", "accept-ranges"]) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new NextResponse(res.body, { status: res.status, headers });
  } catch (e) {
    const status = e instanceof DriveError ? e.status : 500;
    return new NextResponse(status === 404 ? "Not found." : "Drive is unavailable right now.", { status });
  }
}
