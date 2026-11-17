import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** First and last visible dates (whole weeks, Sunday-first) for the month containing `date`. */
export function calendarRange(date: string) {
  const first = `${date.slice(0, 7)}-01`;
  const nextMonth = addDays(first, 32).slice(0, 7) + "-01";
  const last = addDays(nextMonth, -1);
  const start = addDays(first, -new Date(`${first}T12:00:00Z`).getUTCDay());
  const end = addDays(last, 6 - new Date(`${last}T12:00:00Z`).getUTCDay());
  return { first, last, start, end };
}

/** Month grid with a count per day. Server-rendered; every day is a link. */
export function AppointmentsCalendar({
  date,
  today,
  counts,
  hrefFor,
}: {
  date: string;
  today: string;
  counts: Record<string, number>;
  hrefFor: (date: string) => string;
}) {
  const { first, last, start, end } = calendarRange(date);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const month = Number(first.slice(5, 7)) - 1;
  const prevMonth = addDays(first, -1).slice(0, 7) + "-01";
  const nextMonth = addDays(last, 1);

  return (
    <Card size="sm" className="mb-4">
      <CardContent>
        <div className="mb-2 flex items-center justify-between">
          <Link href={hrefFor(prevMonth)} aria-label="Previous month" className="rounded-lg border p-1.5 hover:bg-muted">
            <ChevronLeftIcon className="size-4" />
          </Link>
          <h2 className="text-sm font-semibold">
            {MONTHS[month]} {first.slice(0, 4)}
          </h2>
          <Link href={hrefFor(nextMonth)} aria-label="Next month" className="rounded-lg border p-1.5 hover:bg-muted">
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1">{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const n = counts[d] ?? 0;
            const inMonth = d.slice(0, 7) === first.slice(0, 7);
            const selected = d === date;
            return (
              <Link
                key={d}
                href={hrefFor(d)}
                aria-label={`${d}${n ? `, ${n} appointment${n === 1 ? "" : "s"}` : ""}`}
                aria-current={selected ? "date" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border text-sm transition-colors hover:bg-muted",
                  !inMonth && "text-muted-foreground/50",
                  d === today && !selected && "border-primary text-primary",
                  selected && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                <span className="font-medium tabular-nums">{Number(d.slice(8))}</span>
                {n > 0 ? (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      selected ? "bg-primary-foreground/20" : "bg-accent text-accent-foreground",
                    )}
                  >
                    {n}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
