"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, requireStaff, requireUser } from "@/lib/auth";
import { AVATAR_BUCKET } from "@/lib/avatars";

export interface AvatarActionState {
  error?: string;
  ok?: boolean;
}

export interface AvatarActionContext {
  scope: "portal" | "admin";
  id: string;
}

const MAX_BYTES = 2 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Detect the real image type from magic bytes (the browser-supplied MIME type is not trusted). */
function sniffImage(b: Uint8Array): { type: string; ext: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { type: "image/jpeg", ext: "jpg" };
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  )
    return { type: "image/png", ext: "png" };
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return { type: "image/webp", ext: "webp" };
  return null;
}

async function authorize(ctx: AvatarActionContext) {
  const user = ctx.scope === "admin" ? await requireStaff() : await requireUser();
  if (ctx.scope === "portal" && isStaffRole(user.profile.role)) redirect("/admin");
  if (!UUID.test(ctx.id)) return null;
  return user;
}

/** Reads the current path through RLS: returns undefined when the patient is not visible. */
async function currentPath(patientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("avatar_path")
    .eq("id", patientId)
    .maybeSingle<{ avatar_path: string | null }>();
  return data ? data.avatar_path : undefined;
}

export async function uploadPatientAvatar(
  ctx: AvatarActionContext,
  _prev: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  if (!(await authorize(ctx))) return { error: "Patient not found." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  if (file.size > MAX_BYTES) return { error: "Photo must be 2 MB or smaller." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { error: "Only JPEG, PNG or WebP photos are allowed." };

  const old = await currentPath(ctx.id);
  if (old === undefined) return { error: "Patient not found." };

  const supabase = await createClient();
  const path = `${ctx.id}/${randomUUID()}.${kind.ext}`;
  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: kind.type, cacheControl: "0", upsert: false });
  if (upErr) return { error: "Could not upload the photo. Please try again." };

  const { error: dbErr } = await supabase
    .from("patients")
    .update({ avatar_path: path })
    .eq("id", ctx.id);
  if (dbErr) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return { error: "Could not save the photo. Please try again." };
  }

  if (old) await supabase.storage.from(AVATAR_BUCKET).remove([old]);
  revalidatePath(`/${ctx.scope}`, "layout");
  return { ok: true };
}

export async function removePatientAvatar(
  ctx: AvatarActionContext,
): Promise<AvatarActionState> {
  if (!(await authorize(ctx))) return { error: "Patient not found." };

  const old = await currentPath(ctx.id);
  if (old === undefined) return { error: "Patient not found." };
  if (!old) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from("patients").update({ avatar_path: null }).eq("id", ctx.id);
  if (error) return { error: "Could not remove the photo. Please try again." };

  await supabase.storage.from(AVATAR_BUCKET).remove([old]);
  revalidatePath(`/${ctx.scope}`, "layout");
  return { ok: true };
}
