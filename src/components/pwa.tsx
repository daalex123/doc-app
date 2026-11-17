"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, ShareIcon, XIcon } from "lucide-react";

/** Registers the service worker (public/sw.js). Renders nothing. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  }, []);
  return null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "clinic-install-hint-dismissed";

/** Small "Add to home screen" hint (Chromium prompt, or manual steps on iOS Safari). */
export function InstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only capability detection
    setIos(isIos);
    setHidden(standalone || dismissed);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || (!deferred && !ios)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl bg-accent p-3 text-sm text-accent-foreground md:hidden">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        {deferred ? <DownloadIcon className="size-4" /> : <ShareIcon className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Add Clinic to your home screen</p>
        {deferred ? (
          <button
            type="button"
            onClick={async () => {
              await deferred.prompt();
              setDeferred(null);
            }}
            className="mt-1 font-medium underline underline-offset-2"
          >
            Install app
          </button>
        ) : (
          <p className="text-xs">Tap the Share button, then &ldquo;Add to Home Screen&rdquo;.</p>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-lg p-1 hover:bg-background/60">
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
