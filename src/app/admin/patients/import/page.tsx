import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { PatientImport } from "@/components/patient-import";
import { requireFrontDesk } from "@/lib/auth";

export const metadata: Metadata = { title: "Import patients" };

export default async function ImportPatientsPage() {
  await requireFrontDesk();
  return (
    <>
      <PageHeader
        title="Import patients"
        description="Bulk-add patients from a CSV or Excel (.xlsx) file."
      />
      <PatientImport />
    </>
  );
}
