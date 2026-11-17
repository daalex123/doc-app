"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LinkButton } from "@/components/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/form-bits";
import type { PatientFormState } from "@/app/actions/patients";

type Action = (prev: PatientFormState, formData: FormData) => Promise<PatientFormState>;

export type PatientDefaults = Record<string, string>;

export function PatientForm({
  action,
  defaults,
  cancelHref,
  submitLabel = "Save",
  showGuardianHint = true,
}: {
  action: Action;
  defaults: PatientDefaults;
  cancelHref: string;
  submitLabel?: string;
  showGuardianHint?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = (key: string) => state.values?.[key] ?? defaults[key] ?? "";
  const err = (key: string) => state.errors?.[key];

  const [sameWhatsapp, setSameWhatsapp] = useState(
    (state.values?.whatsapp_same ?? defaults.whatsapp_same) === "on",
  );
  const [noAllergies, setNoAllergies] = useState(
    (state.values?.no_known_allergies ?? defaults.no_known_allergies) === "on",
  );

  return (
    <form action={formAction} className="grid gap-6">
      {state.errors?._form ? (
        <Alert variant="destructive">
          <AlertDescription>{state.errors._form[0]}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Patient information</CardTitle>
          <CardDescription>Basic details used on every appointment.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            htmlFor="full_name"
            hint="Two names only, e.g. Sheyon Mishenke"
            error={err("full_name")}
            className="sm:col-span-2"
          >
            <Input
              id="full_name"
              name="full_name"
              defaultValue={v("full_name")}
              autoComplete="name"
              aria-invalid={!!err("full_name")}
              required
            />
          </Field>

          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Gender</legend>
            <div className="flex gap-4">
              {[
                ["female", "Female"],
                ["male", "Male"],
                ["other", "Other"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="gender"
                    value={value}
                    defaultChecked={v("gender") === value}
                    className="size-4 accent-[var(--primary)]"
                    required
                  />
                  {label}
                </label>
              ))}
            </div>
            {err("gender") ? (
              <p role="alert" className="text-xs text-destructive">{err("gender")?.[0]}</p>
            ) : null}
          </fieldset>

          <Field
            label="Date of birth"
            htmlFor="dob"
            hint="DD/MM/YYYY"
            error={err("dob")}
          >
            <Input
              id="dob"
              name="dob"
              defaultValue={v("dob")}
              placeholder="DD/MM/YYYY"
              inputMode="numeric"
              maxLength={10}
              autoComplete="bday"
              aria-invalid={!!err("dob")}
              required
            />
          </Field>

          <Field
            label="Phone number"
            htmlFor="phone"
            hint="e.g. 077 772 4098"
            error={err("phone")}
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={v("phone")}
              autoComplete="tel"
              aria-invalid={!!err("phone")}
              required
            />
          </Field>

          <div className="grid gap-1.5">
            <Field label="WhatsApp number" htmlFor="whatsapp" error={err("whatsapp")}>
              <Input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                defaultValue={v("whatsapp")}
                disabled={sameWhatsapp}
                aria-invalid={!!err("whatsapp")}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                name="whatsapp_same"
                checked={sameWhatsapp}
                onChange={(e) => setSameWhatsapp(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Same as phone number
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allergies</CardTitle>
          <CardDescription>Food and drug allergies help the doctor keep you safe.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Food allergies" htmlFor="food_allergies" error={err("food_allergies")}>
            <Textarea
              id="food_allergies"
              name="food_allergies"
              defaultValue={v("food_allergies")}
              disabled={noAllergies}
              rows={2}
              placeholder="e.g. Prawns, peanuts"
            />
          </Field>
          <Field label="Drug allergies" htmlFor="drug_allergies" error={err("drug_allergies")}>
            <Textarea
              id="drug_allergies"
              name="drug_allergies"
              defaultValue={v("drug_allergies")}
              disabled={noAllergies}
              rows={2}
              placeholder="e.g. Penicillin"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="no_known_allergies"
              checked={noAllergies}
              onChange={(e) => setNoAllergies(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            No known allergies
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>More details (optional)</CardTitle>
          <CardDescription>
            Helpful for emergencies and records.
            {showGuardianHint ? " Add a guardian for patients under 18." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="NIC number" htmlFor="nic">
            <Input id="nic" name="nic" defaultValue={v("nic")} />
          </Field>
          <Field label="Blood group" htmlFor="blood_group" error={err("blood_group")}>
            <NativeSelect id="blood_group" name="blood_group" defaultValue={v("blood_group")}>
              <option value="">Not known</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Address" htmlFor="address" className="sm:col-span-2">
            <Input id="address" name="address" defaultValue={v("address")} autoComplete="street-address" />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={v("city")} autoComplete="address-level2" />
          </Field>
          <div className="hidden sm:block" />
          <Field label="Emergency contact name" htmlFor="emergency_contact_name">
            <Input id="emergency_contact_name" name="emergency_contact_name" defaultValue={v("emergency_contact_name")} />
          </Field>
          <Field label="Emergency contact phone" htmlFor="emergency_contact_phone" error={err("emergency_contact_phone")}>
            <Input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" defaultValue={v("emergency_contact_phone")} />
          </Field>
          <Field label="Guardian name" htmlFor="guardian_name">
            <Input id="guardian_name" name="guardian_name" defaultValue={v("guardian_name")} />
          </Field>
          <Field label="Guardian phone" htmlFor="guardian_phone" error={err("guardian_phone")}>
            <Input id="guardian_phone" name="guardian_phone" type="tel" defaultValue={v("guardian_phone")} />
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="consent"
            defaultChecked={(state.values?.consent ?? defaults.consent) === "on"}
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span>
            I agree that the clinic may store this health information to provide my care.
            {err("consent") ? (
              <span role="alert" className="mt-1 block text-xs text-destructive">
                {err("consent")?.[0]}
              </span>
            ) : null}
          </span>
        </label>
        <div className="flex gap-2">
          <SubmitButton>{submitLabel}</SubmitButton>
          <LinkButton href={cancelHref} variant="outline">
            Cancel
          </LinkButton>
        </div>
      </div>
    </form>
  );
}
