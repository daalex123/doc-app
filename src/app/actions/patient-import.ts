"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFrontDesk } from "@/lib/auth";
import { logImport } from "@/lib/audit";
import {
  buildErrorReport,
  markDuplicates,
  nameKey,
  nicKey,
  parseImportFile,
  validateRow,
  type ValidatedRow,
} from "@/lib/patient-import";

export interface PreviewItem {
  row: number;
  name: string;
  status: "valid" | "invalid" | "duplicate";
  messages: string[];
}

export interface ImportState {
  stage?: "preview" | "done";
  error?: string;
  fileName?: string;
  total?: number;
  valid?: number;
  invalid?: number;
  duplicates?: number;
  items?: PreviewItem[];
  itemsTruncated?: boolean;
  errorReport?: string;
  imported?: number;
  failed?: number;
  skipped?: number;
}

const PREVIEW_LIMIT = 300;
const BATCH = 200;

async function loadAndValidate(formData: FormData): Promise<
  { ok: true; rows: ValidatedRow[]; fileName: string } | { ok: false; error: string }
> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a .csv or .xlsx file." };
  const parsed = await parseImportFile(file.name, new Uint8Array(await file.arrayBuffer()));
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const rows = parsed.rows.map(validateRow);
  const supabase = await createClient();
  const phones = [...new Set(rows.flatMap((r) => (r.value ? [r.value.phone] : [])))];
  const nics = [...new Set(rows.flatMap((r) => (r.value?.nic ? [r.value.nic, nicKey(r.value.nic)] : [])))];
  const names = new Set<string>();
  const nicSet = new Set<string>();
  for (let i = 0; i < phones.length; i += 100) {
    const { data, error } = await supabase
      .from("patients")
      .select("full_name, phone")
      .in("phone", phones.slice(i, i + 100))
      .limit(5000);
    if (error) return { ok: false, error: "Could not check for existing patients. Please try again." };
    for (const p of data ?? []) names.add(nameKey(p.phone, p.full_name));
  }
  for (let i = 0; i < nics.length; i += 100) {
    const { data, error } = await supabase
      .from("patients")
      .select("nic")
      .in("nic", nics.slice(i, i + 100))
      .limit(5000);
    if (error) return { ok: false, error: "Could not check for existing patients. Please try again." };
    for (const p of data ?? []) if (p.nic) nicSet.add(nicKey(p.nic));
  }
  markDuplicates(rows, { names, nics: nicSet });
  return { ok: true, rows, fileName: file.name };
}

export async function importPatients(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireFrontDesk();
  const intent = formData.get("intent") === "commit" ? "commit" : "preview";
  if (formData.get("consent") !== "on") {
    return { error: "Please confirm that the patients have consented to their data being stored." };
  }

  const loaded = await loadAndValidate(formData);
  if (!loaded.ok) return { error: loaded.error };
  const { rows, fileName } = loaded;

  const good = rows.filter((r) => r.value && !r.duplicate);
  const duplicates = rows.filter((r) => r.value && r.duplicate);
  const invalid = rows.filter((r) => !r.value);
  const errorReport = invalid.length + duplicates.length > 0 ? buildErrorReport(rows) : undefined;

  if (intent === "preview") {
    const items: PreviewItem[] = rows.map((r) => ({
      row: r.row,
      name: r.data.full_name ?? "",
      status: !r.value ? "invalid" : r.duplicate ? "duplicate" : "valid",
      messages: r.duplicate
        ? [r.duplicate]
        : Object.entries(r.errors ?? {}).map(([k, m]) => `${k}: ${m.join(", ")}`),
    }));
    // problems first, then a sample of valid rows
    const problems = items.filter((i) => i.status !== "valid");
    const ok = items.filter((i) => i.status === "valid");
    const shown = [...problems, ...ok].slice(0, PREVIEW_LIMIT);
    return {
      stage: "preview",
      fileName,
      total: rows.length,
      valid: good.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
      items: shown,
      itemsTruncated: items.length > shown.length,
      errorReport,
    };
  }

  // commit: everything above was re-parsed and re-validated from the uploaded file
  const supabase = await createClient();
  const consentAt = new Date().toISOString();
  const importedIds: string[] = [];
  let failed = 0;
  for (let i = 0; i < good.length; i += BATCH) {
    const chunk = good.slice(i, i + BATCH);
    const payload = chunk.map((r) => ({
      ...r.value!,
      account_id: null,
      is_self: false,
      consent_at: consentAt,
    }));
    const { data, error } = await supabase.from("patients").insert(payload).select("id");
    if (!error && data) {
      importedIds.push(...data.map((d: { id: string }) => d.id));
      continue;
    }
    // batch rejected: retry row by row so one bad row doesn't sink the rest
    for (const row of payload) {
      const one = await supabase.from("patients").insert(row).select("id").single<{ id: string }>();
      if (one.error || !one.data) failed++;
      else importedIds.push(one.data.id);
    }
  }
  await logImport(user.id, importedIds);
  revalidatePath("/admin/patients");

  return {
    stage: "done",
    fileName,
    total: rows.length,
    imported: importedIds.length,
    skipped: invalid.length + duplicates.length,
    failed,
    invalid: invalid.length,
    duplicates: duplicates.length,
    errorReport,
  };
}
