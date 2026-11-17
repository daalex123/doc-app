import { AdminShell, type AdminNavItem } from "@/components/admin-shell";
import { signOut } from "@/app/(auth)/actions";
import { requireStaff } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  const nav: AdminNavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
    { href: "/admin/appointments", label: "Appointments", icon: "appointments" },
    { href: "/admin/patients", label: "Patients", icon: "patients" },
  ];
  if (user.profile.role === "admin") {
    nav.push(
      { href: "/admin/doctors", label: "Doctors", icon: "doctors" },
      { href: "/admin/staff", label: "Staff", icon: "staff" },
    );
  }

  return (
    <AdminShell
      nav={nav}
      name={user.profile.full_name || user.email || "Account"}
      role={user.profile.role}
      signOutAction={signOut}
    >
      {children}
    </AdminShell>
  );
}
