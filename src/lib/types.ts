export type Role = "patient" | "receptionist" | "doctor" | "admin";
export type AppointmentStatus = "confirmed" | "completed" | "cancelled" | "no_show";

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
}

export interface Patient {
  id: string;
  account_id: string | null;
  is_self: boolean;
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
  consent_at: string | null;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  bio: string | null;
  fee: number;
  active: boolean;
}

export interface Schedule {
  id: string;
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  active: boolean;
}

export interface ScheduleException {
  id: string;
  doctor_id: string;
  date: string;
  reason: string | null;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  slot_start: string;
  slot_end: string;
  status: AppointmentStatus;
  reason: string | null;
  patients?: Pick<Patient, "full_name" | "phone" | "food_allergies" | "drug_allergies"> | null;
  doctors?: Pick<Doctor, "name" | "specialty"> | null;
}

export type HistoryCategory =
  | "allergy"
  | "condition"
  | "medication"
  | "surgery"
  | "past_illness"
  | "family"
  | "lifestyle"
  | "immunization"
  | "device"
  | "other";

export interface HistoryEntry {
  id: string;
  patient_id: string;
  category: HistoryCategory;
  title: string;
  detail: string | null;
  year: number | null;
  status: "active" | "resolved";
  created_at: string;
}

export interface Vitals {
  bp?: string;
  pulse?: string;
  temperature?: string;
  weight?: string;
  height?: string;
  sugar?: string;
}

export interface PrescriptionItem {
  id: string;
  visit_id: string;
  medicine: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  notes: string | null;
}

export interface Visit {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  doctor_id: string | null;
  visit_date: string;
  complaint: string | null;
  symptoms: string | null;
  vitals: Vitals;
  diagnosis: string | null;
  examination: string | null;
  treatment: string | null;
  advice: string | null;
  follow_up_date: string | null;
  status: "draft" | "finalized";
  doctors?: Pick<Doctor, "name"> | null;
  prescription_items?: PrescriptionItem[];
}

export interface DocumentRow {
  id: string;
  patient_id: string;
  visit_id: string | null;
  title: string;
  file_path: string;
  created_at: string;
}

/** Number of prescription rows shown on the visit form. */
export const RX_ROWS = 8;

export const HISTORY_CATEGORIES: { value: HistoryCategory; label: string }[] = [
  { value: "condition", label: "Chronic condition" },
  { value: "medication", label: "Current medication" },
  { value: "allergy", label: "Allergy" },
  { value: "past_illness", label: "Past illness / admission" },
  { value: "surgery", label: "Surgery / procedure" },
  { value: "family", label: "Family history" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "immunization", label: "Immunization" },
  { value: "device", label: "Implant / device" },
  { value: "other", label: "Other" },
];
