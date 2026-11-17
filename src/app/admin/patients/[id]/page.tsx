import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { AppointmentCard } from "@/components/appointment-list";
import { LinkButton } from "@/components/link-button";
import { BackLink, MedicalHistory } from "@/components/medical-history";
import { isClinicalRole, requireStaff } from "@/lib/auth";
import { logAccess } from "@/lib/audit";
import { ageFromDob, formatDate } from "@/lib/dates";
import { displayPhone } from "@/lib/format";
import { loadMedicalHistory } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import type { Appointment, Patient } from "@/lib/types";

export const metadata: Metadata = { title: "Patient record" };

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

    return (
      <>
        <BackLink href="/admin/patients">All patients</BackLink>
        <PageHeader
          title="Patient record"
          actions={
            <LinkButton href={`/admin/patients/${id}/edit`} variant="outline">
              <PencilIcon /> Edit details
            </LinkButton>
          }
        />
        <MedicalHistory
          patient={data.patient}
          entries={data.entries}
          visits={data.visits}
          tab={tab}
          canWriteClinical
          newVisitHref={`/admin/patients/${id}/visits/new`}
          visitEditHref={(visitId) => `/admin/patients/${id}/visits/${visitId}/edit`}
        />
      </>
    );
  }

  // Receptionist: contact details, allergies and appointments only.
  const supabase = await createClient();
  const [{ data: patient }, { data: appointments }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).maybeSingle<Patient>(),
    supabase
      .from("appointments")
      .select("*, doctors(name, specialty)")
      .eq("patient_id", id)
      .order("slot_start", { ascending: false })
      .limit(20)
      .returns<Appointment[]>(),
  ]);
  if (!patient) notFound();

  const rows: [string, string | null][] = [
    ["Age", `${ageFromDob(patient.dob)} yrs`],
    ["Date of birth", formatDate(patient.dob)],
    ["Gender", patient.gender],
    ["Phone", displayPhone(patient.phone)],
    ["WhatsApp", displayPhone(patient.whatsapp)],
    ["Food allergies", patient.food_allergies ?? (patient.no_known_allergies ? "None" : null)],
    ["Drug allergies", patient.drug_allergies ?? (patient.no_known_allergies ? "None" : null)],
    ["Emergency contact", [patient.emergency_contact_name, displayPhone(patient.emergency_contact_phone)].filter(Boolean).join(" · ") || null],
  ];

  return (
    <>
      <BackLink href="/admin/patients">All patients</BackLink>
      <PageHeader
        title={patient.full_name}
        actions={
          <>
            <LinkButton href={`/admin/patients/${id}/edit`} variant="outline">
              <PencilIcon /> Edit details
            </LinkButton>
            <LinkButton href={`/admin/appointments/new?patient=${id}`}>Book appointment</LinkButton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right capitalize">{v || "-"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <section className="grid content-start gap-3 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Appointments</h2>
          {(appointments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments yet.</p>
          ) : (
            (appointments ?? []).map((a) => (
              <AppointmentCard key={a.id} appointment={a} returnTo={`/admin/patients/${id}`} canCancel staffActions />
            ))
          )}
        </section>
      </div>
    </>
  );
}
