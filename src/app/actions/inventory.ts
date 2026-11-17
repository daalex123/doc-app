"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireClinical } from "@/lib/auth";
import { MEDICINE_FORMS } from "@/lib/inventory";
import { flattenErrors, formBool, formString, type FieldErrors } from "@/lib/validation";

export interface InventoryFormState {
  errors?: FieldErrors;
  values?: Record<string, string>;
}

const optional = (max: number) =>
  z.string().trim().max(max, `Use ${max} characters or fewer`).transform((v) => (v === "" ? null : v));

const medicineSchema = z.object({
  name: z.string().trim().min(1, "Enter the medicine name").max(120, "Use 120 characters or fewer"),
  generic_name: optional(120),
  strength: z.string().trim().max(40, "Use 40 characters or fewer"),
  form: z.enum(MEDICINE_FORMS.map((f) => f.value) as [string, ...string[]], "Choose a form"),
  unit: z.string().trim().min(1, "Enter a unit, e.g. tablet").max(30),
  default_dose: optional(60),
  default_frequency: optional(60),
  default_duration: optional(60),
  unit_price: z.coerce.number("Enter a price").min(0, "Price cannot be negative").max(10_000_000),
  reorder_level: z.coerce.number("Enter a number").int("Whole number only").min(0, "Cannot be negative").max(1_000_000),
});

const FIELDS = [
  "name", "generic_name", "strength", "form", "unit",
  "default_dose", "default_frequency", "default_duration", "unit_price", "reorder_level",
] as const;

/** Create (no id) or update a catalog entry. Doctors and admins may edit the catalog. */
export async function saveMedicine(
  medicineId: string | undefined,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  await requireClinical();
  const values: Record<string, string> = {};
  for (const k of FIELDS) values[k] = formString(formData, k);
  values.is_active = formBool(formData, "is_active") ? "on" : "";

  const parsed = medicineSchema.safeParse(values);
  if (!parsed.success) return { errors: flattenErrors(parsed.error), values };
  const row = { ...parsed.data, is_active: values.is_active === "on" };

  const supabase = await createClient();
  let id = medicineId;
  if (id) {
    if (!z.uuid().safeParse(id).success) redirect("/admin/inventory");
    const { data, error } = await supabase.from("medicines").update(row).eq("id", id).select("id");
    if (error || !data?.length) return { errors: { _form: [dupMessage(error?.code)] }, values };
  } else {
    const { data, error } = await supabase.from("medicines").insert(row).select("id").single<{ id: string }>();
    if (error || !data) return { errors: { _form: [dupMessage(error?.code)] }, values };
    id = data.id;
  }
  revalidatePath("/admin/inventory", "layout");
  revalidatePath("/admin");
  redirect(`/admin/inventory/${id}?saved=medicine`);
}

const dupMessage = (code?: string) =>
  code === "23505"
    ? "A medicine with this name, strength and form already exists."
    : "Could not save the medicine.";

const STOCK_ERRORS: Record<string, string> = {
  insufficient_stock: "Not enough stock: this would take the stock below zero.",
  invalid_quantity: "Enter a whole number greater than zero.",
  reason_required: "Enter a reason.",
  forbidden: "You do not have permission to change stock.",
  not_found: "Medicine not found.",
};

function rpcError(message: string | undefined): string {
  const key = Object.keys(STOCK_ERRORS).find((k) => message?.includes(k));
  return key ? STOCK_ERRORS[key] : "Could not record the stock movement.";
}

const quantity = z.coerce
  .number("Enter a quantity")
  .int("Whole number only")
  .min(1, "Enter a quantity of at least 1")
  .max(10_000_000);

/** Receive stock into the ledger (admin only). */
export async function receiveStock(
  medicineId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  await requireAdmin();
  const values = {
    quantity: formString(formData, "quantity"),
    batch_no: formString(formData, "batch_no"),
    expiry_date: formString(formData, "expiry_date"),
    note: formString(formData, "note"),
  };
  const parsed = z
    .object({
      quantity,
      batch_no: optional(60),
      expiry_date: z
        .string()
        .trim()
        .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date")
        .transform((v) => (v === "" ? null : v)),
      note: optional(300),
    })
    .safeParse(values);
  if (!parsed.success || !z.uuid().safeParse(medicineId).success) {
    return { errors: parsed.success ? { _form: ["Invalid request."] } : flattenErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_movement", {
    p_medicine: medicineId,
    p_kind: "receive",
    p_quantity: parsed.data.quantity,
    p_batch_no: parsed.data.batch_no,
    p_expiry: parsed.data.expiry_date,
    p_note: parsed.data.note,
  });
  if (error) return { errors: { _form: [rpcError(error.message)] }, values };

  revalidatePath("/admin/inventory", "layout");
  revalidatePath("/admin");
  redirect(`/admin/inventory/${medicineId}?saved=received`);
}

/** Adjust stock up or down, or write it off, with a mandatory reason (admin only). */
export async function adjustStock(
  medicineId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  await requireAdmin();
  const values = {
    type: formString(formData, "type") || "remove",
    quantity: formString(formData, "quantity"),
    note: formString(formData, "note"),
  };
  const parsed = z
    .object({
      type: z.enum(["add", "remove", "writeoff"]),
      quantity,
      note: z.string().trim().min(1, "Enter a reason").max(300, "Use 300 characters or fewer"),
    })
    .safeParse(values);
  if (!parsed.success || !z.uuid().safeParse(medicineId).success) {
    return { errors: parsed.success ? { _form: ["Invalid request."] } : flattenErrors(parsed.error), values };
  }

  const { type, quantity: qty, note } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_movement", {
    p_medicine: medicineId,
    p_kind: type === "writeoff" ? "expired" : "adjust",
    p_quantity: type === "remove" ? -qty : qty,
    p_batch_no: null,
    p_expiry: null,
    p_note: note,
  });
  if (error) return { errors: { _form: [rpcError(error.message)] }, values };

  revalidatePath("/admin/inventory", "layout");
  revalidatePath("/admin");
  redirect(`/admin/inventory/${medicineId}?saved=adjusted`);
}
