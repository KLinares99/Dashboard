import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses row level security, so only use it for the
 * few things a signed-in staff member can't do as themselves (inviting users).
 * Always check the caller is staff before using it.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
