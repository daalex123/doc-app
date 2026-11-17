import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, SearchIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect, SubmitButton } from "@/components/form-bits";
import { PageHeader } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { StockBadges } from "@/components/stock-badges";
import { isClinicalRole, requireStaff } from "@/lib/auth";
import { addDays, formatMoney, todayColombo } from "@/lib/dates";
import { EXPIRY_WARN_DAYS, MEDICINE_FORMS, expiryState, stockLevel } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";
import type { MedicineStock } from "@/lib/types";

export const metadata: Metadata = { title: "Inventory" };

const STATUSES = [
  { value: "", label: "All stock levels" },
  { value: "low", label: "Low or out" },
  { value: "out", label: "Out of stock" },
  { value: "expiring", label: `Expiring within ${EXPIRY_WARN_DAYS} days` },
  { value: "inactive", label: "Inactive" },
];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; form?: string; status?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const form = MEDICINE_FORMS.find((f) => f.value === sp.form)?.value;
  const status = STATUSES.find((s) => s.value === sp.status)?.value ?? "";
  const today = todayColombo();
  const soonDate = addDays(today, EXPIRY_WARN_DAYS);

  const supabase = await createClient();
  let query = supabase.from("medicine_stock").select("*").order("name").order("strength").limit(500);
  if (q) {
    const term = q.replace(/[,()%*]/g, " ").trim();
    query = query.or(`name.ilike.%${term}%,generic_name.ilike.%${term}%`);
  }
  if (form) query = query.eq("form", form);
  if (status === "inactive") query = query.eq("is_active", false);
  else query = query.eq("is_active", true);
  const { data } = await query.returns<MedicineStock[]>();

  const rows = (data ?? []).filter((m) => {
    if (status === "low") return stockLevel(m) !== "ok";
    if (status === "out") return stockLevel(m) === "out";
    if (status === "expiring") return expiryState(m, today, soonDate) !== null;
    return true;
  });
  const canEdit = isClinicalRole(user.profile.role);

  return (
    <>
      <PageHeader
        title="Inventory"
        description={`${rows.length} ${rows.length === 1 ? "medicine" : "medicines"}`}
        actions={
          canEdit ? (
            <LinkButton href="/admin/inventory/new">
              <PlusIcon /> Add medicine
            </LinkButton>
          ) : null
        }
      />

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Search by name or generic" aria-label="Search medicines" className="max-w-xs" />
        <NativeSelect name="form" defaultValue={form ?? ""} aria-label="Filter by form" className="w-auto">
          <option value="">All forms</option>
          {MEDICINE_FORMS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status} aria-label="Filter by stock level" className="w-auto">
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </NativeSelect>
        <SubmitButton pendingText="Searching...">
          <SearchIcon /> Search
        </SubmitButton>
      </form>

      <Card className="py-0">
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No medicines found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 text-xs uppercase tracking-wide hover:bg-muted/50">
                  <TableHead>Medicine</TableHead>
                  <TableHead className="hidden sm:table-cell">Form</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Reorder at</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id} className="hover:bg-accent/40">
                    <TableCell>
                      <Link href={`/admin/inventory/${m.id}`} className="font-medium text-primary hover:underline">
                        {m.name} {m.strength}
                      </Link>
                      {m.generic_name ? <p className="text-xs text-muted-foreground">{m.generic_name}</p> : null}
                    </TableCell>
                    <TableCell className="hidden capitalize sm:table-cell">{m.form}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.stock} <span className="text-xs text-muted-foreground">{m.unit}</span>
                    </TableCell>
                    <TableCell>
                      <StockBadges m={m} today={today} soonDate={soonDate} />
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{m.reorder_level}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(m.unit_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
