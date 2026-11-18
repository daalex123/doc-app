"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, requireUser, isStaffRole } from "@/lib/auth";
import {
  flattenErrors,
  formBool,
  formString,
  patientSchema,
  type FieldErrors,
} from "@/lib/validation";

export interface PatientFormState {
  errors?: FieldErrors;
  values?: Record<string, string>;
}

export interface PatientActionContext {
  scope: "portal" | "admin";
  id?: string;
  isSelf?: boolean;
  next?: string;
  /** After registering, go straight to a new (walk-in) visit for this patient. */
  walkIn?: boolean;
}

const TEXT_FIELDS = [
  "full_name", "gender", "dob", "phone", "whatsapp", "food_allergies", "drug_allergies",
  "nic", "address", "city", "blood_group", "emergency_contact_name",
  "emergency_contact_phone", "guardian_name", "guardian_phone",
] as const;

function safeNext(next: string | undefined, scope: "portal" | "admin"): string | null {
  if (!next || !next.startsWith(`/${scope}`) || next.startsWith("//")) return null;
  return next;
}

export async function savePatient(
  ctx: PatientActionContext,
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const user = ctx.scope === "admin" ? await requireStaff() : await requireUser();
  if (ctx.scope === "portal" && isStaffRole(user.profile.role)) redirect("/admin");

  const values: Record<string, string> = {};
  for (const f of TEXT_FIELDS) values[f] = formString(formData, f);
  values.whatsapp_same = formBool(formData, "whatsapp_same") ? "on" : "";
  values.no_known_allergies = formBool(formData, "no_known_allergies") ? "on" : "";
  values.consent = formBool(formData, "consent") ? "on" : "";

  const parsed = patientSchema.safeParse({
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, values[f]])),
    whatsapp_same: values.whatsapp_same === "on",
    no_known_allergies: values.no_known_allergies === "on",
    consent: values.consent === "on",
  });
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values };

  const { whatsapp_same, consent, ...p } = parsed.data;
  void consent;
  const row = {
    ...p,
    whatsapp: whatsapp_same ? p.phone : p.whatsapp,
    // clear allergy text when "none" is ticked so the record is unambiguous
    food_allergies: p.no_known_allergies ? null : p.food_allergies,
    drug_allergies: p.no_known_allergies ? null : p.drug_allergies,
  };

  const supabase = await createClient();
  let patientId = ctx.id;

  if (ctx.id) {
    const { error } = await supabase.from("patients").update(row).eq("id", ctx.id);
    if (error) return { errors: { _form: ["Could not save. Please try again."] }, values };
  } else {
    const { data, error } = await supabase
      .from("patients")
      .insert({
        ...row,
        account_id: ctx.scope === "portal" ? user.id : null,
        is_self: ctx.scope === "portal" ? Boolean(ctx.isSelf) : false,
        consent_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) {
      const msg =
        error?.code === "23505"
          ? "You already have a personal profile. Add this person as a family member instead."
          : "Could not save. Please try again.";
      return { errors: { _form: [msg] }, values };
    }
    patientId = data.id;
  }

  revalidatePath(`/${ctx.scope}`, "layout");
  const fallback =
    ctx.scope === "admin"
      ? ctx.walkIn && !ctx.id
        ? `/admin/patients/${patientId}/visits/new`
        : `/admin/patients/${patientId}`
      : "/portal/patients";
  redirect(safeNext(ctx.next, ctx.scope) ?? fallback);
}
