import Link from "next/link";
import {
  AlertTriangleIcon,
  CalendarPlusIcon,
  ClipboardListIcon,
  DropletIcon,
  FileTextIcon,
  HeartPulseIcon,
  PencilIcon,
  PhoneIcon,
  PillIcon,
  PlusIcon,
} from "lucide-react";
import { AppointmentCard } from "@/components/appointment-list";
import { HistoryEntryForm } from "@/components/history-entry-form";
import { LinkButton } from "@/components/link-button";
import { PatientAvatar } from "@/components/patient-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addPrescriptionToMedications, setHistoryStatus } from "@/app/actions/records";
import { formatAge, formatDate, formatInstantDate, isFuture } from "@/lib/dates";
import { displayPhone } from "@/lib/format";
import {
  HISTORY_CATEGORIES,
  type Appointment,
  type HistoryEntry,
  type Patient,
  type Visit,
  type Vitals,
} from "@/lib/types";

/** Admin-only patient record layout. The shared MedicalHistory component (used by the portal) is untouched. */

const VITALS: [keyof Vitals, string, string][] = [
  ["bp", "Blood pressure", "mmHg"],
  ["pulse", "Pulse", "bpm"],
  ["temperature", "Temperature", "°C"],
  ["weight", "Weight", "kg"],
  ["height", "Height", "cm"],
  ["sugar", "Blood sugar", "mg/dL"],
];

function Panel({
  title,
  icon: Icon,
  aside,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold text-foreground/80">
          <Icon className="size-4" /> {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

export function PatientHeaderCard({
  patient,
  avatarUrl,
  patientId,
  showNewVisit,
  children,
}: {
  patient: Patient;
  avatarUrl?: string | null;
  patientId: string;
  showNewVisit?: boolean;
  children?: React.ReactNode;
}) {
  const emergency = [patient.emergency_contact_name, displayPhone(patient.emergency_contact_phone)]
    .filter(Boolean)
    .join(" · ");
  const hasAllergy = !!patient.food_allergies || !!patient.drug_allergies;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <PatientAvatar name={patient.full_name} src={avatarUrl} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{patient.full_name}</h2>
                {patient.blood_group ? (
                  <Badge variant="outline" className="gap-1">
                    <DropletIcon className="text-destructive" /> {patient.blood_group}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="capitalize">{patient.gender}</span> · Age {formatAge(patient.dob)} · Born{" "}
                {formatDate(patient.dob)}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <PhoneIcon className="size-3.5" /> {displayPhone(patient.phone)}
                </span>
                {patient.whatsapp ? <span>WhatsApp {displayPhone(patient.whatsapp)}</span> : null}
                {emergency ? <span>Emergency: {emergency}</span> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/admin/patients/${patientId}/edit`} variant="outline">
              <PencilIcon /> Edit details
            </LinkButton>
            {showNewVisit ? (
              <LinkButton href={`/admin/patients/${patientId}/visits/new`} variant="outline">
                <PlusIcon /> New visit
              </LinkButton>
            ) : null}
            <LinkButton href={`/admin/appointments/new?patient=${patientId}`}>
              <CalendarPlusIcon /> Book appointment
            </LinkButton>
          </div>
        </div>
        {hasAllergy ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <AlertTriangleIcon className="size-4 text-destructive" />
            {patient.food_allergies ? (
              <span className="rounded-md bg-destructive/10 px-2 py-1 font-medium text-destructive">
                Food: {patient.food_allergies}
              </span>
            ) : null}
            {patient.drug_allergies ? (
              <span className="rounded-md bg-destructive/10 px-2 py-1 font-medium text-destructive">
                Drug: {patient.drug_allergies}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function AppointmentsList({ appointments, patientId }: { appointments: Appointment[]; patientId: string }) {
  const upcoming = appointments
    .filter((a) => a.status === "confirmed" && isFuture(a.slot_start))
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start));
  const past = appointments.filter((a) => !upcoming.includes(a));
  const returnTo = `/admin/patients/${patientId}`;

  return (
    <div className="grid gap-6">
      <Panel title="Upcoming appointments" icon={CalendarPlusIcon}>
        {upcoming.length === 0 ? (
          <Empty>No upcoming appointments.</Empty>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} appointment={a} returnTo={returnTo} canCancel staffActions />
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Past appointments" icon={ClipboardListIcon}>
        {past.length === 0 ? (
          <Empty>No past appointments.</Empty>
        ) : (
          <div className="grid gap-3">
            {past.map((a) => (
              <AppointmentCard key={a.id} appointment={a} returnTo={returnTo} canCancel staffActions />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Receptionist view: contact/allergy details + appointments only. */
export function ReceptionistPatientView({
  patient,
  avatarUrl,
  appointments,
  patientId,
}: {
  patient: Patient;
  avatarUrl?: string | null;
  appointments: Appointment[];
  patientId: string;
}) {
  const rows: [string, string | null][] = [
    ["Age", formatAge(patient.dob)],
    ["Date of birth", formatDate(patient.dob)],
    ["Gender", patient.gender],
    ["Phone", displayPhone(patient.phone)],
    ["WhatsApp", displayPhone(patient.whatsapp)],
    ["Food allergies", patient.food_allergies ?? (patient.no_known_allergies ? "None" : null)],
    ["Drug allergies", patient.drug_allergies ?? (patient.no_known_allergies ? "None" : null)],
    [
      "Emergency contact",
      [patient.emergency_contact_name, displayPhone(patient.emergency_contact_phone)].filter(Boolean).join(" · ") ||
        null,
    ],
  ];

  return (
    <div className="grid gap-6">
      <PatientHeaderCard patient={patient} avatarUrl={avatarUrl} patientId={patientId} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Details" icon={FileTextIcon}>
          <dl className="grid gap-2.5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right capitalize">{v || "-"}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <div className="lg:col-span-2">
          <AppointmentsList appointments={appointments} patientId={patientId} />
        </div>
      </div>
    </div>
  );
}

export function AdminPatientRecord({
  patient,
  entries,
  visits,
  appointments,
  avatarUrl,
  tab,
}: {
  patient: Patient;
  entries: HistoryEntry[];
  visits: Visit[];
  appointments: Appointment[];
  avatarUrl?: string | null;
  tab?: string;
}) {
  const active = (c: string) => entries.filter((e) => e.category === c && e.status === "active");
  const allergyEntries = active("allergy");
  const conditions = active("condition");
  const meds = active("medication");
  const medTitles = new Set(meds.map((m) => m.title.trim().toLowerCase()));

  const latestVitals = visits.find((v) => VITALS.some(([k]) => v.vitals?.[k]));
  const rxVisits = visits.filter((v) => (v.prescription_items ?? []).length > 0);
  const prescriptionCount = rxVisits.reduce((n, v) => n + (v.prescription_items ?? []).length, 0);
  const byCategory = HISTORY_CATEGORIES.map((c) => ({
    ...c,
    items: entries.filter((e) => e.category === c.value),
  })).filter((c) => c.items.length > 0);

  const hasAllergy = !!patient.food_allergies || !!patient.drug_allergies || allergyEntries.length > 0;
  const tabValue = ["overview", "visits", "prescriptions", "background", "appointments"].includes(tab ?? "")
    ? (tab as string)
    : "overview";

  return (
    <div className="grid gap-6">
      <PatientHeaderCard patient={patient} avatarUrl={avatarUrl} patientId={patient.id} showNewVisit />

      <Tabs defaultValue={tabValue} className="gap-5">
        <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto border-b pb-2">
          <TabsTrigger value="overview" className="flex-none px-3">Overview</TabsTrigger>
          <TabsTrigger value="visits" className="flex-none px-3">Visits ({visits.length})</TabsTrigger>
          <TabsTrigger value="prescriptions" className="flex-none px-3">
            Prescriptions ({prescriptionCount})
          </TabsTrigger>
          <TabsTrigger value="background" className="flex-none px-3">Background history</TabsTrigger>
          <TabsTrigger value="appointments" className="flex-none px-3">
            Appointments ({appointments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-5">
          <Panel
            title="Vitals"
            icon={HeartPulseIcon}
            aside={
              latestVitals ? (
                <span className="text-xs text-muted-foreground">
                  From visit on {formatInstantDate(latestVitals.visit_date)}
                </span>
              ) : null
            }
          >
            {latestVitals ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
                {VITALS.filter(([k]) => latestVitals.vitals?.[k]).map(([k, label, unit]) => (
                  <div key={k}>
                    <dd className="text-sm font-semibold text-foreground">
                      {latestVitals.vitals[k]} <span className="font-normal text-muted-foreground">{unit}</span>
                    </dd>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                  </div>
                ))}
              </dl>
            ) : (
              <Empty>No vitals recorded yet.</Empty>
            )}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Current medications" icon={PillIcon}>
              {meds.length ? (
                <ul className="divide-y text-sm">
                  {meds.map((e) => (
                    <li key={e.id} className="py-2 first:pt-0 last:pb-0">
                      <p className="font-medium text-foreground">{e.title}</p>
                      {e.detail ? <p className="text-xs text-muted-foreground">{e.detail}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>None recorded.</Empty>
              )}
            </Panel>
            <div className="grid content-start gap-5">
              <Panel title="Chronic conditions" icon={ClipboardListIcon}>
                {conditions.length ? (
                  <ul className="grid gap-1.5 text-sm">
                    {conditions.map((e) => (
                      <li key={e.id}>
                        <span className="font-medium text-foreground">{e.title}</span>
                        {e.year ? <span className="text-muted-foreground"> · {e.year}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>None recorded.</Empty>
                )}
              </Panel>
              <Panel title="Allergies" icon={AlertTriangleIcon}>
                {hasAllergy ? (
                  <ul className="grid gap-1.5 text-sm">
                    {patient.food_allergies ? <li><span className="text-muted-foreground">Food:</span> {patient.food_allergies}</li> : null}
                    {patient.drug_allergies ? <li><span className="text-muted-foreground">Drug:</span> {patient.drug_allergies}</li> : null}
                    {allergyEntries.map((e) => (
                      <li key={e.id}>{e.title}{e.detail ? ` (${e.detail})` : ""}</li>
                    ))}
                  </ul>
                ) : (
                  <Empty>{patient.no_known_allergies ? "No known allergies." : "Not recorded."}</Empty>
                )}
              </Panel>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="visits" className="grid gap-4">
          {visits.length === 0 ? (
            <Panel title="Visits" icon={FileTextIcon}>
              <Empty>No visits recorded yet.</Empty>
            </Panel>
          ) : (
            <ol className="relative grid gap-4 border-l-2 border-primary/20 pl-5 sm:pl-6">
              {visits.map((v) => {
                const vit = VITALS.filter(([k]) => v.vitals?.[k]);
                const items = v.prescription_items ?? [];
                return (
                  <li key={v.id} className="relative">
                    <span className="absolute top-6 -left-[1.72rem] size-3 rounded-full border-2 border-card bg-primary sm:-left-[2.1rem]" />
                    <Panel
                      title={formatInstantDate(v.visit_date)}
                      icon={FileTextIcon}
                      aside={
                        <span className="flex items-center gap-2">
                          {v.doctors?.name ? (
                            <span className="text-xs text-muted-foreground">{v.doctors.name}</span>
                          ) : null}
                          {v.status === "draft" ? <Badge variant="outline">Draft</Badge> : null}
                          <LinkButton
                            href={`/admin/patients/${patient.id}/visits/${v.id}/edit`}
                            variant="outline"
                            size="sm"
                          >
                            <PencilIcon /> Edit
                          </LinkButton>
                        </span>
                      }
                    >
                      <div className="grid gap-3 text-sm">
                        {vit.length ? (
                          <div className="flex flex-wrap gap-2">
                            {vit.map(([k, label, unit]) => (
                              <span key={k} className="rounded-md bg-muted px-2 py-1">
                                <span className="text-muted-foreground">{label}</span>{" "}
                                <span className="font-medium">{v.vitals[k]}</span>{" "}
                                <span className="text-xs text-muted-foreground">{unit}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {(
                          [
                            ["Complaint", v.complaint],
                            ["Symptoms", v.symptoms],
                            ["Examination", v.examination],
                            ["Diagnosis", v.diagnosis],
                            ["Treatment", v.treatment],
                            ["Advice", v.advice],
                          ] as const
                        ).map(([label, value]) =>
                          value ? (
                            <div key={label} className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:pt-0.5">
                                {label}
                              </p>
                              <p className="whitespace-pre-line">{value}</p>
                            </div>
                          ) : null,
                        )}
                        {items.length ? (
                          <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:pt-0.5">
                              Prescription
                            </p>
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
                        {v.follow_up_date ? (
                          <p>
                            <span className="text-muted-foreground">Follow-up:</span> {formatDate(v.follow_up_date)}
                          </p>
                        ) : null}
                      </div>
                    </Panel>
                  </li>
                );
              })}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="prescriptions">
          <Panel title="Prescriptions" icon={PillIcon}>
            {rxVisits.length === 0 ? (
              <Empty>No prescriptions yet.</Empty>
            ) : (
              <div className="grid gap-5">
                {rxVisits.map((v) => (
                  <section key={v.id} className="rounded-xl border">
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
                      <div className="text-sm">
                        <span className="font-semibold">{formatInstantDate(v.visit_date)}</span>
                        <span className="text-muted-foreground">
                          {v.doctors?.name ? ` · ${v.doctors.name}` : ""}
                          {v.diagnosis ? ` · ${v.diagnosis}` : ""}
                        </span>
                        {v.status === "draft" ? (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Draft</span>
                        ) : null}
                      </div>
                      <Link
                        href={`/admin/patients/${patient.id}/visits/${v.id}/edit`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View visit
                      </Link>
                    </header>
                    <ul className="divide-y px-4">
                      {(v.prescription_items ?? []).map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                          <div>
                            <span className="font-medium">{p.medicine}</span>{" "}
                            <span className="text-muted-foreground">
                              {[p.dose, p.frequency, p.duration].filter(Boolean).join(" · ")}
                            </span>
                            {p.notes ? <p className="text-xs text-muted-foreground">{p.notes}</p> : null}
                          </div>
                          {medTitles.has(p.medicine.trim().toLowerCase()) ? (
                            <Badge variant="secondary">In current medications</Badge>
                          ) : (
                            <form action={addPrescriptionToMedications}>
                              <input type="hidden" name="item_id" value={p.id} />
                              <input type="hidden" name="patient_id" value={patient.id} />
                              <Button type="submit" size="xs" variant="outline">
                                <PlusIcon /> Add to current medications
                              </Button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="background" className="grid gap-5">
          <Panel title="Add to history" icon={PlusIcon}>
            <p className="mb-3 text-sm text-muted-foreground">
              Conditions, medications, surgeries, family history, immunizations and more.
            </p>
            <HistoryEntryForm patientId={patient.id} />
          </Panel>
          {byCategory.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            byCategory.map((c) => (
              <Panel key={c.value} title={c.label} icon={ClipboardListIcon}>
                <ul className="divide-y">
                  {c.items.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                      <div>
                        <span className="font-medium">{e.title}</span>
                        {e.year ? <span className="text-muted-foreground"> · {e.year}</span> : null}
                        {e.detail ? <p className="text-muted-foreground">{e.detail}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={e.status === "active" ? "secondary" : "outline"}>
                          {e.status === "active" ? "Current" : "Resolved"}
                        </Badge>
                        <form action={setHistoryStatus}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="patient_id" value={patient.id} />
                          <input type="hidden" name="status" value={e.status === "active" ? "resolved" : "active"} />
                          <Button type="submit" size="xs" variant="ghost">
                            {e.status === "active" ? "Mark resolved" : "Reopen"}
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))
          )}
        </TabsContent>

        <TabsContent value="appointments">
          <AppointmentsList appointments={appointments} patientId={patient.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
