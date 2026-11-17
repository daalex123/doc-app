import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { MedicalHistory } from "@/components/medical-history";
import { requirePatientUser } from "@/lib/auth";
import { logAccess } from "@/lib/audit";
import { loadMedicalHistory } from "@/lib/records";

export const metadata: Metadata = { title: "Medical history" };

export default async function PortalHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requirePatientUser();
  const { patientId } = await params;
  const { tab } = await searchParams;

  const data = await loadMedicalHistory(patientId);
  // RLS only returns the account's own patients, so anything else is a 404.
  if (!data) notFound();
  await logAccess(user.id, "view", "medical_history", patientId);

  return (
    <>
      <PageHeader title="Medical history" description="Your visits, prescriptions and health background." />
      <MedicalHistory patient={data.patient} entries={data.entries} visits={data.visits} tab={tab} />
    </>
  );
}
