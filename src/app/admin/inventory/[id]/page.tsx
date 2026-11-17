import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app-shell";
import { BackLink } from "@/components/medical-history";
import { AdjustStockForm, MedicineForm, ReceiveStockForm } from "@/components/inventory-forms";
import { StockBadges } from "@/components/stock-badges";
import { isClinicalRole, requireStaff } from "@/lib/auth";
import { addDays, formatDate, formatDateTime, formatMoney, todayColombo } from "@/lib/dates";
import { EXPIRY_WARN_DAYS, KIND_LABELS } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";
import { adjustStock, receiveStock, saveMedicine } from "@/app/actions/inventory";
import type { MedicineStock, StockMovement } from "@/lib/types";

export const metadata: Metadata = { title: "Medicine" };

const SAVED: Record<string, string> = {
  medicine: "Medicine saved.",
  received: "Stock received.",
  adjusted: "Stock movement recorded.",
};

export default async function MedicineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: m }, { data: moves }] = await Promise.all([
    supabase.from("medicine_stock").select("*").eq("id", id).maybeSingle<MedicineStock>(),
    supabase
      .from("stock_movements")
      .select("id, medicine_id, kind, quantity, batch_no, expiry_date, note, created_at, profiles(full_name)")
      .eq("medicine_id", id)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<StockMovement[]>(),
  ]);
  if (!m) notFound();

  const today = todayColombo();
  const soonDate = addDays(today, EXPIRY_WARN_DAYS);
  const canEdit = isClinicalRole(user.profile.role);
  const canStock = user.profile.role === "admin";

  const defaults: Record<string, string> = {
    name: m.name,
    generic_name: m.generic_name ?? "",
    strength: m.strength,
    form: m.form,
    unit: m.unit,
    default_dose: m.default_dose ?? "",
    default_frequency: m.default_frequency ?? "",
    default_duration: m.default_duration ?? "",
    unit_price: String(m.unit_price),
    reorder_level: String(m.reorder_level),
    is_active: m.is_active ? "on" : "",
  };

  return (
    <>
      <BackLink href="/admin/inventory">Back to inventory</BackLink>
      <PageHeader
        title={`${m.name} ${m.strength}`.trim()}
        description={[m.generic_name, m.form, `${formatMoney(m.unit_price)} per ${m.unit}`].filter(Boolean).join(" · ")}
      />

      {sp.saved && SAVED[sp.saved] ? (
        <Alert className="mb-4 border-primary/30 bg-primary/5">
          <AlertDescription>{SAVED[sp.saved]}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{m.stock}</p>
            <p className="text-xs text-muted-foreground">{m.unit} in stock</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{m.reorder_level}</p>
            <p className="text-xs text-muted-foreground">reorder level</p>
          </CardContent>
        </Card>
        <Card size="sm" className="col-span-2">
          <CardContent className="grid gap-1">
            <StockBadges m={m} today={today} soonDate={soonDate} />
            <p className="text-xs text-muted-foreground">
              {m.next_expiry ? `Earliest expiry in stock: ${formatDate(m.next_expiry)}` : "No expiry dates recorded"}
            </p>
          </CardContent>
        </Card>
      </div>

      {canStock ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Receive stock</CardTitle>
            </CardHeader>
            <CardContent>
              <ReceiveStockForm action={receiveStock.bind(null, id)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Adjust / write-off</CardTitle>
              <CardDescription>Stock can never go below zero.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdjustStockForm action={adjustStock.bind(null, id)} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="mb-6 py-0">
        <CardHeader className="pt-4">
          <CardTitle>Movement history</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {(moves ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No stock movements yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 text-xs uppercase tracking-wide hover:bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="hidden sm:table-cell">Batch / expiry</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="hidden md:table-cell">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(moves ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(s.created_at)}</TableCell>
                    <TableCell>{KIND_LABELS[s.kind]}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.quantity > 0 ? `+${s.quantity}` : s.quantity}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {[s.batch_no, s.expiry_date ? formatDate(s.expiry_date) : null].filter(Boolean).join(" · ") || "-"}
                    </TableCell>
                    <TableCell className="max-w-60 truncate">{s.note ?? "-"}</TableCell>
                    <TableCell className="hidden md:table-cell">{s.profiles?.full_name ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Medicine details</CardTitle>
          </CardHeader>
          <CardContent>
            <MedicineForm
              action={saveMedicine.bind(null, id)}
              defaults={defaults}
              cancelHref="/admin/inventory"
              submitLabel="Save changes"
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
