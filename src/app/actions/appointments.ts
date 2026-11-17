"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, requireUser, isStaffRole } from "@/lib/auth";
import { formString } from "@/lib/validation";
import { errorCode } from "@/lib/booking-errors";

function safePath(path: string, scope: "portal" | "admin"): string {
  return path.startsWith(`/${scope}`) && !path.startsWith("//") ? path : `/${scope}`;
}

function withParam(path: string, key: string, value: string): string {
  const url = new URL(path, "http://x");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

const bookingSchema = z.object({
  patient_id: z.uuid(),
  doctor_id: z.uuid(),
  slot: z.iso.datetime({ offset: true }),
  reason: z.string().trim().max(500),
});

export async function bookAppointment(scope: "portal" | "admin", formData: FormData) {
  const user = scope === "admin" ? await requireStaff() : await requireUser();
  if (scope === "portal" && isStaffRole(user.profile.role)) redirect("/admin");

  const retry = safePath(formString(formData, "retry"), scope);
  const parsed = bookingSchema.safeParse({
    patient_id: formString(formData, "patient_id"),
    doctor_id: formString(formData, "doctor_id"),
    slot: formString(formData, "slot"),
    reason: formString(formData, "reason"),
  });
  if (!parsed.success) redirect(withParam(retry, "error", "failed"));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_patient: parsed.data.patient_id,
    p_doctor: parsed.data.doctor_id,
    p_slot: parsed.data.slot,
    p_reason: parsed.data.reason,
  });
  if (error || !data) redirect(withParam(retry, "error", errorCode(error?.message)));

  revalidatePath(`/${scope}`, "layout");
  redirect(`/${scope}/appointments?booked=${data}`);
}

export async function bookAsPatient(formData: FormData) {
  return bookAppointment("portal", formData);
}

export async function bookAsStaff(formData: FormData) {
  return bookAppointment("admin", formData);
}

export async function cancelAppointment(formData: FormData) {
  const user = await requireUser();
  const scope = isStaffRole(user.profile.role) ? "admin" : "portal";
  const returnTo = safePath(formString(formData, "return_to"), scope);
  const id = z.uuid().safeParse(formString(formData, "appointment_id"));
  if (!id.success) redirect(withParam(returnTo, "error", "failed"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_appointment", { p_appointment: id.data });
  if (error) redirect(withParam(returnTo, "error", errorCode(error.message)));

  revalidatePath(`/${scope}`, "layout");
  redirect(withParam(returnTo, "cancelled", "1"));
}

export async function setAppointmentStatus(formData: FormData) {
  await requireStaff();
  const returnTo = safePath(formString(formData, "return_to"), "admin");
  const parsed = z
    .object({
      appointment_id: z.uuid(),
      status: z.enum(["completed", "no_show", "confirmed"]),
    })
    .safeParse({
      appointment_id: formString(formData, "appointment_id"),
      status: formString(formData, "status"),
    });
  if (!parsed.success) redirect(withParam(returnTo, "error", "failed"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.appointment_id);
  if (error) redirect(withParam(returnTo, "error", "failed"));

  revalidatePath("/admin", "layout");
  redirect(returnTo);
}
