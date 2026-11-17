import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { PwaRegister } from "@/components/pwa";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="client-theme flex min-h-dvh flex-1 flex-col items-center px-5 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-10 md:justify-center md:pt-10">
      <PwaRegister />
      <Link href="/" aria-label="Deyon Dispensary & Pharmacy" className="mb-6">
        <BrandLogo priority className="h-16" />
      </Link>
      <div className="w-full max-w-sm md:rounded-3xl md:border md:bg-card md:p-4 md:shadow-sm">{children}</div>
    </main>
  );
}
