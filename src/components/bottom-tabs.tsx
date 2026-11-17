"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlusIcon, ClockIcon, FileHeartIcon, HomeIcon, UserRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/portal", label: "Home", icon: HomeIcon, exact: true },
  { href: "/portal/book", label: "Book", icon: CalendarPlusIcon },
  { href: "/portal/appointments", label: "Visits", icon: ClockIcon },
  { href: "/portal/history", label: "History", icon: FileHeartIcon },
  { href: "/portal/patients", label: "Profile", icon: UserRoundIcon },
] as const;

/** Mobile bottom tab navigation for the patient app (hidden from md up). */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 py-2">
        {TABS.map(({ href, label, icon: Icon, ...rest }) => {
          const exact = "exact" in rest && rest.exact;
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label === "Visits" ? "Appointments" : label === "History" ? "Medical history" : label}
                className="group flex flex-col items-center gap-0.5 py-0.5 text-[11px] font-medium"
              >
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-2xl transition-colors",
                    active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground group-active:bg-muted",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className={active ? "text-primary" : "text-muted-foreground"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
