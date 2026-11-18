import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { BackLink } from "@/components/medical-history";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/link-button";
import { requireClinical } from "@/lib/auth";
import { formatDate, formatInstantDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Visit, Vitals } from "@/lib/types";

export const metadata: Metadata = { title: "Visit" };

const VITALS: [keyof Vitals, string, string][] = [
  ["bp", "Blood pressure", "mmHg"],
  ["pulse", "Pulse", "bpm"],
  ["temperature", "Temperature", "°C"],
  ["weight", "Weight", "kg"],
  ["height", "Height", "cm"],
  ["sugar", "Blood sugar", "mg/dL"],
];

export default async function ViewVisitPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  await requireClinical();
  const { id, visitId } = await params;

  const supabase = await createClient();
  const [{ data: visit }, { data: note }, { data: patient }] = await Promise.all([
    supabase
      .from("visits")
      .select("*, doctors(name), prescription_items(*)")
      .eq("id", visitId)
      .eq("patient_id", id)
      .maybeSingle<Visit>(),
    supabase.from("visit_private_notes").select("note").eq("visit_id", visitId).maybeSingle<{ note: string }>(),
    supabase.from("patients").select("full_name").eq("id", id).maybeSingle<{ full_name: string }>(),
  ]);
  if (!visit) notFound();

  const vit = VITALS.filter(([k]) => visit.vitals?.[k]);
  const items = visit.prescription_items ?? [];
  const sections = [
    ["Complaint", visit.complaint],
    ["Symptoms", visit.symptoms],
    ["Examination", visit.examination],
    ["Diagnosis", visit.diagnosis],
    ["Treatment", visit.treatment],
    ["Advice", visit.advice],
  ] as const;

  return (
    <>
      <BackLink href="/admin/visits">Back to visits</BackLink>
      <PageHeader
        title={patient?.full_name ?? "Visit"}
        description={[
          formatInstantDate(visit.visit_date),
          visit.appointment_id ? "Booked" : "Walk-in",
          visit.doctors?.name,
        ].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            {visit.status === "draft" ? <Badge variant="outline">Draft</Badge> : null}
            <LinkButton href={`/admin/patients/${id}`} variant="outline">Patient record</LinkButton>
            <LinkButton href={`/admin/patients/${id}/visits/${visitId}/edit`}>
              <PencilIcon /> Edit
            </LinkButton>
          </div>
        }
      />

      <Card className="max-w-4xl">
        <CardContent className="grid gap-4 text-sm">
          {vit.length ? (
            <div className="flex flex-wrap gap-2">
              {vit.map(([k, label, unit]) => (
                <span key={k} className="rounded-md bg-muted px-2 py-1">
                  <span className="text-muted-foreground">{label}</span>{" "}
                  <span className="font-medium">{visit.vitals[k]}</span>{" "}
                  <span className="text-xs text-muted-foreground">{unit}</span>
                </span>
              ))}
            </div>
          ) : null}
          {sections.map(([label, value]) =>
            value ? (
              <div key={label} className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:pt-0.5">{label}</p>
                <p className="whitespace-pre-line">{value}</p>
              </div>
            ) : null,
          )}
          {items.length ? (
            <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:pt-0.5">Prescription</p>
              <ul className="grid gap-1">
                {items.map((i) => (
                  <li key={i.id} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{i.medicine}</span>
                    <span className="text-muted-foreground">
                      {[i.dose, i.frequency, i.duration].filter(Boolean).join(" · ")}
                    </span>
                    {i.notes ? <span className="text-muted-foreground">({i.notes})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {visit.follow_up_date ? (
            <p>
              <span className="text-muted-foreground">Follow-up:</span> {formatDate(visit.follow_up_date)}
            </p>
          ) : null}
          {note?.note ? (
            <div className="grid gap-0.5 rounded-md border border-dashed p-3 sm:grid-cols-[8rem_1fr] sm:gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Private note</p>
              <p className="whitespace-pre-line">{note.note}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Link href={`/admin/patients/${id}?tab=visits`} className="mt-4 inline-block text-sm text-primary hover:underline">
        All visits for this patient
      </Link>
    </>
  );
}
