import Link from "next/link";
import { StethoscopeIcon } from "lucide-react";
import { PwaRegister } from "@/components/pwa";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="client-theme flex min-h-dvh flex-1 flex-col items-center px-5 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-10 md:justify-center md:pt-10">
      <PwaRegister />
      <Link href="/" className="mb-6 flex flex-col items-center gap-2 text-lg font-bold text-primary">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <StethoscopeIcon className="size-7" />
        </span>
        Clinic
      </Link>
      <div className="w-full max-w-sm md:rounded-3xl md:border md:bg-card md:p-4 md:shadow-sm">{children}</div>
    </main>
  );
}
