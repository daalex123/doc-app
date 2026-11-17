import Link from "next/link";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
  prefetch,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  prefetch?: boolean;
} & VariantProps<typeof buttonVariants>) {
  return (
    <Link href={href} prefetch={prefetch} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
