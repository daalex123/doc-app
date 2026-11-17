"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireClinical } from "@/lib/auth";
import { RX_ROWS, type RxRow, type RxTemplate } from "@/lib/types";
import { formString } from "@/lib/validation";

const nameSchema = z.string().trim().min(1, "Enter a template name").max(80, "Use 80 characters or fewer");

export type SaveTemplateResult = { ok: true; template: RxTemplate } | { ok: false; error: string };

/** Saves the given prescription rows as a new template shared with all clinicians. */
export async function saveTemplateFromRows(name: string, rows: RxRow[]): Promise<SaveTemplateResult> {
  const user = await requireClinical();
  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success) return { ok: false, error: parsedName.error.issues[0].message };

  const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : "");
  const items = (Array.isArray(rows) ? rows : [])
    .slice(0, RX_ROWS)
    .map((r) => ({
      medicine: clean(r?.medicine),
      dose: clean(r?.dose),
      frequency: clean(r?.frequency),
      duration: clean(r?.duration),
      notes: clean(r?.notes),
    }))
    .filter((r) => r.medicine);
  if (items.length === 0) return { ok: false, error: "Add at least one medicine first" };

  const supabase = await createClient();
  const { data: tpl, error } = await supabase
    .from("prescription_templates")
    .insert({ name: parsedName.data, created_by: user.id })
    .select("id")
    .single<{ id: string }>();
  if (error || !tpl) return { ok: false, error: "Could not save the template" };

  const { error: itemsError } = await supabase.from("prescription_template_items").insert(
    items.map((r, position) => ({
      template_id: tpl.id,
      position,
      medicine: r.medicine,
      dose: r.dose || null,
      frequency: r.frequency || null,
      duration: r.duration || null,
      notes: r.notes || null,
    })),
  );
  if (itemsError) {
    await supabase.from("prescription_templates").delete().eq("id", tpl.id);
    return { ok: false, error: "Could not save the template" };
  }

  revalidatePath("/admin/templates");
  return { ok: true, template: { id: tpl.id, name: parsedName.data, created_by: user.id, items } };
}

export async function renameTemplate(formData: FormData) {
  await requireClinical();
  const parsed = z
    .object({ id: z.uuid(), name: nameSchema })
    .safeParse({ id: formString(formData, "id"), name: formString(formData, "name") });
  if (!parsed.success) redirect("/admin/templates?error=name");

  const supabase = await createClient();
  // RLS limits this to the owner or an admin; zero rows updated means not allowed.
  const { data } = await supabase
    .from("prescription_templates")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .select("id");
  if (!data?.length) redirect("/admin/templates?error=denied");
  revalidatePath("/admin/templates");
  redirect("/admin/templates?saved=renamed");
}

export async function deleteTemplate(formData: FormData) {
  await requireClinical();
  const parsed = z.object({ id: z.uuid() }).safeParse({ id: formString(formData, "id") });
  if (!parsed.success) redirect("/admin/templates?error=denied");

  const supabase = await createClient();
  const { data } = await supabase.from("prescription_templates").delete().eq("id", parsed.data.id).select("id");
  if (!data?.length) redirect("/admin/templates?error=denied");
  revalidatePath("/admin/templates");
  redirect("/admin/templates?saved=deleted");
}
