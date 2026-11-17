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
