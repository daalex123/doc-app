import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Doctor } from "@/lib/types";

export const metadata: Metadata = { title: "Doctors" };

export default async function AdminDoctorsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("doctors").select("*").order("name").returns<Doctor[]>();
  const doctors = data ?? [];

  return (
    <>
      <PageHeader
        title="Doctors"
        description="Profiles, fees and working hours."
        actions={
          <LinkButton href="/admin/doctors/new">
            <PlusIcon /> Add doctor
          </LinkButton>
        }
      />
      {doctors.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No doctors yet. Add one so patients can book.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {doctors.map((d) => (
            <Link key={d.id} href={`/admin/doctors/${d.id}`} className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{d.name}</p>
                <Badge variant={d.active ? "secondary" : "outline"}>{d.active ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{d.specialty}</p>
              <p className="mt-1 text-sm font-medium text-primary">{formatMoney(d.fee)}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
