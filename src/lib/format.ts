import { formatDate } from "@/lib/dates";
import type { Patient } from "@/lib/types";

/** +94777724098 -> 077 772 4098 */
export function displayPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const m = /^\+94(\d{2})(\d{3})(\d{4})$/.exec(phone);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : phone;
}

export function patientToDefaults(p?: Patient | null): Record<string, string> {
  if (!p) return {};
  const same = p.whatsapp && p.whatsapp === p.phone;
  return {
    full_name: p.full_name,
    gender: p.gender,
    dob: formatDate(p.dob),
    phone: displayPhone(p.phone),
    whatsapp: same ? "" : displayPhone(p.whatsapp),
    whatsapp_same: same ? "on" : "",
    food_allergies: p.food_allergies ?? "",
    drug_allergies: p.drug_allergies ?? "",
    no_known_allergies: p.no_known_allergies ? "on" : "",
    nic: p.nic ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
    blood_group: p.blood_group ?? "",
    emergency_contact_name: p.emergency_contact_name ?? "",
    emergency_contact_phone: displayPhone(p.emergency_contact_phone),
    guardian_name: p.guardian_name ?? "",
    guardian_phone: displayPhone(p.guardian_phone),
    consent: p.consent_at ? "on" : "",
  };
}

export function clinicWhatsappLink(whatsapp: string, text?: string): string {
  const digits = whatsapp.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
