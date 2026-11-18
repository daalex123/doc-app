import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { requireStaff } from "@/lib/auth";
import { savePatient } from "@/app/actions/patients";

export const metadata: Metadata = { title: "Add patient" };

export default async function AdminNewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ walkin?: string }>;
}) {
  await requireStaff();
  const walkIn = (await searchParams).walkin === "1";

  return (
    <>
      <PageHeader
        title={walkIn ? "New walk-in patient" : "Add patient"}
        description={walkIn ? "Register, then start the visit right away." : "Register a walk-in or phone patient."}
      />
      <div className="max-w-3xl">
        <PatientForm
          action={savePatient.bind(null, { scope: "admin", walkIn })}
          defaults={{}}
          cancelHref="/admin/patients"
          submitLabel={walkIn ? "Register & start visit" : "Register patient"}
        />
      </div>
    </>
  );
}
