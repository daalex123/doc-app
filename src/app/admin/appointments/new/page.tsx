import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app-shell";
import { BookingFlow, type Slot } from "@/components/booking-flow";
import { SubmitButton } from "@/components/form-bits";
import { requireStaff } from "@/lib/auth";
import { BOOKING_ERRORS } from "@/lib/booking-errors";
import { addDays, isValidDateString, todayColombo } from "@/lib/dates";
import { displayPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getActiveDoctors, getSettings } from "@/lib/queries";
import { bookAsStaff } from "@/app/actions/appointments";
import { cn } from "@/lib/utils";
import type { Patient } from "@/lib/types";

export const metadata: Metadata = { title: "New booking" };

type PatientRow = Pick<Patient, "id" | "full_name" | "phone">;

export default async function AdminNewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; patient?: string; doctor?: string; date?: string; error?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const [doctors, settings] = await Promise.all([getActiveDoctors(), getSettings()]);

  let patient: PatientRow | null = null;
  if (sp.patient) {
    const { data } = await supabase
      .from("patients")
      .select("id, full_name, phone")
      .eq("id", sp.patient)
      .maybeSingle<PatientRow>();
    patient = data;
  }

  let matches: PatientRow[] = [];
  const q = sp.q?.trim();
  if (q && !patient) {
    // strip characters that have meaning in PostgREST filters
    const term = q.replace(/[,()%*]/g, " ").trim();
    const digits = term.replace(/\D/g, "");
    const filters = [`full_name.ilike.%${term}%`];
    if (digits.length >= 3) filters.push(`phone.ilike.%${digits.replace(/^0/, "")}%`);
    const { data } = await supabase
      .from("patients")
      .select("id, full_name, phone")
      .is("archived_at", null)
      .or(filters.join(","))
      .order("full_name")
      .limit(10)
      .returns<PatientRow[]>();
    matches = data ?? [];
  }

  const doctor = doctors.find((d) => d.id === sp.doctor) ?? (doctors.length === 1 ? doctors[0] : undefined);
  const today = todayColombo();
  const date =
    isValidDateString(sp.date) && sp.date >= today && sp.date <= addDays(today, settings.max_advance_days)
      ? sp.date
      : undefined;

  let slots: Slot[] | null = null;
  if (patient && doctor && date) {
    const { data } = await supabase.rpc("available_slots", { p_doctor: doctor.id, p_date: date });
    slots = (data as Slot[] | null) ?? [];
  }

  const picker = patient ? (
    <p className="text-sm">
      <span className="font-medium">{patient.full_name}</span>{" "}
      <span className="text-muted-foreground">{displayPhone(patient.phone)}</span>
      <Link href="/admin/appointments/new" className="ml-3 text-primary hover:underline">
        Change
      </Link>
    </p>
  ) : (
    <div className="grid gap-3">
      <form method="get" className="flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Search by name or phone" aria-label="Search patients" />
        <SubmitButton pendingText="Searching...">
          <SearchIcon /> Search
        </SubmitButton>
      </form>
      {q && matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No patients found.{" "}
          <Link href="/admin/patients/new" className="text-primary hover:underline">Add a new patient</Link>
        </p>
      ) : null}
      {matches.length > 0 ? (
        <ul className="grid gap-2">
          {matches.map((m) => {
            const params = new URLSearchParams({ patient: m.id });
            if (doctor) params.set("doctor", doctor.id);
            if (date) params.set("date", date);
            return (
              <li key={m.id}>
                <Link
                  href={`/admin/appointments/new?${params}`}
                  className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent/50")}
                >
                  <span className="font-medium">{m.full_name}</span>
                  <span className="text-muted-foreground">{displayPhone(m.phone)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        New walk-in?{" "}
        <Link href="/admin/patients/new" className="text-primary hover:underline">Register the patient first</Link>.
      </p>
    </div>
  );

  return (
    <>
      <PageHeader title="New booking" description="Book a walk-in or phone appointment." />
      <BookingFlow
        basePath="/admin/appointments/new"
        state={{ patientId: patient?.id, doctorId: doctor?.id, date }}
        picker={picker}
        patientName={patient?.full_name}
        doctors={doctors}
        slots={slots}
        action={bookAsStaff}
        error={sp.error ? (BOOKING_ERRORS[sp.error] ?? BOOKING_ERRORS.failed) : undefined}
        maxAdvanceDays={settings.max_advance_days}
      />
    </>
  );
}
