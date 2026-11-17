import Image from "next/image";
import { cn } from "@/lib/utils";

/** Deyon Dispensary & Pharmacy logo. `full` = wordmark with tagline, `mark` = the symbol only. */
export function BrandLogo({
  variant = "full",
  className,
  priority,
}: {
  variant?: "full" | "mark";
  className?: string;
  priority?: boolean;
}) {
  return variant === "mark" ? (
    <Image
      src="/brand/mark.png"
      alt="Deyon Dispensary & Pharmacy"
      width={332}
      height={328}
      priority={priority}
      className={cn("h-9 w-auto", className)}
    />
  ) : (
    <Image
      src="/brand/logo.png"
      alt="Deyon Dispensary & Pharmacy"
      width={992}
      height={328}
      priority={priority}
      className={cn("h-10 w-auto", className)}
    />
  );
}
