"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!parsed.success) redirect("/login?error=email");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: false }, // invite-only
  });
  // Unknown emails get the same answer as known ones, so the form can't be
  // used to find out who our clients are.
  if (error && !/signups not allowed|not found|user not/i.test(error.message)) {
    if (/rate|too many|seconds/i.test(error.message)) redirect("/login?error=rate");
    console.error("sign-in link failed", error.message);
    redirect("/login?error=send");
  }
  redirect(`/login?sent=${encodeURIComponent(parsed.data)}`);
}
