import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { BackLink } from "@/components/medical-history";
import { MedicineForm } from "@/components/inventory-forms";
import { requireClinical } from "@/lib/auth";
import { saveMedicine } from "@/app/actions/inventory";

export const metadata: Metadata = { title: "Add medicine" };

export default async function NewMedicinePage() {
  await requireClinical();
  return (
    <>
      <BackLink href="/admin/inventory">Back to inventory</BackLink>
      <PageHeader title="Add medicine" description="New catalog entry. Receive stock after saving." />
      <div className="max-w-3xl">
        <MedicineForm
          action={saveMedicine.bind(null, undefined)}
          defaults={{ is_active: "on" }}
          cancelHref="/admin/inventory"
          submitLabel="Add medicine"
        />
      </div>
    </>
  );
}
