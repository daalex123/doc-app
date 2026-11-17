// All clinic time logic is in Sri Lanka time (UTC+5:30, no DST).
const TZ = "Asia/Colombo";

/** Today's date in Colombo as YYYY-MM-DD. */
export function todayColombo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Add days to a YYYY-MM-DD string. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Colombo calendar date (YYYY-MM-DD) of an ISO instant. */
export function colomboDate(iso: string): string {
  return new Date(Date.parse(iso) + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

/** Start of a Colombo calendar day as an ISO instant. */
export function dayStartIso(date: string): string {
  return new Date(`${date}T00:00:00+05:30`).toISOString();
}

/** Start of the next Colombo calendar day as an ISO instant. */
export function dayEndIso(date: string): string {
  return dayStartIso(addDays(date, 1));
}

export function isValidDateString(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** YYYY-MM-DD -> DD/MM/YYYY */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** ISO instant -> DD/MM/YYYY in Colombo time. */
export function formatInstantDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
  return parts;
}

/** ISO instant -> 12-hour time in Colombo time. */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return `${formatInstantDate(iso)} ${formatTime(iso)}`;
}

/** "Mon, 17 Nov" style label for a YYYY-MM-DD string. */
export function formatDayChip(date: string): { weekday: string; day: string; month: string } {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(d),
    day: new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" }).format(d),
    month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(d),
  };
}

/** True if the instant is in the future. */
export function isFuture(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

export function ageFromDob(dob: string): number {
  const today = todayColombo();
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

/** Human age that stays precise for children: "12 days", "5 months", "3 yrs 4 mos", "44 yrs". Colombo "today". */
export function formatAge(dob: string): string {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ty, tm, td] = todayColombo().split("-").map(Number);
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  if (months < 0) return "0 days";
  if (months < 1) {
    const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  if (months < 24) return `${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years < 18 && rem > 0) return `${years} yrs ${rem} ${rem === 1 ? "mo" : "mos"}`;
  return `${years} yrs`;
}

export function formatMoney(amount: number): string {
  return `LKR ${amount.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function trimTime(t: string): string {
  return t.slice(0, 5);
}
