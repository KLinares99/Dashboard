"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** A client ticks one of their own action items on or off. The database checks ownership. */
export async function setMyTaskDone(taskId: string, done: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!z.string().uuid().safeParse(taskId).success) return { ok: false, error: "Unknown item." };
  const me = await getProfile();
  if (!me || me.role !== "client") return { ok: false, error: "Please sign in again." };
  const db = await createClient();
  const { data, error } = await db.rpc("set_my_task_done", { task_id: taskId, is_done: done });
  if (error || data !== true) return { ok: false, error: "Couldn't save that. Try again." };
  revalidatePath("/portal", "layout");
  revalidatePath("/app", "layout");
  return { ok: true };
}
