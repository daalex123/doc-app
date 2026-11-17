import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type PatientAvatarSize = "sm" | "md" | "lg";

const SIZE: Record<PatientAvatarSize, string> = {
  sm: "size-8",
  md: "size-12",
  lg: "size-20",
};
const TEXT: Record<PatientAvatarSize, string> = {
  sm: "text-xs",
  md: "text-base",
  lg: "text-2xl",
};

// White text on every background below meets WCAG AA (>= 4.5:1).
const PALETTE = [
  "bg-teal-700",
  "bg-sky-700",
  "bg-indigo-700",
  "bg-violet-700",
  "bg-rose-700",
  "bg-orange-700",
  "bg-emerald-700",
  "bg-fuchsia-700",
  "bg-slate-700",
  "bg-cyan-700",
];

export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/** Patient photo (signed URL) or coloured initials. Pass `src` from a server-signed URL. */
export function PatientAvatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: PatientAvatarSize;
  className?: string;
}) {
  return (
    <Avatar role="img" aria-label={name} className={cn(SIZE[size], className)}>
      {src ? <AvatarImage src={src} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback
        aria-hidden
        className={cn("font-semibold tracking-wide text-white", TEXT[size], avatarColor(name))}
      >
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
