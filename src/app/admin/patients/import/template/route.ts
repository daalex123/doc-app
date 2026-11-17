import { requireFrontDesk } from "@/lib/auth";
import { TEMPLATE_CSV } from "@/lib/patient-import";

export async function GET() {
  await requireFrontDesk();
  return new Response("\uFEFF" + TEMPLATE_CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="patients-import-template.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
