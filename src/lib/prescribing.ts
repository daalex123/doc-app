import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { medicineLabel } from "@/lib/inventory";
import type { CurrentUser } from "@/lib/auth";
import type { Medicine, PrescribingData, RxRow, RxTemplate } from "@/lib/types";

type RxDb = { medicine: string; dose: string | null; frequency: string | null; duration: string | null; notes: string | null };
const toRow = (i: RxDb): RxRow => ({
  medicine: i.medicine,
  dose: i.dose ?? "",
  frequency: i.frequency ?? "",
  duration: i.duration ?? "",
  notes: i.notes ?? "",
});

/** Everything the visit form needs for its typing shortcuts, fetched once per page load. */
export async function loadPrescribingData(
  supabase: SupabaseClient,
  user: CurrentUser,
  patientId: string,
  excludeVisitId?: string,
): Promise<PrescribingData> {
  const [meds, used, visits, tpls] = await Promise.all([
    supabase
      .from("medicines")
      .select("name, strength, default_dose, default_frequency, default_duration")
      .eq("is_active", true)
      .order("name")
      .returns<Pick<Medicine, "name" | "strength" | "default_dose" | "default_frequency" | "default_duration">[]>(),
    supabase
      .from("prescription_items")
      .select("medicine")
      .order("id", { ascending: false })
      .limit(3000)
      .returns<{ medicine: string }[]>(),
    supabase
      .from("visits")
      .select("id, visit_date, prescription_items(medicine, dose, frequency, duration, notes)")
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false })
      .limit(20)
      .returns<{ id: string; visit_date: string; prescription_items: RxDb[] }[]>(),
    supabase
      .from("prescription_templates")
      .select("id, name, created_by, prescription_template_items(medicine, dose, frequency, duration, notes, position)")
      .order("name")
      .returns<
        { id: string; name: string; created_by: string | null; prescription_template_items: (RxDb & { position: number })[] }[]
      >(),
  ]);

  const catalog = (meds.data ?? []).map((m) => ({
    label: medicineLabel(m),
    dose: m.default_dose ?? "",
    frequency: m.default_frequency ?? "",
    duration: m.default_duration ?? "",
  }));

  // most used first, case-insensitive; skip names already offered by the catalog
  const known = new Set(catalog.map((c) => c.label.toLowerCase()));
  const counts = new Map<string, { name: string; n: number }>();
  for (const r of used.data ?? []) {
    const name = r.medicine.trim();
    if (!name || known.has(name.toLowerCase())) continue;
    const key = name.toLowerCase();
    const cur = counts.get(key);
    if (cur) cur.n++;
    else counts.set(key, { name, n: 1 });
  }
  const recent = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 200).map((c) => c.name);

  const last = (visits.data ?? []).find(
    (v) => v.id !== excludeVisitId && (v.prescription_items?.length ?? 0) > 0,
  );

  const templates: RxTemplate[] = (tpls.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    created_by: t.created_by,
    items: [...(t.prescription_template_items ?? [])].sort((a, b) => a.position - b.position).map(toRow),
  }));

  return {
    catalog,
    recent,
    lastRx: last ? last.prescription_items.map(toRow) : [],
    lastRxDate: last?.visit_date ?? null,
    templates,
    currentUserId: user.id,
    isAdmin: user.profile.role === "admin",
  };
}
