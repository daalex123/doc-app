import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Doctor, Patient } from "@/lib/types";

export interface ClinicSettings {
  name: string;
  whatsapp: string;
  cancel_window_hours: number;
  max_advance_days: number;
}

export const getSettings = cache(async (): Promise<ClinicSettings> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_settings")
    .select("name, whatsapp, cancel_window_hours, max_advance_days")
    .single<ClinicSettings>();
  return (
    data ?? { name: "Clinic", whatsapp: "+94777724098", cancel_window_hours: 4, max_advance_days: 60 }
  );
});

export const getActiveDoctors = cache(async (): Promise<Doctor[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("doctors")
    .select("id, name, specialty, bio, fee, active")
    .eq("active", true)
    .order("name")
    .returns<Doctor[]>();
  return data ?? [];
});

/** Patients that belong to the signed-in account (self first). */
export async function getMyPatients(accountId: string): Promise<Patient[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("*")
    .eq("account_id", accountId)
    .is("archived_at", null)
    .order("is_self", { ascending: false })
    .order("created_at")
    .returns<Patient[]>();
  return data ?? [];
}
