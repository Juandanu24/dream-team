import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

// Escudo del equipo: la imagen que pasó el equipo, o el ícono por
// defecto teñido con su color.
export function TeamCrest({
  name,
  color,
  crestUrl,
  className,
}: {
  name: string;
  color?: string | null;
  crestUrl?: string | null;
  className?: string;
}) {
  if (crestUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={crestUrl}
        alt={`Escudo de ${name}`}
        className={cn("size-6 shrink-0 rounded object-contain", className)}
      />
    );
  }
  return (
    <Shield
      className={cn("size-5 shrink-0", className)}
      style={{ color: color ?? "var(--volt)" }}
      aria-hidden
    />
  );
}
