import type { Metadata } from "next";
import Link from "next/link";
import { FootprintsIcon, SearchIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/clickable-row";
import { SubmitButton } from "@/components/form-bits";
import { PageHeader } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { requireClinical } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Visits" };

const PAGE_SIZE = 25;

interface Row {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  visit_date: string;
  complaint: string | null;
  diagnosis: string | null;
  status: "draft" | "finalized";
  patients: { full_name: string } | null;
  doctors: { name: string } | null;
}

type Type = "all" | "walkin" | "booked";

export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; type?: string }>;
}) {
  await requireClinical();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const type: Type = sp.type === "walkin" || sp.type === "booked" ? sp.type : "all";

  const supabase = await createClient();
  let query = supabase
    .from("visits")
    .select(
      "id, patient_id, appointment_id, visit_date, complaint, diagnosis, status, patients!inner(full_name), doctors(name)",
      { count: "exact" },
    )
    .order("visit_date", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (type === "walkin") query = query.is("appointment_id", null);
  if (type === "booked") query = query.not("appointment_id", "is", null);
  if (q) query = query.ilike("patients.full_name", `%${q.replace(/[%*,()]/g, " ").trim()}%`);

  const { data, count } = await query.returns<Row[]>();
  const rows = data ?? [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const href = (p: number, t: Type = type) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (t !== "all") params.set("type", t);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/admin/visits${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Visits"
        description={`${count ?? 0} ${q || type !== "all" ? "matching" : "recorded"}`}
        actions={
          <LinkButton href="/admin/patients?walkin=1">
            <FootprintsIcon /> Walk-in visit
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form method="get" className="flex max-w-md flex-1 gap-2">
          {type !== "all" ? <input type="hidden" name="type" value={type} /> : null}
          <Input name="q" defaultValue={q} placeholder="Search by patient name" aria-label="Search visits" />
          <SubmitButton pendingText="Searching...">
            <SearchIcon /> Search
          </SubmitButton>
        </form>
        <div className="flex gap-1">
          {(["all", "walkin", "booked"] as const).map((t) => (
            <LinkButton key={t} href={href(1, t)} variant={type === t ? "default" : "outline"} size="sm">
              {t === "all" ? "All" : t === "walkin" ? "Walk-in" : "Booked"}
            </LinkButton>
          ))}
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No visits found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 text-xs uppercase tracking-wide hover:bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Complaint / diagnosis</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((v) => (
                  <ClickableRow key={v.id} href={`/admin/patients/${v.patient_id}/visits/${v.id}`} className="hover:bg-accent/40">
                    <TableCell className="whitespace-nowrap">{formatDateTime(v.visit_date)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/patients/${v.patient_id}/visits/${v.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {v.patients?.full_name ?? "Patient"}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden max-w-72 truncate md:table-cell">
                      {[v.complaint, v.diagnosis].filter(Boolean).join(" · ") || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{v.appointment_id ? "Booked" : "Walk-in"}</TableCell>
                    <TableCell className="capitalize">{v.status}</TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 ? <LinkButton href={href(page - 1)} variant="outline" size="sm">Previous</LinkButton> : null}
            {page < pages ? <LinkButton href={href(page + 1)} variant="outline" size="sm">Next</LinkButton> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
