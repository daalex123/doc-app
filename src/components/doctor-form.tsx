import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/form-bits";
import { LinkButton } from "@/components/link-button";
import type { Doctor } from "@/lib/types";

export interface DoctorAccount {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function DoctorForm({
  action,
  doctor,
  accounts,
  linkedProfileId,
}: {
  action: (formData: FormData) => Promise<void>;
  doctor?: Doctor;
  accounts: DoctorAccount[];
  linkedProfileId?: string | null;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="name" className="sm:col-span-2">
        <Input id="name" name="name" defaultValue={doctor?.name} placeholder="Dr. Jane Perera" required />
      </Field>
      <Field label="Specialty" htmlFor="specialty">
        <Input id="specialty" name="specialty" defaultValue={doctor?.specialty} placeholder="General Practitioner" required />
      </Field>
      <Field label="Consultation fee (LKR)" htmlFor="fee">
        <Input id="fee" name="fee" type="number" min={0} step="0.01" defaultValue={doctor?.fee ?? 0} required />
      </Field>
      <Field label="About" htmlFor="bio" className="sm:col-span-2">
        <Textarea id="bio" name="bio" rows={3} defaultValue={doctor?.bio ?? ""} placeholder="Qualifications and experience" />
      </Field>
      <Field
        label="Login account"
        htmlFor="profile_id"
        hint="Link a user with the Doctor role so their visits are attributed to them."
        className="sm:col-span-2"
      >
        <NativeSelect id="profile_id" name="profile_id" defaultValue={linkedProfileId ?? ""}>
          <option value="">Not linked</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name ?? "Unnamed"} ({a.email})
            </option>
          ))}
        </NativeSelect>
      </Field>
      {doctor ? (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="active"
            defaultChecked={doctor.active}
            className="size-4 accent-[var(--primary)]"
          />
          Active (patients can book this doctor)
        </label>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>{doctor ? "Save changes" : "Add doctor"}</SubmitButton>
        <LinkButton href="/admin/doctors" variant="outline">Cancel</LinkButton>
      </div>
    </form>
  );
}
