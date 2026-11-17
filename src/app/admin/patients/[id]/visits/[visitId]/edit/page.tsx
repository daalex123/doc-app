import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { BackLink } from "@/components/medical-history";
import { VisitForm } from "@/components/visit-form";
import { requireClinical } from "@/lib/auth";
import { formatInstantDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { saveVisit } from "@/app/actions/records";
import { RX_ROWS, type Visit } from "@/lib/types";

export const metadata: Metadata = { title: "Edit visit" };

export default async function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  await requireClinical();
  const { id, visitId } = await params;

  const supabase = await createClient();
  const [{ data: visit }, { data: note }] = await Promise.all([
    supabase
      .from("visits")
      .select("*, prescription_items(*)")
      .eq("id", visitId)
      .eq("patient_id", id)
      .maybeSingle<Visit>(),
    supabase
      .from("visit_private_notes")
      .select("note")
      .eq("visit_id", visitId)
      .maybeSingle<{ note: string }>(),
  ]);
  if (!visit) notFound();

  const defaults: Record<string, string> = {
    complaint: visit.complaint ?? "",
    symptoms: visit.symptoms ?? "",
    examination: visit.examination ?? "",
    diagnosis: visit.diagnosis ?? "",
    treatment: visit.treatment ?? "",
    advice: visit.advice ?? "",
    follow_up_date: visit.follow_up_date ?? "",
    private_note: note?.note ?? "",
    finalize: visit.status === "finalized" ? "on" : "",
    bp: visit.vitals?.bp ?? "",
    pulse: visit.vitals?.pulse ?? "",
    temperature: visit.vitals?.temperature ?? "",
    weight: visit.vitals?.weight ?? "",
    height: visit.vitals?.height ?? "",
    sugar: visit.vitals?.sugar ?? "",
  };
  (visit.prescription_items ?? []).slice(0, RX_ROWS).forEach((item, i) => {
    defaults[`rx_medicine_${i}`] = item.medicine;
    defaults[`rx_dose_${i}`] = item.dose ?? "";
    defaults[`rx_frequency_${i}`] = item.frequency ?? "";
    defaults[`rx_duration_${i}`] = item.duration ?? "";
    defaults[`rx_notes_${i}`] = item.notes ?? "";
  });

  return (
    <>
      <BackLink href={`/admin/patients/${id}`}>Back to record</BackLink>
      <PageHeader title="Edit visit" description={formatInstantDate(visit.visit_date)} />
      <div className="max-w-4xl">
        <VisitForm
          action={saveVisit.bind(null, {
            patientId: id,
            visitId,
            appointmentId: visit.appointment_id ?? undefined,
          })}
          defaults={defaults}
          cancelHref={`/admin/patients/${id}`}
          isFinalized={visit.status === "finalized"}
        />
      </div>
    </>
  );
}
