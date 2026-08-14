import { cn } from "@/lib/utils";

// Arquero estilizado, en la misma línea gráfica que el balón.
// Los brazos van arriba (posición de penal) para que al lanzarse
// la rotación lea como una estirada.
export function Goalkeeper({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 160"
      className={cn("size-full", className)}
      aria-hidden
    >
      {/* Guantes */}
      <circle cx="14" cy="26" r="11" fill="var(--volt)" />
      <circle cx="106" cy="26" r="11" fill="var(--volt)" />
      {/* Brazos */}
      <path
        d="M20 30 L44 62 M100 30 L76 62"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      {/* Cabeza */}
      <circle cx="60" cy="34" r="15" fill="currentColor" />
      {/* Torso */}
      <path
        d="M42 58 Q60 50 78 58 L82 104 Q60 112 38 104 Z"
        fill="currentColor"
      />
      {/* Franja del uniforme */}
      <path d="M52 55 L54 108 M68 55 L66 108" stroke="var(--volt)" strokeWidth="4" />
      {/* Piernas */}
      <path
        d="M48 104 L42 150 M72 104 L78 150"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
