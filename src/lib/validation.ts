import { z } from "zod";

/** Normalise Sri Lankan mobile numbers to +94XXXXXXXXX, or return null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  let national: string | null = null;
  if (/^\+94\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^94\d{9}$/.test(digits)) national = digits.slice(2);
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{9}$/.test(digits)) national = digits;
  if (!national || !national.startsWith("7")) return null;
  return `+94${national}`;
}

/** DD/MM/YYYY -> YYYY-MM-DD, or null if invalid or in the future. */
export function parseDob(input: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (
    Number.isNaN(d.getTime()) ||
    d.getUTCFullYear() !== Number(yyyy) ||
    d.getUTCMonth() + 1 !== Number(mm) ||
    d.getUTCDate() !== Number(dd)
  ) {
    return null;
  }
  if (d.getTime() > Date.now() || Number(yyyy) < 1900) return null;
  return iso;
}

const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v));

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 077 772 4098" });
      return z.NEVER;
    }
    return n;
  });

const optionalPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mobile number" });
      return z.NEVER;
    }
    return n;
  });

export const patientSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .regex(/^\S+ \S+$/, "Enter exactly two names, e.g. Sheyon Mishenke"),
    gender: z.enum(["female", "male", "other"], { error: "Select a gender" }),
    dob: z.string().transform((v, ctx) => {
      const iso = parseDob(v);
      if (!iso) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date as DD/MM/YYYY" });
        return z.NEVER;
      }
      return iso;
    }),
    phone,
    whatsapp: optionalPhone,
    whatsapp_same: z.boolean(),
    food_allergies: optionalText,
    drug_allergies: optionalText,
    no_known_allergies: z.boolean(),
    nic: optionalText,
    address: optionalText,
    city: optionalText,
    blood_group: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).nullable()),
    emergency_contact_name: optionalText,
    emergency_contact_phone: optionalPhone,
    guardian_name: optionalText,
    guardian_phone: optionalPhone,
    consent: z.boolean().refine((v) => v, "Consent is required to store health data"),
  })
  .superRefine((v, ctx) => {
    if (!v.no_known_allergies && !v.food_allergies && !v.drug_allergies) {
      ctx.addIssue({
        code: "custom",
        path: ["food_allergies"],
        message: "Enter allergies, or tick 'No known allergies'",
      });
    }
  });

export const historyEntrySchema = z.object({
  category: z.enum([
    "allergy", "condition", "medication", "surgery", "past_illness",
    "family", "lifestyle", "immunization", "device", "other",
  ]),
  title: z.string().trim().min(1, "Enter a title").max(200),
  detail: optionalText,
  year: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1900 || n > 2200) {
        ctx.addIssue({ code: "custom", message: "Enter a valid year" });
        return z.NEVER;
      }
      return n;
    }),
  status: z.enum(["active", "resolved"]),
});

export function formString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function formBool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

export type FieldErrors = Record<string, string[] | undefined>;

export function flattenErrors(error: z.ZodError): FieldErrors {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
