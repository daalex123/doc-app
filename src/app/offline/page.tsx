import type { Metadata } from "next";
import { WifiOffIcon } from "lucide-react";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="client-theme flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-accent text-accent-foreground">
        <WifiOffIcon className="size-8" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Clinic needs a connection to show your appointments and records. Check your internet and try again.
      </p>
      <a
        href="/portal"
        className="inline-flex h-12 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
      >
        Try again
      </a>
    </main>
  );
}
