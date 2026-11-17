"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/form-bits";
import { LinkButton } from "@/components/link-button";
import { MEDICINE_FORMS } from "@/lib/inventory";
import type { InventoryFormState } from "@/app/actions/inventory";

type Action = (prev: InventoryFormState, formData: FormData) => Promise<InventoryFormState>;

function FormError({ state }: { state: InventoryFormState }) {
  return state.errors?._form ? (
    <Alert variant="destructive" className="sm:col-span-2">
      <AlertDescription>{state.errors._form[0]}</AlertDescription>
    </Alert>
  ) : null;
}

export function MedicineForm({
  action,
  defaults,
  cancelHref,
  submitLabel,
}: {
  action: Action;
  defaults: Record<string, string>;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = (k: string) => state.values?.[k] ?? defaults[k] ?? "";
  const e = (k: string) => state.errors?.[k];
  const active = state.values ? state.values.is_active === "on" : defaults.is_active !== "";

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <FormError state={state} />
      <Field label="Name" htmlFor="name" error={e("name")}>
        <Input id="name" name="name" defaultValue={v("name")} required maxLength={120} />
      </Field>
      <Field label="Generic name" htmlFor="generic_name" error={e("generic_name")}>
        <Input id="generic_name" name="generic_name" defaultValue={v("generic_name")} />
      </Field>
      <Field label="Strength" htmlFor="strength" hint="e.g. 500mg" error={e("strength")}>
        <Input id="strength" name="strength" defaultValue={v("strength")} />
      </Field>
      <Field label="Form" htmlFor="form" error={e("form")}>
        <NativeSelect id="form" name="form" defaultValue={v("form") || "tablet"}>
          {MEDICINE_FORMS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Stock unit" htmlFor="unit" hint="e.g. tablet, bottle, sachet" error={e("unit")}>
        <Input id="unit" name="unit" defaultValue={v("unit") || "tablet"} required />
      </Field>
      <Field label="Unit price (LKR)" htmlFor="unit_price" error={e("unit_price")}>
        <Input id="unit_price" name="unit_price" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={v("unit_price") || "0"} />
      </Field>
      <Field label="Reorder level" htmlFor="reorder_level" hint="Shown as Low at or below this quantity" error={e("reorder_level")}>
        <Input id="reorder_level" name="reorder_level" type="number" min="0" step="1" inputMode="numeric" defaultValue={v("reorder_level") || "0"} />
      </Field>
      <div className="hidden sm:block" />
      <Field label="Default dose" htmlFor="default_dose" hint="Pre-fills the prescription" error={e("default_dose")}>
        <Input id="default_dose" name="default_dose" defaultValue={v("default_dose")} placeholder="1 tab" />
      </Field>
      <Field label="Default frequency" htmlFor="default_frequency" error={e("default_frequency")}>
        <Input id="default_frequency" name="default_frequency" defaultValue={v("default_frequency")} placeholder="TDS" />
      </Field>
      <Field label="Default duration" htmlFor="default_duration" error={e("default_duration")}>
        <Input id="default_duration" name="default_duration" defaultValue={v("default_duration")} placeholder="5 days" />
      </Field>
      <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={active} className="size-4 accent-[var(--primary)]" />
        Active (offered when prescribing)
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <LinkButton href={cancelHref} variant="outline">Cancel</LinkButton>
      </div>
    </form>
  );
}

export function ReceiveStockForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const v = (k: string) => state.values?.[k] ?? "";
  const e = (k: string) => state.errors?.[k];
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <FormError state={state} />
      <Field label="Quantity" htmlFor="recv_quantity" error={e("quantity")}>
        <Input id="recv_quantity" name="quantity" type="number" min="1" step="1" inputMode="numeric" defaultValue={v("quantity")} required />
      </Field>
      <Field label="Batch no." htmlFor="recv_batch" error={e("batch_no")}>
        <Input id="recv_batch" name="batch_no" defaultValue={v("batch_no")} />
      </Field>
      <Field label="Expiry date" htmlFor="recv_expiry" error={e("expiry_date")}>
        <Input id="recv_expiry" name="expiry_date" type="date" defaultValue={v("expiry_date")} />
      </Field>
      <Field label="Note" htmlFor="recv_note" error={e("note")}>
        <Input id="recv_note" name="note" defaultValue={v("note")} placeholder="Supplier, invoice no." />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>Receive stock</SubmitButton>
      </div>
    </form>
  );
}

export function AdjustStockForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const v = (k: string) => state.values?.[k] ?? "";
  const e = (k: string) => state.errors?.[k];
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <FormError state={state} />
      <Field label="Action" htmlFor="adj_type">
        <NativeSelect id="adj_type" name="type" defaultValue={v("type") || "remove"}>
          <option value="remove">Adjust: remove stock</option>
          <option value="add">Adjust: add stock</option>
          <option value="writeoff">Write-off (expired or damaged)</option>
        </NativeSelect>
      </Field>
      <Field label="Quantity" htmlFor="adj_quantity" error={e("quantity")}>
        <Input id="adj_quantity" name="quantity" type="number" min="1" step="1" inputMode="numeric" defaultValue={v("quantity")} required />
      </Field>
      <Field label="Reason" htmlFor="adj_note" error={e("note")} className="sm:col-span-2">
        <Textarea id="adj_note" name="note" rows={2} defaultValue={v("note")} required />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton variant="outline">Record adjustment</SubmitButton>
      </div>
    </form>
  );
}
