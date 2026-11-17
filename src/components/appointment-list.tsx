import { CalendarClockIcon, StethoscopeIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/form-bits";
import { formatInstantDate, formatTime, isFuture } from "@/lib/dates";
import { cancelAppointment, setAppointmentStatus } from "@/app/actions/appointments";
import type { Appointment, AppointmentStatus } from "@/lib/types";

const STATUS: Record<AppointmentStatus, { label: string; dot: string; chip: string }> = {
  confirmed: { label: "Confirmed", dot: "bg-[#168bd9]", chip: "bg-[#168bd9]/10 text-[#0f5f96]" },
  completed: { label: "Completed", dot: "bg-[#129820]", chip: "bg-[#129820]/10 text-[#0d6e17]" },
  cancelled: { label: "Cancelled", dot: "bg-[#b81e42]", chip: "bg-[#b81e42]/10 text-[#8f1733]" },
  no_show: { label: "No-show", dot: "bg-[#8f1eb8]", chip: "bg-[#8f1eb8]/10 text-[#701790]" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.chip}`}>
      <span className={`size-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function AppointmentCard({
  appointment: a,
  returnTo,
  canCancel,
  staffActions,
  showPatient,
  extra,
}: {
  appointment: Appointment;
  returnTo: string;
  /** Show the cancel button (only for confirmed, future appointments). */
  canCancel?: boolean;
  staffActions?: boolean;
  showPatient?: boolean;
  extra?: React.ReactNode;
}) {
  const upcoming = isFuture(a.slot_start);
  const live = a.status === "confirmed";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgb(15_22_35/0.04)] transition-colors hover:bg-muted/40">
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarClockIcon className="size-4 text-primary" />
            {formatInstantDate(a.slot_start)} at {formatTime(a.slot_start)}
          </span>
          <StatusBadge status={a.status} />
        </div>
        {showPatient && a.patients ? (
          <p className="flex items-center gap-1.5 text-sm">
            <UserIcon className="size-4 text-muted-foreground" />
            {a.patients.full_name}
          </p>
        ) : null}
        {a.doctors ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <StethoscopeIcon className="size-4" />
            {a.doctors.name} · {a.doctors.specialty}
          </p>
        ) : null}
        {a.reason ? <p className="text-sm text-muted-foreground">Reason: {a.reason}</p> : null}
        {extra}
      </div>

      <div className="flex flex-wrap gap-2">
        {staffActions && live ? (
          <>
            <form action={setAppointmentStatus}>
              <input type="hidden" name="appointment_id" value={a.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <input type="hidden" name="status" value="completed" />
              <Button type="submit" size="sm" variant="secondary">Mark completed</Button>
            </form>
            {!upcoming ? (
              <form action={setAppointmentStatus}>
                <input type="hidden" name="appointment_id" value={a.id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <input type="hidden" name="status" value="no_show" />
                <Button type="submit" size="sm" variant="outline">No-show</Button>
              </form>
            ) : null}
          </>
        ) : null}
        {canCancel && live && upcoming ? (
          <form action={cancelAppointment}>
            <input type="hidden" name="appointment_id" value={a.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <ConfirmButton
              size="sm"
              variant="destructive"
              message="Cancel this appointment? The time slot will be released."
            >
              Cancel
            </ConfirmButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}
