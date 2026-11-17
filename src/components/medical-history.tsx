import Link from "next/link";
import {
  AlertTriangleIcon,
  DropletIcon,
  FileTextIcon,
  PencilIcon,
  PillIcon,
  PlusIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryEntryForm } from "@/components/history-entry-form";
import { LinkButton } from "@/components/link-button";
import { ageFromDob, formatDate, formatInstantDate } from "@/lib/dates";
import { displayPhone } from "@/lib/format";
import { setHistoryStatus } from "@/app/actions/records";
import { HISTORY_CATEGORIES, type HistoryEntry, type Patient, type Visit, type Vitals } from "@/lib/types";

const VITAL_LABELS: [keyof Vitals, string, string][] = [
  ["bp", "BP", "mmHg"],
  ["pulse", "Pulse", "bpm"],
  ["temperature", "Temp", "°C"],
  ["weight", "Weight", "kg"],
  ["height", "Height", "cm"],
  ["sugar", "Sugar", "mg/dL"],
];

function Summary({ patient, entries }: { patient: Patient; entries: HistoryEntry[] }) {
  const active = (c: string) => entries.filter((e) => e.category === c && e.status === "active");
  const allergyEntries = active("allergy");
  const conditions = active("condition");
  const meds = active("medication");

  const hasAllergy =
    !!patient.food_allergies || !!patient.drug_allergies || allergyEntries.length > 0;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">{patient.full_name}</CardTitle>
            <CardDescription>
              {ageFromDob(patient.dob)} yrs · <span className="capitalize">{patient.gender}</span> · Born{" "}
              {formatDate(patient.dob)} · {displayPhone(patient.phone)}
            </CardDescription>
          </div>
          {patient.blood_group ? (
            <Badge variant="outline" className="gap-1">
              <DropletIcon className="text-destructive" /> {patient.blood_group}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 pt-1 md:grid-cols-3">
        <div
          className={
            hasAllergy
              ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3"
              : "rounded-lg border bg-muted/40 p-3"
          }
        >
          <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
            <AlertTriangleIcon className={hasAllergy ? "size-4 text-destructive" : "size-4 text-muted-foreground"} />
            Allergies
          </h3>
          {hasAllergy ? (
            <ul className="grid gap-1 text-sm">
              {patient.food_allergies ? <li><span className="text-muted-foreground">Food:</span> {patient.food_allergies}</li> : null}
              {patient.drug_allergies ? <li><span className="text-muted-foreground">Drug:</span> {patient.drug_allergies}</li> : null}
              {allergyEntries.map((e) => (
                <li key={e.id}>{e.title}{e.detail ? ` (${e.detail})` : ""}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {patient.no_known_allergies ? "No known allergies" : "Not recorded"}
            </p>
          )}
        </div>
        <div className="rounded-lg border bg-muted/40 p-3">
          <h3 className="mb-1.5 text-sm font-semibold">Chronic conditions</h3>
          {conditions.length ? (
            <ul className="grid gap-1 text-sm">
              {conditions.map((e) => (
                <li key={e.id}>{e.title}{e.year ? ` (${e.year})` : ""}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None recorded</p>
          )}
        </div>
        <div className="rounded-lg border bg-muted/40 p-3">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
            <PillIcon className="size-4 text-muted-foreground" /> Current medications
          </h3>
          {meds.length ? (
            <ul className="grid gap-1 text-sm">
              {meds.map((e) => (
                <li key={e.id}>{e.title}{e.detail ? ` - ${e.detail}` : ""}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None recorded</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VisitCard({ visit, editHref }: { visit: Visit; editHref?: string }) {
  const vitals = VITAL_LABELS.filter(([k]) => visit.vitals?.[k]);
  const items = visit.prescription_items ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>
            {formatInstantDate(visit.visit_date)}
            {visit.doctors?.name ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">{visit.doctors.name}</span>
            ) : null}
          </CardTitle>
          <div className="flex items-center gap-2">
            {visit.status === "draft" ? <Badge variant="outline">Draft</Badge> : null}
            {editHref ? (
              <LinkButton href={editHref} variant="outline" size="sm">
                <PencilIcon /> Edit
              </LinkButton>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {vitals.length ? (
          <div className="flex flex-wrap gap-2">
            {vitals.map(([k, label, unit]) => (
              <span key={k} className="rounded-md bg-muted px-2 py-1">
                <span className="text-muted-foreground">{label}</span>{" "}
                <span className="font-medium">{visit.vitals[k]}</span>{" "}
                <span className="text-xs text-muted-foreground">{unit}</span>
              </span>
            ))}
          </div>
        ) : null}
        {(
          [
            ["Complaint", visit.complaint],
            ["Symptoms", visit.symptoms],
            ["Examination", visit.examination],
            ["Diagnosis", visit.diagnosis],
            ["Treatment", visit.treatment],
            ["Advice", visit.advice],
          ] as const
        ).map(([label, value]) =>
          value ? (
            <div key={label}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="whitespace-pre-line">{value}</p>
            </div>
          ) : null,
        )}
        {items.length ? (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Prescription</p>
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
          <p className="text-sm">
            <span className="text-muted-foreground">Follow-up:</span> {formatDate(visit.follow_up_date)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function MedicalHistory({
  patient,
  entries,
  visits,
  tab = "visits",
  canWriteClinical,
  newVisitHref,
  visitEditHref,
}: {
  patient: Patient;
  entries: HistoryEntry[];
  visits: Visit[];
  tab?: string;
  /** Doctor/admin: can resolve entries, add visits. */
  canWriteClinical?: boolean;
  newVisitHref?: string;
  visitEditHref?: (visitId: string) => string;
}) {
  const prescriptions = visits
    .filter((v) => v.status === "finalized" || canWriteClinical)
    .flatMap((v) => (v.prescription_items ?? []).map((i) => ({ ...i, date: v.visit_date })));

  const byCategory = HISTORY_CATEGORIES.map((c) => ({
    ...c,
    items: entries.filter((e) => e.category === c.value),
  })).filter((c) => c.items.length > 0);

  const tabValue = ["visits", "prescriptions", "background"].includes(tab) ? tab : "visits";

  return (
    <div className="grid gap-6">
      <Summary patient={patient} entries={entries} />

      <Tabs defaultValue={tabValue}>
        <TabsList>
          <TabsTrigger value="visits">Visits ({visits.length})</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions ({prescriptions.length})</TabsTrigger>
          <TabsTrigger value="background">Background history</TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="mt-4 grid gap-4">
          {canWriteClinical && newVisitHref ? (
            <div>
              <LinkButton href={newVisitHref}>
                <PlusIcon /> New visit
              </LinkButton>
            </div>
          ) : null}
          {visits.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <FileTextIcon className="size-8" />
                No visits recorded yet.
              </CardContent>
            </Card>
          ) : (
            visits.map((v) => (
              <VisitCard
                key={v.id}
                visit={v}
                editHref={canWriteClinical && visitEditHref ? visitEditHref(v.id) : undefined}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-4">
          <Card>
            <CardContent className="pt-1">
              {prescriptions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No prescriptions yet.</p>
              ) : (
                <ul className="divide-y">
                  {prescriptions.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                      <span>
                        <span className="font-medium">{p.medicine}</span>{" "}
                        <span className="text-muted-foreground">
                          {[p.dose, p.frequency, p.duration].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">{formatInstantDate(p.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="background" className="mt-4 grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Add to history</CardTitle>
              <CardDescription>
                Conditions, medications, surgeries, family history, immunizations and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HistoryEntryForm patientId={patient.id} />
            </CardContent>
          </Card>

          {byCategory.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            byCategory.map((c) => (
              <Card key={c.value}>
                <CardHeader>
                  <CardTitle>{c.label}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="divide-y">
                    {c.items.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <div>
                          <span className="font-medium">{e.title}</span>
                          {e.year ? <span className="text-muted-foreground"> · {e.year}</span> : null}
                          {e.detail ? <p className="text-muted-foreground">{e.detail}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={e.status === "active" ? "secondary" : "outline"}>
                            {e.status === "active" ? "Current" : "Resolved"}
                          </Badge>
                          {canWriteClinical ? (
                            <form action={setHistoryStatus}>
                              <input type="hidden" name="id" value={e.id} />
                              <input type="hidden" name="patient_id" value={patient.id} />
                              <input type="hidden" name="status" value={e.status === "active" ? "resolved" : "active"} />
                              <Button type="submit" size="xs" variant="ghost">
                                {e.status === "active" ? "Mark resolved" : "Reopen"}
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
      ← {children}
    </Link>
  );
}
