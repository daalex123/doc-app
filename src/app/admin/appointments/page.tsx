import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/form-bits";
import { PageHeader } from "@/components/app-shell";
import { AppointmentCard } from "@/components/appointment-list";
import { LinkButton } from "@/components/link-button";
import { isClinicalRole, requireStaff } from "@/lib/auth";
import { BOOKING_ERRORS } from "@/lib/booking-errors";
import { addDays, dayEndIso, dayStartIso, formatDate, isValidDateString, todayColombo } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getActiveDoctors } from "@/lib/queries";
import type { Appointment } from "@/lib/types";

export const metadata: Metadata = { title: "Appointments" };

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    doctor?: string;
    status?: string;
    booked?: string;
    cancelled?: string;
    error?: string;
  }>;
}) {
  const user = await requireStaff();
  const clinical = isClinicalRole(user.profile.role);
  const sp = await searchParams;
  const today = todayColombo();
  const date = isValidDateString(sp.date) ? sp.date : today;

  const supabase = await createClient();
  const doctors = await getActiveDoctors();

  let query = supabase
    .from("appointments")
    .select("*, patients(full_name, phone, food_allergies, drug_allergies), doctors(name, specialty)")
    .gte("slot_start", dayStartIso(date))
    .lt("slot_start", dayEndIso(date))
    .order("slot_start");
  if (sp.doctor) query = query.eq("doctor_id", sp.doctor);
  if (sp.status && ["confirmed", "completed", "cancelled", "no_show"].includes(sp.status)) {
    query = query.eq("status", sp.status);
  }
  const { data } = await query.returns<Appointment[]>();
  const list = data ?? [];

  const qs = (d: string) => {
    const q = new URLSearchParams({ date: d });
    if (sp.doctor) q.set("doctor", sp.doctor);
    if (sp.status) q.set("status", sp.status);
    return `/admin/appointments?${q}`;
  };
  const returnTo = qs(date);

  return (
    <>
      <PageHeader
        title="Appointments"
        description={date === today ? `Today, ${formatDate(date)}` : formatDate(date)}
        actions={
          <LinkButton href="/admin/appointments/new">
            <CalendarPlusIcon /> New booking
          </LinkButton>
        }
      />

      {sp.booked ? (
        <Alert className="mb-4 border-primary/30 bg-primary/5">
          <AlertDescription>Appointment booked.</AlertDescription>
        </Alert>
      ) : null}
      {sp.cancelled ? (
        <Alert className="mb-4">
          <AlertDescription>Appointment cancelled.</AlertDescription>
        </Alert>
      ) : null}
      {sp.error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{BOOKING_ERRORS[sp.error] ?? BOOKING_ERRORS.failed}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={qs(addDays(date, -1))} aria-label="Previous day" className="rounded-lg border bg-background p-1.5 hover:bg-muted">
          <ChevronLeftIcon className="size-4" />
        </Link>
        <Link href={qs(today)} className="rounded-lg border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
          Today
        </Link>
        <Link href={qs(addDays(date, 1))} aria-label="Next day" className="rounded-lg border bg-background p-1.5 hover:bg-muted">
          <ChevronRightIcon className="size-4" />
        </Link>

        <form method="get" className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="date"
            name="date"
            defaultValue={date}
            aria-label="Date"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          />
          <NativeSelect name="doctor" defaultValue={sp.doctor ?? ""} aria-label="Doctor" className="w-auto">
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </NativeSelect>
          <NativeSelect name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="w-auto">
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </NativeSelect>
          <button type="submit" className="h-8 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted">
            Filter
          </button>
        </form>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No appointments for this selection.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              returnTo={returnTo}
              canCancel
              staffActions
              showPatient
              extra={
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link href={`/admin/patients/${a.patient_id}`} className="text-primary hover:underline">
                    Open record
                  </Link>
                  {clinical && (a.status === "confirmed" || a.status === "completed") ? (
                    <Link
                      href={`/admin/patients/${a.patient_id}/visits/new?appointment=${a.id}`}
                      className="text-primary hover:underline"
                    >
                      Start visit
                    </Link>
                  ) : null}
                  {a.patients?.food_allergies || a.patients?.drug_allergies ? (
                    <span className="text-destructive">
                      Allergies: {[a.patients.food_allergies, a.patients.drug_allergies].filter(Boolean).join("; ")}
                    </span>
                  ) : null}
                </div>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
