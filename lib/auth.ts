import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** The signed-in user's profile, or null. Cached per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, client_id")
    .eq("id", user.id)
    .single();
  return (data as Profile) ?? null;
});

export async function requireStaff(): Promise<Profile> {
  const p = await getProfile();
  if (!p) redirect("/login");
  if (p.role !== "staff") redirect("/portal");
  return p;
}

export async function requireClientUser(): Promise<Profile & { client_id: string }> {
  const p = await getProfile();
  if (!p) redirect("/login");
  if (p.role === "staff") redirect("/app");
  if (!p.client_id) redirect("/login?error=no-access");
  return p as Profile & { client_id: string };
}

/** For server actions: throws instead of redirecting. */
export async function assertStaff(): Promise<Profile> {
  const p = await getProfile();
  if (!p || p.role !== "staff") throw new Error("Only Elevate staff can do that.");
  return p;
}
