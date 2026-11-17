import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon, UploadIcon, UserPlusIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SubmitButton } from "@/components/form-bits";
import { PageHeader } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { canImportPatients, requireStaff } from "@/lib/auth";
import { formatAge } from "@/lib/dates";
import { displayPhone } from "@/lib/format";
import { PatientAvatar } from "@/components/patient-avatar";
import { signAvatarUrls } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import type { Patient } from "@/lib/types";

export const metadata: Metadata = { title: "Patients" };

const PAGE_SIZE = 25;

type Row = Pick<Patient, "id" | "full_name" | "gender" | "dob" | "phone" | "food_allergies" | "drug_allergies" | "avatar_path">;

export default async function AdminPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();

  const supabase = await createClient();
  let query = supabase
    .from("patients")
    .select("id, full_name, gender, dob, phone, food_allergies, drug_allergies, avatar_path", { count: "exact" })
    .is("archived_at", null)
    .order("full_name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) {
    const term = q.replace(/[,()%*]/g, " ").trim();
    const digits = term.replace(/\D/g, "");
    const filters = [`full_name.ilike.%${term}%`];
    if (digits.length >= 3) filters.push(`phone.ilike.%${digits.replace(/^0/, "")}%`);
    query = query.or(filters.join(","));
  }
  const { data, count } = await query.returns<Row[]>();
  const rows = data ?? [];
  const avatarUrls = await signAvatarUrls(rows.map((r) => r.avatar_path));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/admin/patients?${params}`;
  };

  return (
    <>
      <PageHeader
        title="Patients"
        description={`${count ?? 0} ${q ? "matching" : "registered"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canImportPatients(user.profile.role) ? (
              <LinkButton href="/admin/patients/import" variant="outline">
                <UploadIcon /> Import
              </LinkButton>
            ) : null}
            <LinkButton href="/admin/patients/new">
              <UserPlusIcon /> Add patient
            </LinkButton>
          </div>
        }
      />

      <form method="get" className="mb-4 flex max-w-md gap-2">
        <Input name="q" defaultValue={q} placeholder="Search by name or phone" aria-label="Search patients" />
        <SubmitButton pendingText="Searching...">
          <SearchIcon /> Search
        </SubmitButton>
      </form>

      <Card className="py-0">
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No patients found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 text-xs uppercase tracking-wide hover:bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Age / gender</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Allergies</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const allergies = [p.food_allergies, p.drug_allergies].filter(Boolean).join("; ");
                  return (
                    <TableRow key={p.id} className="hover:bg-accent/40">
                      <TableCell>
                        <Link href={`/admin/patients/${p.id}`} className="flex items-center gap-3 font-medium text-primary hover:underline">
                          <PatientAvatar name={p.full_name} src={p.avatar_path ? avatarUrls[p.avatar_path] : null} size="sm" />
                          {p.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden capitalize sm:table-cell">
                        {formatAge(p.dob)} · {p.gender}
                      </TableCell>
                      <TableCell>{displayPhone(p.phone)}</TableCell>
                      <TableCell className="hidden max-w-60 truncate text-destructive md:table-cell">
                        {allergies || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 ? <LinkButton href={pageHref(page - 1)} variant="outline" size="sm">Previous</LinkButton> : null}
            {page < pages ? <LinkButton href={pageHref(page + 1)} variant="outline" size="sm">Next</LinkButton> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
