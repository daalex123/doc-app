import Link from "next/link";
import {
  CalendarCheckIcon,
  FileHeartIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PwaRegister } from "@/components/pwa";
import { LinkButton } from "@/components/link-button";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { formatMoney } from "@/lib/dates";
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
    icon: ShieldCheckIcon,
    title: "Private and secure",
    text: "Only you and your treating doctors can see your health records.",
  },
];

export default async function Home() {
  const [user, doctors, settings] = await Promise.all([
    getCurrentUser(),
    getActiveDoctors(),
    getSettings(),
  ]);
  const whatsapp = clinicWhatsappLink(settings.whatsapp, "Hello, I'd like to ask about an appointment.");

  return (
    <div className="client-theme flex min-h-dvh flex-1 flex-col">
      <PwaRegister />
      <header className="border-b bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <StethoscopeIcon className="size-4" />
            </span>
            {settings.name}
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <LinkButton href={homeFor(user.profile.role)}>Go to dashboard</LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="ghost" className="h-10 rounded-xl px-3">Sign in</LinkButton>
                <LinkButton href="/signup" className="h-10 rounded-xl px-3 font-semibold">Sign up</LinkButton>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-background">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:px-4 md:py-20 lg:grid-cols-5 lg:items-center">
            <div className="lg:col-span-3">
              <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">
                See your doctor without the waiting room.
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground text-pretty">
                Book appointments online and keep your whole medical history in one safe place.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <LinkButton href={user ? "/portal/book" : "/signup"} size="lg" className="h-14 w-full rounded-xl text-base font-bold sm:w-auto sm:px-6">
                  <CalendarCheckIcon /> Book an appointment
                </LinkButton>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border bg-background px-4 text-sm font-medium hover:bg-muted sm:w-auto"
                >
                  <MessageCircleIcon className="size-4" /> WhatsApp {displayPhone(settings.whatsapp)}
                </a>
              </div>
            </div>
            <ul className="grid gap-3 lg:col-span-2">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3 rounded-2xl bg-accent/60 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <f.icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-medium">{f.title}</p>
                    <p className="text-sm text-muted-foreground">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10 md:px-4 md:py-12">
          <h2 className="mb-5 text-2xl font-bold tracking-tight">Our doctors</h2>
          {doctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Doctor profiles will appear here soon.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((d) => (
                <Card key={d.id}>
                  <CardContent className="grid gap-1">
                    <p className="text-lg font-medium">{d.name}</p>
                    <p className="text-sm text-primary">{d.specialty}</p>
                    {d.bio ? <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{d.bio}</p> : null}
                    <p className="mt-2 text-sm font-medium">Consultation {formatMoney(d.fee)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t bg-background py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center text-sm text-muted-foreground">
        {settings.name} · WhatsApp {displayPhone(settings.whatsapp)}
      </footer>
    </div>
  );
}
