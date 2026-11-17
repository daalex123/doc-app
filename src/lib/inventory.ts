import type { MedicineForm, MedicineStock, StockKind } from "@/lib/types";

export const MEDICINE_FORMS: { value: MedicineForm; label: string }[] = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "syrup", label: "Syrup" },
  { value: "injection", label: "Injection" },
  { value: "cream", label: "Cream" },
  { value: "drops", label: "Drops" },
  { value: "other", label: "Other" },
];

export const KIND_LABELS: Record<StockKind, string> = {
  receive: "Received",
  dispense: "Dispensed",
  adjust: "Adjusted",
  expired: "Written off (expired)",
};

export const EXPIRY_WARN_DAYS = 60;

/** The text put into a prescription row when a catalog medicine is chosen. */
export const medicineLabel = (m: { name: string; strength: string }) =>
  [m.name, m.strength].filter(Boolean).join(" ");

export type StockLevel = "ok" | "low" | "out";

export function stockLevel(m: Pick<MedicineStock, "stock" | "reorder_level">): StockLevel {
  if (m.stock <= 0) return "out";
  if (m.stock <= m.reorder_level) return "low";
  return "ok";
}

export type ExpiryState = "expired" | "soon" | null;

/** `today` is a YYYY-MM-DD string in clinic time. Only meaningful while stock remains. */
export function expiryState(
  m: Pick<MedicineStock, "stock" | "next_expiry">,
  today: string,
  soonDate: string,
): ExpiryState {
  if (m.stock <= 0 || !m.next_expiry) return null;
  if (m.next_expiry < today) return "expired";
  if (m.next_expiry <= soonDate) return "soon";
  return null;
}
