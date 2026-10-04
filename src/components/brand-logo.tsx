import Image from "next/image";

import { cn } from "@/lib/design";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  admin?: boolean;
};

export function BrandLogo({ admin = false, className, compact = false }: BrandLogoProps) {
  return (
    <span
      className={cn("brand-logo", compact && "brand-logo--compact", admin && "brand-logo--admin", className)}
      aria-label={admin ? "Aylem Learning admin" : "Aylem Learning"}
    >
      <Image
        alt={admin ? "Aylem Learning admin" : "Aylem Learning"}
        className="brand-logo__image"
        height={793}
        priority
        src="/newlogo.PNG"
        unoptimized
        width={1983}
      />
      {admin ? <span className="brand-logo__badge">ADMIN</span> : null}
    </span>
  );
}
