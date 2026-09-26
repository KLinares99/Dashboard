import "server-only";
import { notFound } from "next/navigation";
import { requireClientUser } from "@/lib/auth";
import { loadClient } from "@/lib/data";

export async function portalBundle() {
  const me = await requireClientUser();
  const bundle = await loadClient({ id: me.client_id });
  if (!bundle) notFound(); // archived, or access removed
  return bundle;
}
