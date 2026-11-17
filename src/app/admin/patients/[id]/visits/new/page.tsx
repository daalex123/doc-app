import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { BackLink } from "@/components/medical-history";
import { VisitForm } from "@/components/visit-form";
import { requireClinical } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveVisit } from "@/app/actions/records";
import { z } from "zod";

export const metadata: Metadata = { title: "New visit" };

export default async function NewVisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ appointment?: string }>;
}) {
  await requireClinical();
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("full_name")
    .eq("id", id)
    .maybeSingle<{ full_name: string }>();
  if (!patient) notFound();

  const appointmentId = z.uuid().safeParse(sp.appointment).data;

  // If a visit already exists for this appointment, continue it instead of duplicating.
  let defaults: Record<string, string> = {};
  if (appointmentId) {
    const { data: appt } = await supabase
      .from("appointments")
      .select("reason, patient_id")
      .eq("id", appointmentId)
      .maybeSingle<{ reason: string | null; patient_id: string }>();
    if (!appt || appt.patient_id !== id) notFound();
    defaults = { complaint: appt.reason ?? "" };
  }

  return (
    <>
      <BackLink href={`/admin/patients/${id}`}>Back to record</BackLink>
      <PageHeader title="New visit" description={patient.full_name} />
      <div className="max-w-4xl">
        <VisitForm
          action={saveVisit.bind(null, { patientId: id, appointmentId })}
          defaults={defaults}
          cancelHref={`/admin/patients/${id}`}
          isFinalized={false}
        />
      </div>
    </>
  );
}
