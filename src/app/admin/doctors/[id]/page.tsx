import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, SubmitButton } from "@/components/form-bits";
import { PageHeader } from "@/components/app-shell";
import { DoctorForm, type DoctorAccount } from "@/components/doctor-form";
import { BackLink } from "@/components/medical-history";
import { requireAdmin } from "@/lib/auth";
import { formatDate, todayColombo, trimTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import {
  addException,
  addSchedule,
  deleteException,
  deleteSchedule,
  saveDoctor,
} from "@/app/actions/admin";
import type { Doctor, Schedule, ScheduleException } from "@/lib/types";

export const metadata: Metadata = { title: "Doctor" };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MESSAGES: Record<string, string> = {
  invalid: "Please check the details and try again.",
  linked: "That login account is already linked to another doctor.",
  schedule: "Choose at least one day, and make sure the end time is after the start time.",
  exception: "Enter a valid date.",
  failed: "Something went wrong. Please try again.",
};

export default async function DoctorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: doctor }, { data: schedules }, { data: exceptions }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("doctors")
        .select("*, profile_id")
        .eq("id", id)
        .maybeSingle<Doctor & { profile_id: string | null }>(),
      supabase
        .from("schedules")
        .select("*")
        .eq("doctor_id", id)
        .order("weekday")
        .order("start_time")
        .returns<Schedule[]>(),
      supabase
        .from("schedule_exceptions")
        .select("*")
        .eq("doctor_id", id)
        .gte("date", todayColombo())
        .order("date")
        .returns<ScheduleException[]>(),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "doctor")
        .order("full_name")
        .returns<DoctorAccount[]>(),
    ]);
  if (!doctor) notFound();

  return (
    <>
      <BackLink href="/admin/doctors">All doctors</BackLink>
      <PageHeader title={doctor.name} description={doctor.specialty} />

      {sp.saved ? (
        <Alert className="mb-4 border-primary/30 bg-primary/5">
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      ) : null}
      {sp.error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{MESSAGES[sp.error] ?? MESSAGES.failed}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <DoctorForm
              action={saveDoctor.bind(null, id)}
              doctor={doctor}
              accounts={accounts ?? []}
              linkedProfileId={doctor.profile_id}
            />
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Working hours</CardTitle>
              <CardDescription>
                Add a row per session. For a lunch break, add a morning and an afternoon row.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {(schedules ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hours set. Patients can&apos;t book until you add some.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {(schedules ?? []).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{DAYS[s.weekday]}</span>{" "}
                        {trimTime(s.start_time)} - {trimTime(s.end_time)}{" "}
                        <span className="text-muted-foreground">({s.slot_minutes} min slots)</span>
                      </span>
                      <form action={deleteSchedule}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="doctor_id" value={id} />
                        <Button type="submit" size="icon-sm" variant="ghost" aria-label="Remove">
                          <Trash2Icon />
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form action={addSchedule.bind(null, id)} className="grid gap-3 rounded-lg border bg-muted/30 p-3">
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">Days</legend>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {DAYS.map((d, i) => (
                      <label key={d} className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" name="weekday" value={i} className="size-4 accent-[var(--primary)]" />
                        {d.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="From" htmlFor="start">
                    <Input id="start" name="start" type="time" defaultValue="09:00" required />
                  </Field>
                  <Field label="To" htmlFor="end">
                    <Input id="end" name="end" type="time" defaultValue="13:00" required />
                  </Field>
                  <Field label="Slot (min)" htmlFor="slot_minutes">
                    <Input id="slot_minutes" name="slot_minutes" type="number" min={5} max={120} step={5} defaultValue={15} required />
                  </Field>
                </div>
                <div>
                  <SubmitButton size="sm" pendingText="Adding...">Add hours</SubmitButton>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Days off</CardTitle>
              <CardDescription>Holidays and leave. No slots are offered on these dates.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {(exceptions ?? []).length > 0 ? (
                <ul className="divide-y rounded-lg border">
                  {(exceptions ?? []).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{formatDate(e.date)}</span>
                        {e.reason ? <span className="text-muted-foreground"> · {e.reason}</span> : null}
                      </span>
                      <form action={deleteException}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="doctor_id" value={id} />
                        <Button type="submit" size="icon-sm" variant="ghost" aria-label="Remove">
                          <Trash2Icon />
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : null}
              <form action={addException.bind(null, id)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Date" htmlFor="ex-date">
                  <Input id="ex-date" name="date" type="date" min={todayColombo()} required />
                </Field>
                <Field label="Reason (optional)" htmlFor="ex-reason" className="sm:col-span-2">
                  <Input id="ex-reason" name="reason" placeholder="Poya day, conference..." />
                </Field>
                <div className="sm:col-span-3">
                  <SubmitButton size="sm" variant="outline" pendingText="Adding...">Add day off</SubmitButton>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
