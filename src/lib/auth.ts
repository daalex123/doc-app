import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: Profile;
}

/** Verified user plus role. Redirects to /login when signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", claims.sub)
    .single<Profile>();
  if (!profile) return null;

  return { id: claims.sub, email: (claims.email as string | undefined) ?? null, profile };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

const STAFF: Role[] = ["admin", "doctor", "receptionist"];
const CLINICAL: Role[] = ["admin", "doctor"];

export const isStaffRole = (r: Role) => STAFF.includes(r);
export const isClinicalRole = (r: Role) => CLINICAL.includes(r);

export function homeFor(role: Role): string {
  return isStaffRole(role) ? "/admin" : "/portal";
}

/** Patients only. Staff are sent to the admin area. */
export async function requirePatientUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (isStaffRole(user.profile.role)) redirect("/admin");
  return user;
}

export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isStaffRole(user.profile.role)) redirect("/portal");
  return user;
}

/** Doctor or admin. Receptionists are sent back to the admin home. */
export async function requireClinical(): Promise<CurrentUser> {
  const user = await requireStaff();
  if (!isClinicalRole(user.profile.role)) redirect("/admin");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireStaff();
  if (user.profile.role !== "admin") redirect("/admin");
  return user;
}
