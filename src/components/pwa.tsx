"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, ShareIcon, XIcon } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/* ---- tiny shared store so the install event is never missed ---- */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let listening = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function useInstall() {
  const [state, setState] = useState({ canPrompt: false, ios: false, standalone: true });

  useEffect(() => {
    listen();
    const read = () =>
      setState({
        canPrompt: !!deferredPrompt,
        ios: /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent),
        standalone: installed || isStandalone(),
      });
    read();
    listeners.add(read);
    return () => {
      listeners.delete(read);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    const evt = deferredPrompt;
    deferredPrompt = null; // a prompt can only be used once
    notify();
    await evt.prompt();
    await evt.userChoice;
  };

  return { ...state, install };
}

/** Registers the service worker (public/sw.js) and starts capturing the install prompt. */
export function PwaRegister() {
  useEffect(() => {
    listen();
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  }, []);
  return null;
}

const DISMISS_KEY = "clinic-install-hint-dismissed-at";
const DISMISS_DAYS = 7;

/** "Install app" banner: native prompt on Chrome/Edge/Android, manual steps on iOS Safari. */
export function InstallHint() {
  const { canPrompt, ios, standalone, install } = useInstall();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only
    setHidden(Date.now() - at < DISMISS_DAYS * 86_400_000);
  }, []);

  if (hidden || standalone || (!canPrompt && !ios)) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl bg-accent p-3 text-sm text-accent-foreground">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        {canPrompt ? <DownloadIcon className="size-4" /> : <ShareIcon className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Install Clinic on your device</p>
        {canPrompt ? (
          <button type="button" onClick={install} className="mt-1 font-medium underline underline-offset-2">
            Install app
          </button>
        ) : (
          <p className="text-xs">Tap the Share button, then &ldquo;Add to Home Screen&rdquo;.</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
          setHidden(true);
        }}
        aria-label="Dismiss"
        className="rounded-lg p-1 hover:bg-background/60"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}

/** Always-available install button (e.g. in the header or profile). Hidden once installed or unsupported. */
export function InstallButton({ className }: { className?: string }) {
  const { canPrompt, standalone, install } = useInstall();
  if (standalone || !canPrompt) return null;
  return (
    <button
      type="button"
      onClick={install}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
      }
    >
      <DownloadIcon className="size-3.5" />
      Install app
    </button>
  );
}
