import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheckIcon, CalendarPlusIcon, CheckCheckIcon, UsersIcon, XCircleIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { AppointmentCard } from "@/components/appointment-list";
import { LinkButton } from "@/components/link-button";
import { isClinicalRole, requireStaff } from "@/lib/auth";
import { addDays, dayEndIso, dayStartIso, formatDate, todayColombo } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Appointment } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

interface FollowUp {
  id: string;
  patient_id: string;
  follow_up_date: string;
  patients: { full_name: string; phone: string } | null;
}

export default async function AdminDashboard() {
  const user = await requireStaff();
  const clinical = isClinicalRole(user.profile.role);
  const today = todayColombo();
  const supabase = await createClient();

  const [{ data: todays }, { count: patientCount }, followUps] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, patients(full_name, phone, food_allergies, drug_allergies), doctors(name, specialty)")
      .gte("slot_start", dayStartIso(today))
      .lt("slot_start", dayEndIso(today))
      .order("slot_start")
      .returns<Appointment[]>(),
    supabase.from("patients").select("id", { count: "exact", head: true }).is("archived_at", null),
    clinical
      ? supabase
          .from("visits")
          .select("id, patient_id, follow_up_date, patients(full_name, phone)")
          .gte("follow_up_date", today)
          .lte("follow_up_date", addDays(today, 7))
          .order("follow_up_date")
          .limit(8)
          .returns<FollowUp[]>()
      : Promise.resolve({ data: [] as FollowUp[] }),
  ]);

  const list = todays ?? [];
  const count = (s: string) => list.filter((a) => a.status === s).length;

  const stats = [
    { label: "Today's appointments", value: list.filter((a) => a.status !== "cancelled").length, icon: CalendarCheckIcon },
    { label: "Waiting / confirmed", value: count("confirmed"), icon: UsersIcon },
    { label: "Completed", value: count("completed"), icon: CheckCheckIcon },
    { label: "Cancelled / no-show", value: count("cancelled") + count("no_show"), icon: XCircleIcon },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Today, ${formatDate(today)}`}
        actions={
          <LinkButton href="/admin/appointments/new">
            <CalendarPlusIcon /> New booking
          </LinkButton>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} size="sm">
            <CardContent className="flex items-center justify-between gap-2">
              <div>
                <p className="text-3xl font-semibold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <s.icon className="size-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s queue</h2>
            <Link href="/admin/appointments" className="text-sm text-primary hover:underline">All appointments</Link>
          </div>
          {list.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No appointments today.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {list.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appointment={a}
                  returnTo="/admin"
                  canCancel
                  staffActions
                  showPatient
                  extra={clinical ? <ClinicalLink appointment={a} /> : null}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="grid content-start gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Patients</CardTitle>
              <CardDescription>{patientCount ?? 0} registered</CardDescription>
            </CardHeader>
            <CardContent>
              <LinkButton href="/admin/patients" variant="outline" size="sm">Open patients</LinkButton>
            </CardContent>
          </Card>

          {clinical ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Follow-ups due (7 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {followUps.data && followUps.data.length > 0 ? (
                  <ul className="grid gap-2 text-sm">
                    {followUps.data.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-2">
                        <Link href={`/admin/patients/${f.patient_id}`} className="font-medium hover:underline">
                          {f.patients?.full_name ?? "Patient"}
                        </Link>
                        <span className="text-xs text-muted-foreground">{formatDate(f.follow_up_date)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None due.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function ClinicalLink({ appointment: a }: { appointment: Appointment }) {
  return (
    <div className="flex gap-3 text-sm">
      <Link href={`/admin/patients/${a.patient_id}`} className="text-primary hover:underline">
        Open record
      </Link>
      {a.status === "confirmed" || a.status === "completed" ? (
        <Link
          href={`/admin/patients/${a.patient_id}/visits/new?appointment=${a.id}`}
          className="text-primary hover:underline"
        >
          Start visit
        </Link>
      ) : null}
    </div>
  );
}
