import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/form-bits";
import { addDays, formatDayChip, formatMoney, formatTime, todayColombo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Doctor } from "@/lib/types";

export interface BookingState {
  patientId?: string;
  doctorId?: string;
  date?: string;
}

export interface Slot {
  slot_start: string;
  slot_end: string;
}

function StepTitle({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {done ? <CheckIcon className="size-3.5" /> : n}
      </span>
      {children}
    </span>
  );
}

export function BookingFlow({
  basePath,
  state,
  picker,
  patientName,
  doctors,
  slots,
  action,
  error,
  maxAdvanceDays,
  stickyCta,
}: {
  basePath: string;
  state: BookingState;
  /** Step 1 UI (choose the patient). Differs between patient portal and admin. */
  picker: React.ReactNode;
  patientName?: string;
  doctors: Doctor[];
  slots: Slot[] | null;
  action: (formData: FormData) => Promise<void>;
  error?: string;
  maxAdvanceDays: number;
  /** Pin the confirm button above the mobile tab bar (patient portal). */
  stickyCta?: boolean;
}) {
  const today = todayColombo();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const doctor = doctors.find((d) => d.id === state.doctorId);

  const href = (patch: Partial<BookingState>) => {
    const next = { ...state, ...patch };
    const q = new URLSearchParams();
    if (next.patientId) q.set("patient", next.patientId);
    if (next.doctorId) q.set("doctor", next.doctorId);
    if (next.date) q.set("date", next.date);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const retry = href({});

  return (
    <div className="grid gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <StepTitle n={1} done={!!state.patientId}>Who is this for?</StepTitle>
          </CardTitle>
          {patientName ? <CardDescription>Booking for {patientName}</CardDescription> : null}
        </CardHeader>
        <CardContent>{picker}</CardContent>
      </Card>

      {state.patientId ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <StepTitle n={2} done={!!doctor}>Choose a doctor</StepTitle>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {doctors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No doctors are available yet.</p>
            ) : null}
            {doctors.map((d) => (
              <Link
                key={d.id}
                href={href({ doctorId: d.id })}
                aria-current={d.id === state.doctorId ? "true" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-accent/50",
                  d.id === state.doctorId && "border-primary bg-accent ring-1 ring-primary",
                )}
              >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-foreground">
                  {d.name.replace(/^Dr\.?\s*/i, "").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{d.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">{d.specialty}</span>
                  <span className="mt-0.5 block text-sm font-semibold text-primary">{formatMoney(d.fee)}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {state.patientId && doctor ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <StepTitle n={3} done={!!state.date}>Pick a date</StepTitle>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => {
                const c = formatDayChip(d);
                const active = d === state.date;
                return (
                  <Link
                    key={d}
                    href={href({ date: d })}
                    aria-current={active ? "date" : undefined}
                    className={cn(
                      "flex w-16 shrink-0 flex-col items-center rounded-2xl border px-2 py-2.5 text-center transition-colors hover:bg-accent/50",
                      active && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    <span className="text-xs opacity-80">{c.weekday}</span>
                    <span className="text-lg font-semibold leading-tight">{c.day}</span>
                    <span className="text-xs opacity-80">{c.month}</span>
                  </Link>
                );
              })}
            </div>
            <form method="get" action={basePath} className="flex flex-wrap items-center gap-2 text-sm">
              {state.patientId ? <input type="hidden" name="patient" value={state.patientId} /> : null}
              <input type="hidden" name="doctor" value={doctor.id} />
              <label htmlFor="date-other" className="text-muted-foreground">Or another date:</label>
              <input
                id="date-other"
                type="date"
                name="date"
                min={today}
                max={addDays(today, maxAdvanceDays)}
                defaultValue={state.date}
                className="h-10 rounded-xl border border-input bg-secondary px-3 text-sm"
              />
              <button type="submit" className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-muted">
                Go
              </button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {state.patientId && doctor && state.date && slots ? (
        <Card className={cn(stickyCta && "overflow-visible")}>
          <CardHeader>
            <CardTitle>
              <StepTitle n={4} done={false}>Choose a time</StepTitle>
            </CardTitle>
            <CardDescription>
              {doctor.name} on {formatDayChip(state.date).weekday}, {formatDayChip(state.date).day}{" "}
              {formatDayChip(state.date).month}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No free slots on this day. Please try another date.
              </p>
            ) : (
              <form action={action} className="grid gap-4">
                <input type="hidden" name="patient_id" value={state.patientId} />
                <input type="hidden" name="doctor_id" value={doctor.id} />
                <input type="hidden" name="retry" value={retry} />
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6" role="radiogroup" aria-label="Time slots">
                  {slots.map((s) => (
                    <label key={s.slot_start} className="cursor-pointer">
                      <input
                        type="radio"
                        name="slot"
                        value={s.slot_start}
                        required
                        className="peer sr-only"
                      />
                      <span className="flex h-12 items-center justify-center rounded-xl border-transparent bg-secondary text-sm font-medium transition-colors hover:bg-accent/60 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                        {formatTime(s.slot_start)}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="reason" className="text-sm font-medium">
                    Reason for visit (optional)
                  </label>
                  <Textarea id="reason" name="reason" rows={2} maxLength={500} placeholder="e.g. Fever for 2 days" />
                </div>
                <div
                  className={cn(
                    stickyCta &&
                      "sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 -mx-1 rounded-2xl bg-background/90 p-1 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0",
                  )}
                >
                  <SubmitButton
                    pendingText="Booking..."
                    className={cn(stickyCta && "h-14 w-full rounded-xl text-base font-bold md:h-9 md:w-auto md:rounded-lg md:text-sm md:font-medium")}
                  >
                    Confirm appointment
                  </SubmitButton>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
