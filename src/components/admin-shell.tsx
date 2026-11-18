"use client";

import { BrandLogo } from "@/components/brand-logo";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDaysIcon,
  LayoutDashboardIcon,
  ClipboardListIcon,
  FileTextIcon,
  LogOutIcon,
  PackageIcon,
  MenuIcon,
  StethoscopeIcon,
  UserCogIcon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminIconKey = "dashboard" | "appointments" | "patients" | "doctors" | "staff" | "inventory" | "templates" | "visits";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: AdminIconKey;
  exact?: boolean;
}

const ICONS: Record<AdminIconKey, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  appointments: CalendarDaysIcon,
  patients: UsersIcon,
  doctors: StethoscopeIcon,
  staff: UserCogIcon,
  inventory: PackageIcon,
  templates: ClipboardListIcon,
  visits: FileTextIcon,
};


function SidebarContent({
  nav,
  onNavigate,
}: {
  nav: AdminNavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/admin"
        onClick={onNavigate}
        aria-label="Deyon Dispensary & Pharmacy"
        className="flex h-16 shrink-0 items-center px-5"
      >
        <BrandLogo className="h-10" />
      </Link>
      <nav className="grid gap-1 px-3 py-2" aria-label="Main">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AdminShell({
  nav,
  name,
  role,
  signOutAction,
  children,
}: {
  nav: AdminNavItem[];
  name: string;
  role: string;
  signOutAction: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = nav.find((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="admin-theme flex min-h-screen flex-1 bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-sidebar lg:block">
        <SidebarContent nav={nav} />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            >
              <XIcon className="size-4" />
            </button>
            <SidebarContent nav={nav} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <MenuIcon className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold leading-tight">{current?.label ?? "Admin"}</p>
            <p className="truncate text-xs text-accent-foreground capitalize">{role}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="max-w-48 truncate text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {initials || "?"}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOutIcon className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-3 md:p-5">
          <div className="mx-auto w-full max-w-6xl rounded-2xl border bg-card p-4 shadow-xs md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
