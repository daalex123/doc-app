"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { formBool, formString } from "@/lib/validation";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Invalid time");

const doctorSchema = z.object({
  name: z.string().trim().min(2).max(100),
  specialty: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(1000).transform((v) => v || null),
  fee: z.coerce.number().min(0).max(1_000_000),
  profile_id: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
});

/** id is bound from the page ("new" creates). */
export async function saveDoctor(id: string | null, formData: FormData) {
  await requireAdmin();
  const where = id ? `/admin/doctors/${id}` : "/admin/doctors/new";

  const parsed = doctorSchema.safeParse({
    name: formString(formData, "name"),
    specialty: formString(formData, "specialty"),
    bio: formString(formData, "bio"),
    fee: formString(formData, "fee") || "0",
    profile_id: formString(formData, "profile_id"),
  });
  if (!parsed.success) redirect(`${where}?error=invalid`);

  const row = { ...parsed.data, active: formBool(formData, "active") };
  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from("doctors").update(row).eq("id", id);
    if (error) redirect(`${where}?error=${error.code === "23505" ? "linked" : "failed"}`);
    revalidatePath("/admin/doctors");
    redirect(`${where}?saved=1`);
  }

  const { data, error } = await supabase
    .from("doctors")
    .insert({ ...row, active: true })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) redirect(`${where}?error=${error?.code === "23505" ? "linked" : "failed"}`);
  revalidatePath("/admin/doctors");
  redirect(`/admin/doctors/${data.id}?saved=1`);
}

export async function addSchedule(doctorId: string, formData: FormData) {
  await requireAdmin();
  const where = `/admin/doctors/${doctorId}`;

  const days = formData
    .getAll("weekday")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  const parsed = z
    .object({
      start: time,
      end: time,
      slot_minutes: z.coerce.number().int().min(5).max(120),
    })
    .refine((v) => v.end > v.start, "End must be after start")
    .safeParse({
      start: formString(formData, "start"),
      end: formString(formData, "end"),
      slot_minutes: formString(formData, "slot_minutes"),
    });
  if (!parsed.success || days.length === 0) redirect(`${where}?error=schedule`);

  const supabase = await createClient();
  const { error } = await supabase.from("schedules").insert(
    days.map((weekday) => ({
      doctor_id: doctorId,
      weekday,
      start_time: parsed.data.start,
      end_time: parsed.data.end,
      slot_minutes: parsed.data.slot_minutes,
    })),
  );
  if (error) redirect(`${where}?error=failed`);
  revalidatePath(where);
  redirect(`${where}?saved=1`);
}

export async function deleteSchedule(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ id: z.uuid(), doctor_id: z.uuid() })
    .safeParse({ id: formString(formData, "id"), doctor_id: formString(formData, "doctor_id") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("schedules").delete().eq("id", parsed.data.id);
  revalidatePath(`/admin/doctors/${parsed.data.doctor_id}`);
}

export async function addException(doctorId: string, formData: FormData) {
  await requireAdmin();
  const where = `/admin/doctors/${doctorId}`;

  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().trim().max(200).transform((v) => v || null),
    })
    .safeParse({ date: formString(formData, "date"), reason: formString(formData, "reason") });
  if (!parsed.success) redirect(`${where}?error=exception`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_exceptions")
    .insert({ doctor_id: doctorId, ...parsed.data });
  if (error && error.code !== "23505") redirect(`${where}?error=failed`);
  revalidatePath(where);
  redirect(`${where}?saved=1`);
}

export async function deleteException(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ id: z.uuid(), doctor_id: z.uuid() })
    .safeParse({ id: formString(formData, "id"), doctor_id: formString(formData, "doctor_id") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("schedule_exceptions").delete().eq("id", parsed.data.id);
  revalidatePath(`/admin/doctors/${parsed.data.doctor_id}`);
}

export async function setUserRole(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      user_id: z.uuid(),
      role: z.enum(["patient", "receptionist", "doctor", "admin"]),
    })
    .safeParse({ user_id: formString(formData, "user_id"), role: formString(formData, "role") });
  if (!parsed.success) redirect("/admin/staff?error=invalid");

  // Guard against locking yourself out of admin.
  if (parsed.data.user_id === admin.id && parsed.data.role !== "admin") {
    redirect("/admin/staff?error=self");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    p_user: parsed.data.user_id,
    p_role: parsed.data.role,
  });
  if (error) redirect("/admin/staff?error=failed");
  revalidatePath("/admin/staff");
  redirect("/admin/staff?saved=1");
}
