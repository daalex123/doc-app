import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { requirePatientUser } from "@/lib/auth";
import { ageFromDob } from "@/lib/dates";
import { getMyPatients } from "@/lib/queries";

export const metadata: Metadata = { title: "Medical history" };

export default async function PortalHistoryIndex() {
  const user = await requirePatientUser();
  const patients = await getMyPatients(user.id);

  if (patients.length === 1) redirect(`/portal/history/${patients[0].id}`);

  return (
    <>
      <PageHeader title="Medical history" description="Choose whose history to view." />
      {patients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-6">
            <p className="text-sm text-muted-foreground">Add your details to start your medical history.</p>
            <LinkButton href="/portal/patients/new?self=1">Add my details</LinkButton>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {patients.map((p) => (
            <Link key={p.id} href={`/portal/history/${p.id}`} className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50">
              <p className="font-medium">{p.full_name}</p>
              <p className="text-sm text-muted-foreground">{ageFromDob(p.dob)} yrs</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
