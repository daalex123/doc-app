import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileHeartIcon,
  MessageCircleIcon,
  PillIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  UserPlusIcon,
} from "lucide-react";
import { InstallButton, PwaRegister } from "@/components/pwa";
import { LinkButton } from "@/components/link-button";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { clinicWhatsappLink, displayPhone } from "@/lib/format";
import { getActiveDoctors, getSettings } from "@/lib/queries";

const FEATURES = [
  {
    icon: CalendarCheckIcon,
    title: "Book in under a minute",
    text: "Pick your doctor, choose a free time, and you're confirmed. No phone calls.",
  },
  {
    icon: FileHeartIcon,
    title: "Your full medical history",
    text: "Visits, prescriptions, allergies and conditions, always at your fingertips.",
  },
  {
    icon: PillIcon,
    title: "Prescriptions in one place",
    text: "See every medicine you've been prescribed, with dose and duration.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Private and secure",
    text: "Only you and your treating doctors can see your health records.",
  },
];

const STEPS = [
  { icon: UserPlusIcon, title: "Create your account", text: "Sign up free and add your details once." },
  { icon: StethoscopeIcon, title: "Choose a doctor", text: "Browse doctors and pick a time that suits you." },
  { icon: CheckCircle2Icon, title: "Get confirmed", text: "Show up and be seen. Your records update automatically." },
];

function initials(name: string) {
  return name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function Home() {
  const [user, doctors, settings] = await Promise.all([
    getCurrentUser(),
    getActiveDoctors(),
    getSettings(),
  ]);
  const whatsapp = clinicWhatsappLink(settings.whatsapp, "Hello, I'd like to ask about an appointment.");
  const bookHref = user ? "/portal/book" : "/signup";

  return (
    <div className="client-theme flex min-h-dvh flex-1 flex-col bg-background">
      <PwaRegister />

      <header className="sticky top-0 z-40 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label={settings.name}>
            <BrandLogo priority className="h-10" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#doctors" className="hover:text-foreground">Doctors</a>
          </nav>
          <div className="flex items-center gap-2">
            <InstallButton />
            {user ? (
              <LinkButton href={homeFor(user.profile.role)} className="h-10 rounded-full px-4">
                Go to dashboard
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="ghost" className="h-10 rounded-full px-3">Sign in</LinkButton>
                <LinkButton href="/signup" className="h-10 rounded-full px-4 font-semibold">Sign up</LinkButton>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_80%_-10%,var(--accent),transparent),radial-gradient(40rem_25rem_at_-10%_30%,var(--accent),transparent)]"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 md:px-4 md:py-24 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-accent-foreground shadow-xs">
                <span className="size-1.5 rounded-full bg-primary" /> Now booking online
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance md:text-6xl">
                See your doctor <span className="text-primary">without the waiting room.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
                Book appointments online and keep your whole medical history in one safe place, at {settings.name}.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href={bookHref} size="lg" className="h-13 w-full rounded-full px-7 text-base font-semibold shadow-lg shadow-primary/25 sm:w-auto">
                  Book an appointment <ArrowRightIcon />
                </LinkButton>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border bg-background px-6 text-sm font-medium hover:bg-muted sm:w-auto"
                >
                  <MessageCircleIcon className="size-4" /> WhatsApp {displayPhone(settings.whatsapp)}
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["Free to sign up", "Instant confirmation", "Records stay private"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckCircle2Icon className="size-4 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Product preview */}
            <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
              <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-primary/10 blur-3xl" />
              <div className="rounded-3xl border bg-card p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Upcoming appointment</p>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">Confirmed</span>
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent/60 p-3">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {doctors[0] ? initials(doctors[0].name) : "DR"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{doctors[0]?.name ?? "Your doctor"}</p>
                    <p className="truncate text-sm text-muted-foreground">{doctors[0]?.specialty ?? "General practice"}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border p-3">
                    <CalendarCheckIcon className="mb-1 size-4 text-primary" />
                    <p className="font-medium">Tomorrow</p>
                    <p className="text-xs text-muted-foreground">Pick any free day</p>
                  </div>
                  <div className="rounded-2xl border p-3">
                    <ClockIcon className="mb-1 size-4 text-primary" />
                    <p className="font-medium">10:30 AM</p>
                    <p className="text-xs text-muted-foreground">15 min slots</p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <PillIcon className="size-4 text-primary" /> Latest prescription
                  </div>
                  <p className="mt-1 text-muted-foreground">Paracetamol 500mg · 1 tablet · every 6 hours</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-14 md:px-4 md:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Care in three simple steps</h2>
              <p className="mt-3 text-muted-foreground">From sign-up to seeing the doctor, it takes minutes.</p>
            </div>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-3xl border bg-card p-6 shadow-xs">
                  <span className="absolute top-5 right-6 text-5xl font-bold text-accent">{i + 1}</span>
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <s.icon className="size-5" />
                  </span>
                  <p className="mt-4 font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-14 md:px-4 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Everything your health needs</h2>
            <p className="mt-3 text-muted-foreground">Simple tools that save you time and keep your records organised.</p>
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="group rounded-3xl border bg-card p-6 transition hover:-translate-y-1 hover:shadow-lg">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="size-5" />
                </span>
                <p className="mt-4 font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Doctors */}
        <section id="doctors" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-14 md:px-4 md:pb-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Meet our doctors</h2>
              <p className="mt-2 text-muted-foreground">Experienced, friendly and ready to help.</p>
            </div>
            <Link href={bookHref} className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex">
              Book now <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          {doctors.length === 0 ? (
            <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Doctor profiles will appear here soon.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((d) => (
                <article key={d.id} className="rounded-3xl border bg-card p-6 transition hover:shadow-lg">
                  <div className="flex items-center gap-4">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                      {initials(d.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">{d.name}</p>
                      <p className="truncate text-sm text-primary">{d.specialty}</p>
                    </div>
                  </div>
                  {d.bio ? <p className="mt-4 line-clamp-3 text-sm text-muted-foreground">{d.bio}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-5 pb-16 md:px-4 md:pb-24">
          <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-center text-primary-foreground md:py-16">
            <div aria-hidden className="absolute -top-20 -right-20 size-72 rounded-full bg-white/10 blur-2xl" />
            <h2 className="relative text-3xl font-bold tracking-tight text-balance md:text-4xl">
              Ready to skip the waiting room?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-primary-foreground/85">
              Create your free account and book your first appointment today.
            </p>
            <div className="relative mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href={bookHref}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-accent-foreground shadow-lg hover:bg-white/90"
              >
                Book an appointment <ArrowRightIcon className="size-4" />
              </Link>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/40 px-6 text-sm font-medium hover:bg-white/10"
              >
                <MessageCircleIcon className="size-4" /> Chat on WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-background py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row">
          <BrandLogo className="h-8" />
          <p>{settings.name} · WhatsApp {displayPhone(settings.whatsapp)}</p>
          <p>© {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
