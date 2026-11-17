import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HistoryEntry, Patient, Visit } from "@/lib/types";

export interface MedicalHistoryData {
  patient: Patient;
  entries: HistoryEntry[];
  visits: Visit[];
}

/** Everything about one patient. RLS decides what the current user may see. */
export async function loadMedicalHistory(patientId: string): Promise<MedicalHistoryData | null> {
  const supabase = await createClient();

  const [{ data: patient }, { data: entries }, { data: visits }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", patientId).maybeSingle<Patient>(),
    supabase
      .from("history_entries")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .returns<HistoryEntry[]>(),
    supabase
      .from("visits")
      .select("*, doctors(name), prescription_items(*)")
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false })
      .returns<Visit[]>(),
  ]);

  if (!patient) return null;
  return { patient, entries: entries ?? [], visits: visits ?? [] };
}
