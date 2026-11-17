import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { BackLink } from "@/components/medical-history";
import { PatientForm } from "@/components/patient-form";
import { requireStaff } from "@/lib/auth";
import { patientToDefaults } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { savePatient } from "@/app/actions/patients";
import { removePatientAvatar, uploadPatientAvatar } from "@/app/actions/avatars";
import { AvatarUploader } from "@/components/avatar-uploader";
import { signAvatarUrl } from "@/lib/avatars";
import type { Patient } from "@/lib/types";

export const metadata: Metadata = { title: "Edit patient" };

export default async function AdminEditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle<Patient>();
  if (!patient) notFound();

  return (
    <>
      <BackLink href={`/admin/patients/${id}`}>Back to record</BackLink>
      <PageHeader title={`Edit ${patient.full_name}`} />
      <div className="max-w-3xl">
        <AvatarUploader
          name={patient.full_name}
          currentUrl={await signAvatarUrl(patient.avatar_path)}
          hasPhoto={!!patient.avatar_path}
          uploadAction={uploadPatientAvatar.bind(null, { scope: "admin", id: patient.id })}
          removeAction={removePatientAvatar.bind(null, { scope: "admin", id: patient.id })}
        />
        <PatientForm
          action={savePatient.bind(null, { scope: "admin", id })}
          defaults={patientToDefaults(patient)}
          cancelHref={`/admin/patients/${id}`}
          submitLabel="Save changes"
        />
      </div>
    </>
  );
}
