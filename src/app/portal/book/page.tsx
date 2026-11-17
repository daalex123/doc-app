import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { BookingFlow, type Slot } from "@/components/booking-flow";
import { requirePatientUser } from "@/lib/auth";
import { BOOKING_ERRORS } from "@/lib/booking-errors";
import { addDays, isValidDateString, todayColombo } from "@/lib/dates";
import { PatientAvatar } from "@/components/patient-avatar";
import { signAvatarUrls } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { getActiveDoctors, getMyPatients, getSettings } from "@/lib/queries";
import { bookAsPatient } from "@/app/actions/appointments";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Book an appointment" };

export default async function PortalBookPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; doctor?: string; date?: string; error?: string }>;
}) {
  const user = await requirePatientUser();
  const sp = await searchParams;

  const [patients, doctors, settings] = await Promise.all([
    getMyPatients(user.id),
    getActiveDoctors(),
    getSettings(),
  ]);
  if (patients.length === 0) redirect("/portal/patients/new?self=1&next=/portal/book");

  const patient =
    patients.find((p) => p.id === sp.patient) ?? (patients.length === 1 ? patients[0] : undefined);
  const doctor = doctors.find((d) => d.id === sp.doctor) ?? (doctors.length === 1 ? doctors[0] : undefined);

  const today = todayColombo();
  const date =
    isValidDateString(sp.date) && sp.date >= today && sp.date <= addDays(today, settings.max_advance_days)
      ? sp.date
      : undefined;

  let slots: Slot[] | null = null;
  if (patient && doctor && date) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("available_slots", { p_doctor: doctor.id, p_date: date });
    slots = (data as Slot[] | null) ?? [];
  }

  const avatarUrls = await signAvatarUrls(patients.map((p) => p.avatar_path));
  const avatarOf = (p: (typeof patients)[number]) => (p.avatar_path ? avatarUrls[p.avatar_path] : null);

  const picker =
    patients.length === 1 ? (
      <p className="flex items-center gap-2 text-sm">
        <PatientAvatar name={patients[0].full_name} src={avatarOf(patients[0])} size="sm" />
        <span className="font-medium">{patients[0].full_name}</span>{" "}
        <Link href="/portal/patients/new" className="ml-2 text-primary hover:underline">
          Book for someone else
        </Link>
      </p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {patients.map((p) => {
          const q = new URLSearchParams({ patient: p.id });
          if (doctor) q.set("doctor", doctor.id);
          if (date) q.set("date", date);
          return (
            <Link
              key={p.id}
              href={`/portal/book?${q}`}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/50",
                p.id === patient?.id && "border-primary bg-accent font-medium ring-1 ring-primary",
              )}
            >
              <PatientAvatar name={p.full_name} src={avatarOf(p)} size="sm" />
              {p.full_name}
              {p.is_self ? <span className="ml-1 text-muted-foreground">(me)</span> : null}
            </Link>
          );
        })}
        <Link href="/portal/patients/new" className="flex items-center rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
          + Add family member
        </Link>
      </div>
    );

  return (
    <>
      <PageHeader title="Book an appointment" description="Pick a doctor, a date and a time." />
      <BookingFlow
        basePath="/portal/book"
        state={{ patientId: patient?.id, doctorId: doctor?.id, date }}
        picker={picker}
        patientName={patient?.full_name}
        doctors={doctors.map((d) => ({ ...d, fee: 0 }))}
        slots={slots}
        action={bookAsPatient}
        error={sp.error ? (BOOKING_ERRORS[sp.error] ?? BOOKING_ERRORS.failed) : undefined}
        maxAdvanceDays={settings.max_advance_days}
        stickyCta
      />
    </>
  );
}
