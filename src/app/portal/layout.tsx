import { AppShell } from "@/components/app-shell";
import { requirePatientUser } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePatientUser();

  return (
    <AppShell
      user={user}
      homeHref="/portal"
      nav={[
        { href: "/portal", label: "Home", exact: true },
        { href: "/portal/book", label: "Book" },
        { href: "/portal/appointments", label: "Appointments" },
        { href: "/portal/history", label: "Medical history" },
        { href: "/portal/patients", label: "My profiles" },
      ]}
    >
      {children}
    </AppShell>
  );
}
