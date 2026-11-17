import type { Metadata } from "next";
import { CalendarPlusIcon, FileHeartIcon, StethoscopeIcon, UserPlusIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { AppointmentCard } from "@/components/appointment-list";
import { LinkButton } from "@/components/link-button";
import { requirePatientUser } from "@/lib/auth";
import { signAvatarUrls } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { getMyPatients } from "@/lib/queries";
import type { Appointment } from "@/lib/types";

export const metadata: Metadata = { title: "Home" };

export default async function PortalHome() {
  const user = await requirePatientUser();
  const patients = await getMyPatients(user.id);
  const firstName = (user.profile.full_name ?? "").split(" ")[0] || "there";

  if (patients.length === 0) {
    return (
      <>
        <PageHeader title={`Welcome, ${firstName}`} description="One quick step before you can book." />
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Add your details</CardTitle>
            <CardDescription>
              We need a few basic details (name, date of birth, phone and allergies) so the doctor
              has what they need when you arrive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LinkButton href="/portal/patients/new?self=1&next=/portal/book" className="h-12 rounded-xl px-5 text-base font-bold">
              <UserPlusIcon /> Add my details
            </LinkButton>
          </CardContent>
        </Card>
      </>
    );
  }

  const supabase = await createClient();
  const { data: upcoming } = await supabase
    .from("appointments")
    .select("*, patients(full_name, phone, food_allergies, drug_allergies, avatar_path), doctors(name, specialty)")
    .eq("status", "confirmed")
    .gte("slot_end", new Date().toISOString())
    .order("slot_start")
    .limit(5)
    .returns<Appointment[]>();

  const avatarUrls = await signAvatarUrls((upcoming ?? []).map((a) => a.patients?.avatar_path));

  return (
    <>
      <section className="mb-6 flex items-center gap-4 overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Hello, {firstName}</h1>
          <p className="mt-1 text-sm text-primary-foreground/90">See your doctor without the waiting room.</p>
          <LinkButton
            href="/portal/book"
            variant="secondary"
            className="mt-4 h-11 rounded-xl bg-white px-4 text-sm font-bold text-primary hover:bg-white/90"
          >
            <CalendarPlusIcon /> Book an appointment
          </LinkButton>
        </div>
        <span className="hidden size-20 shrink-0 items-center justify-center rounded-3xl bg-white/15 min-[380px]:flex">
          <StethoscopeIcon className="size-10" />
        </span>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold tracking-tight">
          Upcoming appointments
        </h2>
        {upcoming && upcoming.length > 0 ? (
          <div className="grid gap-3">
            {upcoming.map((a) => (
              <AppointmentCard
                avatarUrls={avatarUrls}
                key={a.id}
                appointment={a}
                returnTo="/portal"
                canCancel
                showPatient={patients.length > 1}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-6">
              <p className="text-sm text-muted-foreground">You have no upcoming appointments.</p>
              <LinkButton href="/portal/book" variant="outline" className="h-10 rounded-xl px-4">Book now</LinkButton>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileHeartIcon className="size-4 text-primary" /> Medical history
            </CardTitle>
            <CardDescription>Visits, prescriptions, allergies and conditions.</CardDescription>
          </CardHeader>
          <CardContent>
            <LinkButton href="/portal/history" variant="outline" className="h-10 rounded-xl px-4">View history</LinkButton>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlusIcon className="size-4 text-primary" /> Family members
            </CardTitle>
            <CardDescription>Book and keep records for children or parents.</CardDescription>
          </CardHeader>
          <CardContent>
            <LinkButton href="/portal/patients" variant="outline" className="h-10 rounded-xl px-4">Manage profiles</LinkButton>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
