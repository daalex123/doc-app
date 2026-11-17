import { ClockAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { expiryState, stockLevel } from "@/lib/inventory";
import { formatDate } from "@/lib/dates";
import type { MedicineStock } from "@/lib/types";

export function StockBadges({
  m,
  today,
  soonDate,
}: {
  m: Pick<MedicineStock, "stock" | "reorder_level" | "next_expiry" | "is_active">;
  today: string;
  soonDate: string;
}) {
  const level = stockLevel(m);
  const exp = expiryState(m, today, soonDate);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {level === "out" ? (
        <Badge variant="destructive">Out</Badge>
      ) : level === "low" ? (
        <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">Low</Badge>
      ) : (
        <Badge variant="secondary">OK</Badge>
      )}
      {exp ? (
        <Badge variant={exp === "expired" ? "destructive" : "outline"} title={`Earliest expiry ${formatDate(m.next_expiry)}`}>
          <ClockAlertIcon data-icon="inline-start" />
          {exp === "expired" ? "Expired batch" : `Expires ${formatDate(m.next_expiry)}`}
        </Badge>
      ) : null}
      {!m.is_active ? <Badge variant="outline">Inactive</Badge> : null}
    </div>
  );
}
