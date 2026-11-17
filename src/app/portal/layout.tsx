import { AppShell } from "@/components/app-shell";
import { requirePatientUser } from "@/lib/auth";
import { signAvatarUrl } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePatientUser();

  const supabase = await createClient();
  const { data: self } = await supabase
    .from("patients")
    .select("avatar_path")
    .eq("account_id", user.id)
    .eq("is_self", true)
    .maybeSingle<{ avatar_path: string | null }>();

  return (
    <AppShell
      user={user}
      avatarUrl={await signAvatarUrl(self?.avatar_path)}
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
