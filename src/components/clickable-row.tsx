"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * A table row that opens `href` when clicked anywhere. Keep a real link inside the row
 * for keyboard and screen-reader users; clicks on inner links/buttons behave normally.
 */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <TableRow
      className={cn("cursor-pointer", className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea")) return;
        if (window.getSelection()?.toString()) return; // don't hijack text selection
        if (e.metaKey || e.ctrlKey) return window.open(href, "_blank");
        router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}
