import type { Metadata } from "next";
import { CheckCircle2Icon, MessageCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { AppointmentCard } from "@/components/appointment-list";
import { LinkButton } from "@/components/link-button";
import { requirePatientUser } from "@/lib/auth";
import { BOOKING_ERRORS } from "@/lib/booking-errors";
import { formatDateTime, isFuture } from "@/lib/dates";
import { clinicWhatsappLink } from "@/lib/format";
import { signAvatarUrls } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { getMyPatients, getSettings } from "@/lib/queries";
import type { Appointment } from "@/lib/types";

export const metadata: Metadata = { title: "My appointments" };

export default async function PortalAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string; cancelled?: string; error?: string }>;
}) {
  const user = await requirePatientUser();
  const sp = await searchParams;
  const supabase = await createClient();

  const [patients, settings, { data }] = await Promise.all([
    getMyPatients(user.id),
    getSettings(),
    supabase
      .from("appointments")
      .select("*, patients(full_name, phone, food_allergies, drug_allergies, avatar_path), doctors(name, specialty)")
      .order("slot_start", { ascending: false })
      .returns<Appointment[]>(),
  ]);

  const all = data ?? [];
  const avatarUrls = await signAvatarUrls(all.map((a) => a.patients?.avatar_path));
  const upcoming = all
    .filter((a) => a.status === "confirmed" && isFuture(a.slot_end))
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start));
  const past = all.filter((a) => !upcoming.includes(a));
  const booked = sp.booked ? all.find((a) => a.id === sp.booked) : undefined;

  const waText = booked
    ? `Hello, I have an appointment on ${formatDateTime(booked.slot_start)} with ${booked.doctors?.name ?? "the doctor"}.`
    : "Hello,";

  return (
    <>
      <PageHeader
        title="My appointments"
        actions={<LinkButton href="/portal/book" className="h-10 rounded-xl px-4">Book an appointment</LinkButton>}
      />

      {booked ? (
        <Alert className="mb-4 border-primary/30 bg-primary/5">
          <CheckCircle2Icon className="text-primary" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Appointment confirmed for <strong>{formatDateTime(booked.slot_start)}</strong>.
            </span>
            <a
              href={clinicWhatsappLink(settings.whatsapp, waText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <MessageCircleIcon className="size-4" /> Message the clinic on WhatsApp
            </a>
          </AlertDescription>
        </Alert>
      ) : null}
      {sp.cancelled ? (
        <Alert className="mb-4">
          <AlertDescription>Your appointment was cancelled.</AlertDescription>
        </Alert>
      ) : null}
      {sp.error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{BOOKING_ERRORS[sp.error] ?? BOOKING_ERRORS.failed}</AlertDescription>
        </Alert>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold tracking-tight">Upcoming</h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">No upcoming appointments.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((a) => (
              <AppointmentCard
                avatarUrls={avatarUrls}
                key={a.id}
                appointment={a}
                returnTo="/portal/appointments"
                canCancel
                showPatient={patients.length > 1}
              />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Online cancellation closes {settings.cancel_window_hours} hours before the appointment.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold tracking-tight">Past</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <div className="grid gap-3">
            {past.map((a) => (
              <AppointmentCard
                avatarUrls={avatarUrls}
                key={a.id}
                appointment={a}
                returnTo="/portal/appointments"
                showPatient={patients.length > 1}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
