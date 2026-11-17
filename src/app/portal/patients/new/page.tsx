import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { requirePatientUser } from "@/lib/auth";
import { savePatient } from "@/app/actions/patients";

export const metadata: Metadata = { title: "Add patient details" };

export default async function NewPortalPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ self?: string; next?: string }>;
}) {
  const user = await requirePatientUser();
  const sp = await searchParams;
  const isSelf = sp.self === "1";

  const action = savePatient.bind(null, { scope: "portal", isSelf, next: sp.next });
  // Pre-fill the name from the account for the person's own profile.
  const accountName = user.profile.full_name?.trim() ?? "";
  const defaults: Record<string, string> =
    isSelf && /^\S+ \S+$/.test(accountName) ? { full_name: accountName } : {};

  return (
    <>
      <PageHeader
        title={isSelf ? "Your details" : "Add a family member"}
        description={
          isSelf
            ? "We use this to prepare for your visit."
            : "Add a child, parent or anyone you book for."
        }
      />
      <div className="max-w-3xl">
        <PatientForm
          action={action}
          defaults={defaults}
          cancelHref="/portal/patients"
          submitLabel={isSelf ? "Save and continue" : "Add person"}
        />
      </div>
    </>
  );
}
