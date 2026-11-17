import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { requirePatientUser } from "@/lib/auth";
import { patientToDefaults } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { savePatient } from "@/app/actions/patients";
import { removePatientAvatar, uploadPatientAvatar } from "@/app/actions/avatars";
import { AvatarUploader } from "@/components/avatar-uploader";
import { signAvatarUrl } from "@/lib/avatars";
import type { Patient } from "@/lib/types";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditPortalPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePatientUser();
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
      <PageHeader title={`Edit ${patient.full_name}`} />
      <div className="max-w-3xl">
        <AvatarUploader
          name={patient.full_name}
          currentUrl={await signAvatarUrl(patient.avatar_path)}
          hasPhoto={!!patient.avatar_path}
          uploadAction={uploadPatientAvatar.bind(null, { scope: "portal", id: patient.id })}
          removeAction={removePatientAvatar.bind(null, { scope: "portal", id: patient.id })}
        />
        <PatientForm
          action={savePatient.bind(null, { scope: "portal", id: patient.id })}
          defaults={patientToDefaults(patient)}
          cancelHref="/portal/patients"
          submitLabel="Save changes"
        />
      </div>
    </>
  );
}
