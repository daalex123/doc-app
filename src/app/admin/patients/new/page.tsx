import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { requireStaff } from "@/lib/auth";
import { savePatient } from "@/app/actions/patients";

export const metadata: Metadata = { title: "Add patient" };

export default async function AdminNewPatientPage() {
  await requireStaff();

  return (
    <>
      <PageHeader title="Add patient" description="Register a walk-in or phone patient." />
      <div className="max-w-3xl">
        <PatientForm
          action={savePatient.bind(null, { scope: "admin" })}
          defaults={{}}
          cancelHref="/admin/patients"
          submitLabel="Register patient"
        />
      </div>
    </>
  );
}
