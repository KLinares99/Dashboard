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

const Answer = z.object({
  approved: z.boolean().optional(),
  choice: z.string().trim().max(300).optional(),
  text: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(2000).optional(),
});

/** A client answers one decision on their approval. The database checks ownership and that it's still open. */
export async function answerDecision(itemId: string, answer: z.input<typeof Answer>): Promise<{ ok: boolean; error?: string }> {
  const parsed = Answer.safeParse(answer);
  if (!z.string().uuid().safeParse(itemId).success || !parsed.success) return { ok: false, error: "Couldn't save that answer." };
  const a = parsed.data;
  if (a.approved === undefined && !a.choice && !a.text) return { ok: false, error: "Pick an answer first." };
  const me = await getProfile();
  if (!me || me.role !== "client") return { ok: false, error: "Please sign in again." };
  const db = await createClient();
  const { data, error } = await db.rpc("answer_approval_item", { item_id: itemId, answer: a });
  if (error || data !== true) return { ok: false, error: "This approval is closed or no longer available." };
  revalidatePath("/portal", "layout");
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** A client signs off once every decision is answered. */
export async function signApproval(approvalId: string, fullName: string): Promise<{ ok: boolean; error?: string }> {
  const name = z.string().trim().min(2, "Type your full name to sign.").max(120).safeParse(fullName);
  if (!z.string().uuid().safeParse(approvalId).success) return { ok: false, error: "Unknown approval." };
  if (!name.success) return { ok: false, error: name.error.issues[0].message };
  const me = await getProfile();
  if (!me || me.role !== "client") return { ok: false, error: "Please sign in again." };
  const db = await createClient();
  const { data, error } = await db.rpc("sign_approval", { approval: approvalId, full_name: name.data });
  if (error || data !== true) return { ok: false, error: "Answer every decision first, then sign." };
  revalidatePath("/portal", "layout");
  revalidatePath("/app", "layout");
  return { ok: true };
}
