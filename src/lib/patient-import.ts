import Papa from "papaparse";
import ExcelJS from "exceljs";
import { patientSchema } from "@/lib/validation";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 2000;

export const IMPORT_COLUMNS = [
  "full_name", "gender", "dob", "phone", "whatsapp", "food_allergies", "drug_allergies",
  "nic", "blood_group", "address", "city", "emergency_contact_name", "emergency_contact_phone",
  "guardian_name", "guardian_phone",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
const REQUIRED: ImportColumn[] = ["full_name", "gender", "dob", "phone"];

export const TEMPLATE_CSV =
  IMPORT_COLUMNS.join(",") +
  "\r\n" +
  [
    "Nimal Perera", "male", "15/03/1985", "0771234567", "0771234567", "Peanuts", "Penicillin",
    "851234567V", "O+", "12 Galle Road", "Colombo", "Kamala Perera", "0712345678", "", "",
  ].join(",") +
  "\r\n";

export type RawRecord = Partial<Record<ImportColumn, string>>;
export interface ParsedRow {
  /** 1-based spreadsheet row number (header = row 1). */
  row: number;
  data: RawRecord;
}
export type ParseResult = { ok: true; rows: ParsedRow[] } | { ok: false; error: string };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const HEADER_MAP = new Map<string, ImportColumn>([
  ...IMPORT_COLUMNS.map((c) => [squash(c), c] as const),
  ["name", "full_name"],
  ["sex", "gender"],
  ["dateofbirth", "dob"],
  ["birthdate", "dob"],
  ["mobile", "phone"],
  ["bloodtype", "blood_group"],
]);

function mapHeaders(headers: string[]): { map: (ImportColumn | null)[]; error?: string } {
  const map = headers.map((h) => HEADER_MAP.get(squash(h)) ?? null);
  const missing = REQUIRED.filter((c) => !map.includes(c));
  return missing.length
    ? { map, error: `Missing required column(s): ${missing.join(", ")}. Download the template for the expected headers.` }
    : { map };
}

/** Decode bytes as UTF-8 (BOM stripped); fall back to Windows-1252 for legacy Excel CSVs. */
export function decodeText(buf: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("windows-1252").decode(buf);
  }
  return text.replace(/^\uFEFF/, "");
}

function buildRows(table: string[][]): ParseResult {
  if (table.length === 0) return { ok: false, error: "The file is empty." };
  const { map, error } = mapHeaders(table[0]);
  if (error) return { ok: false, error };
  const rows: ParsedRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    const data: RawRecord = {};
    let any = false;
    cells.forEach((cell, idx) => {
      const col = map[idx];
      const v = (cell ?? "").trim();
      if (v) any = true;
      if (col && !data[col]) data[col] = v;
    });
    if (!any) continue;
    rows.push({ row: i + 1, data });
    if (rows.length > MAX_ROWS) return { ok: false, error: `Too many rows. The limit is ${MAX_ROWS} per import.` };
  }
  if (rows.length === 0) return { ok: false, error: "The file has a header but no data rows." };
  return { ok: true, rows };
}

export function parseCsv(buf: Uint8Array): ParseResult {
  const res = Papa.parse<string[]>(decodeText(buf), { skipEmptyLines: "greedy" });
  const fatal = res.errors.find((e) => e.type === "Quotes");
  if (fatal) return { ok: false, error: "The CSV is malformed (unbalanced quotes)." };
  return buildRows(res.data.map((r) => r.map((c) => String(c ?? ""))));
}

const pad = (n: number) => String(n).padStart(2, "0");
const dmy = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;

/** Excel serial day number -> DD/MM/YYYY (1900 date system). */
export function excelSerialToDmy(n: number): string | null {
  if (!Number.isFinite(n) || n < 1 || n > 2958465) return null;
  return dmy(new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000));
}

function cellToString(v: ExcelJS.CellValue, isDob: boolean): string {
  if (v == null) return "";
  if (v instanceof Date) return isDob ? dmy(v) : v.toISOString();
  if (typeof v === "number") {
    if (isDob) return excelSerialToDmy(v) ?? String(v);
    return Number.isInteger(v) ? v.toFixed(0) : String(v);
  }
  if (typeof v === "object") {
    if ("result" in v) return cellToString(v.result as ExcelJS.CellValue, isDob);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("error" in v) return "";
  }
  return String(v);
}

export async function parseXlsx(buf: Uint8Array): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  } catch {
    return { ok: false, error: "Could not read this Excel file. Save it as .xlsx and try again." };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { ok: false, error: "The workbook has no sheets." };
  if (ws.rowCount > MAX_ROWS + 1000) {
    return { ok: false, error: `Too many rows. The limit is ${MAX_ROWS} per import.` };
  }
  const headerRow = ws.getRow(1);
  const width = Math.min(ws.columnCount, 60);
  const headers: string[] = [];
  for (let c = 1; c <= width; c++) headers.push(cellToString(headerRow.getCell(c).value, false).trim());
  const { map, error } = mapHeaders(headers);
  if (error) return { ok: false, error };
  const table: string[][] = [headers];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellToString(row.getCell(c).value, map[c - 1] === "dob"));
    table.push(cells);
  }
  return buildRows(table);
}

export async function parseImportFile(name: string, buf: Uint8Array): Promise<ParseResult> {
  if (buf.byteLength === 0) return { ok: false, error: "The file is empty." };
  if (buf.byteLength > MAX_FILE_BYTES) return { ok: false, error: "The file is larger than 2 MB." };
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return parseCsv(buf);
  if (lower.endsWith(".xlsx")) {
    // xlsx is a zip archive: reject anything else early
    if (!(buf[0] === 0x50 && buf[1] === 0x4b)) return { ok: false, error: "This is not a valid .xlsx file." };
    return parseXlsx(buf);
  }
  return { ok: false, error: "Unsupported file type. Upload a .csv or .xlsx file." };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface PatientInsert {
  full_name: string;
  gender: "female" | "male" | "other";
  dob: string;
  phone: string;
  whatsapp: string | null;
  food_allergies: string | null;
  drug_allergies: string | null;
  no_known_allergies: boolean;
  nic: string | null;
  address: string | null;
  city: string | null;
  blood_group: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
}

export interface ValidatedRow {
  row: number;
  data: RawRecord;
  value?: PatientInsert;
  errors?: Record<string, string[]>;
  duplicate?: string;
}

const NONE = new Set(["none", "nil", "no", "n/a", "na", "no known allergies", "nka", "nkda"]);

function normaliseGender(v: string): string {
  const g = v.trim().toLowerCase();
  if (g === "m") return "male";
  if (g === "f") return "female";
  return g;
}

function normaliseDobText(v: string): string {
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(v.trim());
  return m ? `${pad(Number(m[1]))}/${pad(Number(m[2]))}/${m[3]}` : v.trim();
}

function normaliseBlood(v: string): string {
  return v.replace(/\s+/g, "").toUpperCase();
}

export function validateRow(p: ParsedRow): ValidatedRow {
  const d = p.data;
  const food = d.food_allergies ?? "";
  const drug = d.drug_allergies ?? "";
  const none = NONE.has(food.toLowerCase()) || NONE.has(drug.toLowerCase());
  const parsed = patientSchema.safeParse({
    full_name: (d.full_name ?? "").replace(/\s+/g, " "),
    gender: normaliseGender(d.gender ?? ""),
    dob: normaliseDobText(d.dob ?? ""),
    phone: d.phone ?? "",
    whatsapp: d.whatsapp ?? "",
    whatsapp_same: false,
    food_allergies: none ? "" : food,
    drug_allergies: none ? "" : drug,
    no_known_allergies: none,
    nic: d.nic ?? "",
    address: d.address ?? "",
    city: d.city ?? "",
    blood_group: normaliseBlood(d.blood_group ?? ""),
    emergency_contact_name: d.emergency_contact_name ?? "",
    emergency_contact_phone: d.emergency_contact_phone ?? "",
    guardian_name: d.guardian_name ?? "",
    guardian_phone: d.guardian_phone ?? "",
    consent: true, // asserted by the staff confirmation checkbox, enforced in the action
  });
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (errors[i.path.join(".") || "row"] ??= []).push(i.message);
    return { row: p.row, data: d, errors };
  }
  const { whatsapp_same, consent, ...v } = parsed.data;
  void whatsapp_same;
  void consent;
  return { row: p.row, data: d, value: v as PatientInsert };
}

export const nameKey = (phone: string, name: string) => `${phone}|${name.toLowerCase()}`;
export const nicKey = (nic: string) => nic.replace(/\s+/g, "").toUpperCase();

/** Flags duplicates within the file; DB duplicates are added by the caller via `existing`. */
export function markDuplicates(
  rows: ValidatedRow[],
  existing: { names: Set<string>; nics: Set<string> },
): ValidatedRow[] {
  const seenNames = new Map<string, number>();
  const seenNics = new Map<string, number>();
  for (const r of rows) {
    if (!r.value) continue;
    const nk = nameKey(r.value.phone, r.value.full_name);
    const ck = r.value.nic ? nicKey(r.value.nic) : null;
    if (existing.names.has(nk)) r.duplicate = "Already in the system (same phone and name)";
    else if (ck && existing.nics.has(ck)) r.duplicate = "Already in the system (same NIC)";
    else if (seenNames.has(nk)) r.duplicate = `Duplicate of row ${seenNames.get(nk)} in this file`;
    else if (ck && seenNics.has(ck)) r.duplicate = `Same NIC as row ${seenNics.get(ck)} in this file`;
    if (!r.duplicate) {
      seenNames.set(nk, r.row);
      if (ck) seenNics.set(ck, r.row);
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Error report
// ---------------------------------------------------------------------------

/** Neutralise spreadsheet formula injection. */
export function csvSafe(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function buildErrorReport(rows: ValidatedRow[]): string {
  const header = ["row", "status", "problems", ...IMPORT_COLUMNS];
  const lines = rows
    .filter((r) => !r.value || r.duplicate)
    .map((r) => {
      const problems = r.duplicate
        ? r.duplicate
        : Object.entries(r.errors ?? {}).map(([k, m]) => `${k}: ${m.join(", ")}`).join("; ");
      return [String(r.row), r.duplicate ? "duplicate" : "invalid", problems, ...IMPORT_COLUMNS.map((c) => r.data[c] ?? "")]
        .map((c) => `"${csvSafe(c).replace(/"/g, '""')}"`)
        .join(",");
    });
  return "\uFEFF" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}
