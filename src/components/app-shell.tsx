import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { LogOutIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { BottomTabs } from "@/components/bottom-tabs";
import { InstallButton, InstallHint, PwaRegister } from "@/components/pwa";
import { PatientAvatar } from "@/components/patient-avatar";
import { signOut } from "@/app/(auth)/actions";
import type { CurrentUser } from "@/lib/auth";

/** Patient app shell: greeting header + bottom tabs on mobile, top nav on desktop. */
export function AppShell({
  user,
  nav,
  homeHref,
  avatarUrl,
  children,
}: {
  /** Signed URL of the signed-in patient's own photo, if any. */
  avatarUrl?: string | null;
  user: CurrentUser;
  nav: NavItem[];
  homeHref: string;
  children: React.ReactNode;
}) {
  const name = user.profile.full_name || user.email || "Account";
  const role = user.profile.role;

  return (
    <div className="client-theme flex min-h-dvh flex-1 flex-col">
      <PwaRegister />

      {/* Mobile greeting header */}
      <header className="px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-2 md:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link
            href="/portal/patients"
            aria-label="Profile"
            className="shrink-0 rounded-full"
          >
            <PatientAvatar name={name} src={avatarUrl} size="md" />
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-xs text-muted-foreground">Hi, welcome back</p>
            <p className="truncate text-base font-semibold">{name}</p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out" className="size-10 rounded-full bg-secondary">
              <LogOutIcon />
            </Button>
          </form>
        </div>
      </header>

      {/* Desktop top nav */}
      <header className="sticky top-0 z-30 hidden border-b bg-background/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
          <Link href={homeHref} aria-label="Deyon Dispensary & Pharmacy" className="shrink-0">
            <BrandLogo className="h-12" />
          </Link>
          <div className="min-w-0 flex-1">
            <NavLinks items={nav} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <InstallButton />
            <PatientAvatar name={name} src={avatarUrl} size="sm" />
            <div className="text-right leading-tight">
              <p className="max-w-40 truncate text-sm font-medium">{name}</p>
              {role !== "patient" ? (
                <Badge variant="secondary" className="capitalize">
                  {role}
                </Badge>
              ) : null}
            </div>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
                <LogOutIcon />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pt-4 pb-28 md:max-w-4xl md:px-4 md:py-8">
        <InstallHint />
        {children}
      </main>

      <BottomTabs />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
