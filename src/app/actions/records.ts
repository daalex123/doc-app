"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isClinicalRole, requireClinical, requireUser } from "@/lib/auth";
import { logAccess } from "@/lib/audit";
import { RX_ROWS } from "@/lib/types";
import {
  flattenErrors,
  formBool,
  formString,
  historyEntrySchema,
  type FieldErrors,
} from "@/lib/validation";

export interface RecordFormState {
  errors?: FieldErrors;
  values?: Record<string, string>;
}

/* ------------------------------ history entries ------------------------------ */

export async function addHistoryEntry(
  patientId: string,
  _prev: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(patientId).success) redirect("/");

  const values = {
    category: formString(formData, "category"),
    title: formString(formData, "title"),
    detail: formString(formData, "detail"),
    year: formString(formData, "year"),
    status: formString(formData, "status") || "active",
  };
  const parsed = historyEntrySchema.safeParse(values);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.from("history_entries").insert({
    ...parsed.data,
    patient_id: patientId,
    created_by: user.id,
    reviewed_on: isClinicalRole(user.profile.role) ? new Date().toISOString().slice(0, 10) : null,
  });
  // RLS rejects patients writing to someone else's record.
  if (error) return { errors: { _form: ["Could not save this entry."] }, values };

  await logAccess(user.id, "create", "history_entry", patientId);
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  return { values: {} };
}

export async function setHistoryStatus(formData: FormData) {
  await requireClinical();
  const parsed = z
    .object({ id: z.uuid(), patient_id: z.uuid(), status: z.enum(["active", "resolved"]) })
    .safeParse({
      id: formString(formData, "id"),
      patient_id: formString(formData, "patient_id"),
      status: formString(formData, "status"),
    });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("history_entries").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  revalidatePath(`/admin/patients/${parsed.data.patient_id}`);
}

/* ---------------------------------- visits ---------------------------------- */

export interface VisitActionContext {
  patientId: string;
  visitId?: string;
  appointmentId?: string;
}

const VITAL_KEYS = ["bp", "pulse", "temperature", "weight", "height", "sugar"] as const;
const TEXT_KEYS = [
  "complaint", "symptoms", "diagnosis", "examination", "treatment", "advice",
  "follow_up_date", "private_note",
] as const;

const clean = (v: string) => (v.trim() === "" ? null : v.trim());

export async function saveVisit(
  ctx: VisitActionContext,
  _prev: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const user = await requireClinical();
  const supabase = await createClient();

  const values: Record<string, string> = {};
  for (const k of [...TEXT_KEYS, ...VITAL_KEYS]) values[k] = formString(formData, k);
  values.finalize = formBool(formData, "finalize") ? "on" : "";
  for (let i = 0; i < RX_ROWS; i++) {
    for (const f of ["medicine", "dose", "frequency", "duration", "notes"]) {
      values[`rx_${f}_${i}`] = formString(formData, `rx_${f}_${i}`);
    }
  }

  const errors: FieldErrors = {};
  if (!values.complaint.trim() && !values.diagnosis.trim()) {
    errors.complaint = ["Enter a complaint or a diagnosis"];
  }
  if (values.follow_up_date && !/^\d{4}-\d{2}-\d{2}$/.test(values.follow_up_date)) {
    errors.follow_up_date = ["Enter a valid date"];
  }
  for (let i = 0; i < RX_ROWS; i++) {
    const anyField = ["dose", "frequency", "duration", "notes"].some((f) => values[`rx_${f}_${i}`].trim());
    if (anyField && !values[`rx_medicine_${i}`].trim()) {
      errors[`rx_medicine_${i}`] = ["Enter the medicine name"];
    }
  }
  if (Object.keys(errors).length) return { errors, values };

  const vitals = Object.fromEntries(
    VITAL_KEYS.filter((k) => values[k].trim()).map((k) => [k, values[k].trim()]),
  );

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();

  const row = {
    complaint: clean(values.complaint),
    symptoms: clean(values.symptoms),
    diagnosis: clean(values.diagnosis),
    examination: clean(values.examination),
    treatment: clean(values.treatment),
    advice: clean(values.advice),
    follow_up_date: clean(values.follow_up_date),
    vitals,
    status: values.finalize ? "finalized" : "draft",
  };

  let visitId = ctx.visitId;
  if (visitId) {
    const { error } = await supabase.from("visits").update(row).eq("id", visitId);
    if (error) return { errors: { _form: ["Could not save the visit."] }, values };
  } else {
    const { data, error } = await supabase
      .from("visits")
      .insert({
        ...row,
        patient_id: ctx.patientId,
        appointment_id: ctx.appointmentId ?? null,
        doctor_id: doctor?.id ?? null,
        created_by: user.id,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) {
      const msg =
        error?.code === "23505"
          ? "A visit already exists for this appointment."
          : "Could not save the visit.";
      return { errors: { _form: [msg] }, values };
    }
    visitId = data.id;
  }

  // prescriptions: replace the set
  await supabase.from("prescription_items").delete().eq("visit_id", visitId);
  const items = Array.from({ length: RX_ROWS }, (_, i) => ({
    visit_id: visitId!,
    medicine: values[`rx_medicine_${i}`].trim(),
    dose: clean(values[`rx_dose_${i}`]),
    frequency: clean(values[`rx_frequency_${i}`]),
    duration: clean(values[`rx_duration_${i}`]),
    notes: clean(values[`rx_notes_${i}`]),
  })).filter((r) => r.medicine);
  if (items.length) {
    const { error } = await supabase.from("prescription_items").insert(items);
    if (error) return { errors: { _form: ["Visit saved, but prescriptions failed to save."] }, values };
  }

  // private note (never visible to the patient)
  if (values.private_note.trim()) {
    await supabase
      .from("visit_private_notes")
      .upsert({ visit_id: visitId, note: values.private_note.trim() });
  } else {
    await supabase.from("visit_private_notes").delete().eq("visit_id", visitId);
  }

  // finishing a visit that came from an appointment completes the appointment
  if (values.finalize && ctx.appointmentId) {
    await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", ctx.appointmentId)
      .eq("status", "confirmed");
  }

  await logAccess(user.id, ctx.visitId ? "update" : "create", "visit", ctx.patientId, visitId);
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  redirect(`/admin/patients/${ctx.patientId}?tab=visits`);
}
