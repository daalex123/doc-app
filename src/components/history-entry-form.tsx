"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/form-bits";
import { addHistoryEntry, type RecordFormState } from "@/app/actions/records";
import { HISTORY_CATEGORIES } from "@/lib/types";

export function HistoryEntryForm({ patientId }: { patientId: string }) {
  const action = addHistoryEntry.bind(null, patientId);
  const [state, formAction] = useActionState<RecordFormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const failed = !!state.errors;

  // A successful save returns empty values and no errors.
  useEffect(() => {
    if (state.values && !state.errors && Object.keys(state.values).length === 0) {
      toast.success("History entry added");
      formRef.current?.reset();
    }
  }, [state]);

  const v = (k: string) => (failed ? state.values?.[k] : undefined) ?? "";

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-6">
      {state.errors?._form ? (
        <Alert variant="destructive" className="sm:col-span-6">
          <AlertDescription>{state.errors._form[0]}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Type" htmlFor="h-category" className="sm:col-span-2">
        <NativeSelect id="h-category" name="category" defaultValue={v("category") || "condition"}>
          {HISTORY_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="What" htmlFor="h-title" error={state.errors?.title} className="sm:col-span-3">
        <Input id="h-title" name="title" defaultValue={v("title")} placeholder="e.g. Type 2 diabetes" required />
      </Field>
      <Field label="Year" htmlFor="h-year" error={state.errors?.year}>
        <Input id="h-year" name="year" defaultValue={v("year")} inputMode="numeric" maxLength={4} placeholder="2019" />
      </Field>
      <Field label="Details (optional)" htmlFor="h-detail" className="sm:col-span-5">
        <Textarea id="h-detail" name="detail" defaultValue={v("detail")} rows={1} placeholder="Dose, hospital, reaction, relative..." />
      </Field>
      <Field label="Status" htmlFor="h-status">
        <NativeSelect id="h-status" name="status" defaultValue={v("status") || "active"}>
          <option value="active">Current</option>
          <option value="resolved">Resolved</option>
        </NativeSelect>
      </Field>
      <div className="sm:col-span-6">
        <SubmitButton size="sm" pendingText="Adding...">Add entry</SubmitButton>
      </div>
    </form>
  );
}
