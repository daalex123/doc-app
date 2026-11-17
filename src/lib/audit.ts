import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Record that the current user viewed or changed a patient's record. Never throws. */
export async function logAccess(
  actorId: string,
  action: "view" | "create" | "update",
  entity: string,
  patientId: string,
  entityId?: string,
) {
  try {
    const supabase = await createClient();
    await supabase.from("audit_log").insert({
      actor_id: actorId,
      action,
      entity,
      patient_id: patientId,
      entity_id: entityId ?? null,
    });
  } catch {
    // Auditing must never break the page.
  }
}

/** Audit a bulk patient import: one "create" row per imported patient. Never throws. */
export async function logImport(actorId: string, patientIds: string[]) {
  try {
    const supabase = await createClient();
    for (let i = 0; i < patientIds.length; i += 500) {
      await supabase.from("audit_log").insert(
        patientIds.slice(i, i + 500).map((id) => ({
          actor_id: actorId,
          action: "create",
          entity: "patient_import",
          patient_id: id,
          entity_id: id,
        })),
      );
    }
  } catch {
    // Auditing must never break the import.
  }
}
