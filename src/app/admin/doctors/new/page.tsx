import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app-shell";
import { DoctorForm, type DoctorAccount } from "@/components/doctor-form";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveDoctor } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Add doctor" };

export default async function NewDoctorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "doctor")
    .order("full_name")
    .returns<DoctorAccount[]>();

  return (
    <>
      <PageHeader title="Add doctor" />
      {error ? (
        <Alert variant="destructive" className="mb-4 max-w-2xl">
          <AlertDescription>
            {error === "linked"
              ? "That login account is already linked to another doctor."
              : "Please check the details and try again."}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="max-w-2xl">
        <DoctorForm action={saveDoctor.bind(null, null)} accounts={data ?? []} />
      </div>
    </>
  );
}
