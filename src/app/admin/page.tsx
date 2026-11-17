import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheckIcon, CalendarPlusIcon, CheckCheckIcon, UsersIcon, XCircleIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { AppointmentCard } from "@/components/appointment-list";
import { LinkButton } from "@/components/link-button";
import { isClinicalRole, requireStaff } from "@/lib/auth";
import { addDays, dayEndIso, dayStartIso, formatDate, todayColombo } from "@/lib/dates";
import { signAvatarUrls } from "@/lib/avatars";
import { stockLevel } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";
import type { Appointment, MedicineStock } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

interface FollowUp {
  id: string;
  patient_id: string;
  follow_up_date: string;
  patients: { full_name: string; phone: string } | null;
}

interface TodayVisit {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  visit_date: string;
  complaint: string | null;
  diagnosis: string | null;
  status: "draft" | "finalized";
  patients: { full_name: string } | null;
}

export default async function AdminDashboard() {
  const user = await requireStaff();
  const clinical = isClinicalRole(user.profile.role);
  const today = todayColombo();
  const supabase = await createClient();

  const [{ data: todays }, { count: patientCount }, followUps, { data: stockRows }, visitsToday] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, patients(full_name, phone, food_allergies, drug_allergies, avatar_path), doctors(name, specialty)")
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
    supabase
      .from("medicine_stock")
      .select("id, name, strength, unit, stock, reorder_level")
      .eq("is_active", true)
      .order("name")
      .limit(500)
      .returns<Pick<MedicineStock, "id" | "name" | "strength" | "unit" | "stock" | "reorder_level">[]>(),
    // Visits recorded today, including walk-ins that have no appointment (clinical roles only).
    clinical
      ? supabase
          .from("visits")
          .select("id, patient_id, appointment_id, visit_date, complaint, diagnosis, status, patients(full_name)")
          .gte("visit_date", dayStartIso(today))
          .lt("visit_date", dayEndIso(today))
          .order("visit_date", { ascending: false })
          .returns<TodayVisit[]>()
      : Promise.resolve({ data: [] as TodayVisit[] }),
  ]);
  const visits = visitsToday.data ?? [];
  const walkIns = visits.filter((v) => !v.appointment_id).length;
  const lowStock = (stockRows ?? []).filter((m) => stockLevel(m) !== "ok");
  const outCount = lowStock.filter((m) => m.stock <= 0).length;

  const list = todays ?? [];
  const avatarUrls = await signAvatarUrls(list.map((a) => a.patients?.avatar_path));
  const count = (s: string) => list.filter((a) => a.status === s).length;

  const stats = [
    // Booked appointments plus walk-ins that were seen without a booking.
    { label: "Today's patients", value: list.filter((a) => a.status !== "cancelled").length + walkIns, icon: CalendarCheckIcon },
    { label: "Waiting / confirmed", value: count("confirmed"), icon: UsersIcon },
    { label: clinical ? "Visits recorded" : "Completed", value: clinical ? visits.length : count("completed"), icon: CheckCheckIcon },
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
                avatarUrls={avatarUrls}
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

          {clinical ? (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Visits today ({visits.length})
              </h2>
              {visits.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No visits recorded today.
                  </CardContent>
                </Card>
              ) : (
                <Card size="sm">
                  <CardContent className="grid divide-y">
                    {visits.map((v) => (
                      <Link
                        key={v.id}
                        href={`/admin/patients/${v.patient_id}/visits/${v.id}/edit`}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0 hover:bg-muted/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{v.patients?.full_name ?? "Patient"}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[v.complaint, v.diagnosis].filter(Boolean).join(" · ") || "No details"}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {v.appointment_id ? "Booked" : "Walk-in"}
                          {v.status === "draft" ? " · Draft" : ""}
                        </span>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
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

          <Card size="sm">
            <CardHeader>
              <CardTitle>Low stock</CardTitle>
              <CardDescription>
                {lowStock.length === 0
                  ? "All medicines are above their reorder level."
                  : `${lowStock.length} to reorder${outCount ? `, ${outCount} out of stock` : ""}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {lowStock.length > 0 ? (
                <ul className="grid gap-1.5 text-sm">
                  {lowStock.slice(0, 5).map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <Link href={`/admin/inventory/${m.id}`} className="truncate font-medium hover:underline">
                        {m.name} {m.strength}
                      </Link>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {m.stock} / {m.reorder_level}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <LinkButton href={lowStock.length ? "/admin/inventory?status=low" : "/admin/inventory"} variant="outline" size="sm">
                Open inventory
              </LinkButton>
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
