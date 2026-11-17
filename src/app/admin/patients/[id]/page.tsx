import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { AdminPatientRecord, ReceptionistPatientView } from "@/components/admin-patient-record";
import { BackLink } from "@/components/medical-history";
import { isClinicalRole, requireStaff } from "@/lib/auth";
import { logAccess } from "@/lib/audit";
import { signAvatarUrl } from "@/lib/avatars";
import { loadMedicalHistory } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import type { Appointment, Patient } from "@/lib/types";

export const metadata: Metadata = { title: "Patient record" };

async function loadAppointments(patientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("*, doctors(name, specialty)")
    .eq("patient_id", patientId)
    .order("slot_start", { ascending: false })
    .limit(20)
    .returns<Appointment[]>();
  return data ?? [];
}

export default async function AdminPatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireStaff();
  const clinical = isClinicalRole(user.profile.role);
  const { id } = await params;
  const { tab } = await searchParams;

  if (clinical) {
    const data = await loadMedicalHistory(id);
    if (!data) notFound();
    await logAccess(user.id, "view", "medical_history", id);
    const [appointments, avatarUrl] = await Promise.all([
      loadAppointments(id),
      signAvatarUrl(data.patient.avatar_path),
    ]);

    return (
      <>
        <BackLink href="/admin/patients">All patients</BackLink>
        <PageHeader title="Patient record" />
        <AdminPatientRecord
          avatarUrl={avatarUrl}
          patient={data.patient}
          entries={data.entries}
          visits={data.visits}
          appointments={appointments}
          tab={tab}
        />
      </>
    );
  }

  // Receptionist: contact details, allergies and appointments only.
  const supabase = await createClient();
  const [{ data: patient }, appointments] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).maybeSingle<Patient>(),
    loadAppointments(id),
  ]);
  if (!patient) notFound();

  return (
    <>
      <BackLink href="/admin/patients">All patients</BackLink>
      <PageHeader title="Patient record" />
      <ReceptionistPatientView
        patient={patient}
        avatarUrl={await signAvatarUrl(patient.avatar_path)}
        appointments={appointments}
        patientId={id}
      />
    </>
  );
}
