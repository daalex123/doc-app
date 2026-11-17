"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, SubmitButton } from "@/components/form-bits";
import { LinkButton } from "@/components/link-button";
import type { RecordFormState } from "@/app/actions/records";
import { RX_ROWS } from "@/lib/types";

type Action = (prev: RecordFormState, formData: FormData) => Promise<RecordFormState>;

const VITALS: { key: string; label: string; placeholder: string }[] = [
  { key: "bp", label: "BP (mmHg)", placeholder: "120/80" },
  { key: "pulse", label: "Pulse (bpm)", placeholder: "72" },
  { key: "temperature", label: "Temp (°C)", placeholder: "36.8" },
  { key: "weight", label: "Weight (kg)", placeholder: "65" },
  { key: "height", label: "Height (cm)", placeholder: "170" },
  { key: "sugar", label: "Blood sugar (mg/dL)", placeholder: "95" },
];

export function VisitForm({
  action,
  defaults,
  cancelHref,
  isFinalized,
}: {
  action: Action;
  defaults: Record<string, string>;
  cancelHref: string;
  isFinalized: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = (k: string) => state.values?.[k] ?? defaults[k] ?? "";
  const err = (k: string) => state.errors?.[k];

  return (
    <form action={formAction} className="grid gap-6">
      {state.errors?._form ? (
        <Alert variant="destructive">
          <AlertDescription>{state.errors._form[0]}</AlertDescription>
        </Alert>
      ) : null}
      {isFinalized ? (
        <Alert>
          <AlertDescription>
            This visit is finalized. Saving changes keeps the previous version as an amendment.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Consultation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Chief complaint" htmlFor="complaint" error={err("complaint")}>
            <Textarea id="complaint" name="complaint" rows={2} defaultValue={v("complaint")} />
          </Field>
          <Field label="Symptoms" htmlFor="symptoms">
            <Textarea id="symptoms" name="symptoms" rows={2} defaultValue={v("symptoms")} />
          </Field>
          <Field label="Examination" htmlFor="examination" className="sm:col-span-2">
            <Textarea id="examination" name="examination" rows={2} defaultValue={v("examination")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vitals</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {VITALS.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={f.key}>
              <Input id={f.key} name={f.key} defaultValue={v(f.key)} placeholder={f.placeholder} />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diagnosis and plan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Diagnosis" htmlFor="diagnosis">
            <Textarea id="diagnosis" name="diagnosis" rows={2} defaultValue={v("diagnosis")} />
          </Field>
          <Field label="Treatment given" htmlFor="treatment">
            <Textarea id="treatment" name="treatment" rows={2} defaultValue={v("treatment")} />
          </Field>
          <Field label="Advice" htmlFor="advice">
            <Textarea id="advice" name="advice" rows={2} defaultValue={v("advice")} />
          </Field>
          <Field label="Follow-up date" htmlFor="follow_up_date" error={err("follow_up_date")}>
            <Input id="follow_up_date" name="follow_up_date" type="date" defaultValue={v("follow_up_date")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prescription</CardTitle>
          <CardDescription>Leave unused rows empty.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {Array.from({ length: RX_ROWS }, (_, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-12">
              <div className="col-span-2 sm:col-span-4">
                <Input
                  name={`rx_medicine_${i}`}
                  defaultValue={v(`rx_medicine_${i}`)}
                  placeholder={i === 0 ? "Medicine" : ""}
                  aria-label={`Medicine ${i + 1}`}
                  aria-invalid={!!err(`rx_medicine_${i}`)}
                />
                {err(`rx_medicine_${i}`) ? (
                  <p role="alert" className="mt-1 text-xs text-destructive">{err(`rx_medicine_${i}`)?.[0]}</p>
                ) : null}
              </div>
              <Input className="sm:col-span-2" name={`rx_dose_${i}`} defaultValue={v(`rx_dose_${i}`)} placeholder={i === 0 ? "Dose" : ""} aria-label={`Dose ${i + 1}`} />
              <Input className="sm:col-span-2" name={`rx_frequency_${i}`} defaultValue={v(`rx_frequency_${i}`)} placeholder={i === 0 ? "Frequency" : ""} aria-label={`Frequency ${i + 1}`} />
              <Input className="sm:col-span-2" name={`rx_duration_${i}`} defaultValue={v(`rx_duration_${i}`)} placeholder={i === 0 ? "Duration" : ""} aria-label={`Duration ${i + 1}`} />
              <Input className="col-span-2 sm:col-span-2" name={`rx_notes_${i}`} defaultValue={v(`rx_notes_${i}`)} placeholder={i === 0 ? "Notes" : ""} aria-label={`Notes ${i + 1}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Private note</CardTitle>
          <CardDescription>Only doctors and admins can see this. It is never shown to the patient.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea name="private_note" rows={2} defaultValue={v("private_note")} aria-label="Private note" />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="finalize"
            defaultChecked={(state.values?.finalize ?? defaults.finalize) === "on"}
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span>
            Finalize this visit
            <span className="block text-xs text-muted-foreground">
              Finalized visits appear in the patient&apos;s medical history and complete the linked
              appointment. Drafts are visible to doctors and admins only.
            </span>
          </span>
        </label>
        <div className="flex gap-2">
          <SubmitButton>Save visit</SubmitButton>
          <LinkButton href={cancelHref} variant="outline">Cancel</LinkButton>
        </div>
      </div>
    </form>
  );
}
