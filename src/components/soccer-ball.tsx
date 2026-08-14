import { cn } from "@/lib/utils";

// Balón de fútbol en line-art: pentágono central, radios y arcos.
// Se anima desde el padre (spin/float); hereda el color con currentColor.
export function SoccerBall({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className={cn("size-32", className)}
      aria-hidden
    >
      <circle cx="100" cy="100" r="94" />
      {/* Pentágono central */}
      <polygon
        points="100,64 134.2,88.9 121.1,129.1 78.9,129.1 65.8,88.9"
        fill="currentColor"
        stroke="none"
        opacity="0.85"
      />
      {/* Radios hacia el borde */}
      <line x1="100" y1="64" x2="100" y2="8" />
      <line x1="134.2" y1="88.9" x2="187.4" y2="71.6" />
      <line x1="121.1" y1="129.1" x2="154" y2="174.4" />
      <line x1="78.9" y1="129.1" x2="46" y2="174.4" />
      <line x1="65.8" y1="88.9" x2="12.6" y2="71.6" />
      {/* Paneles del borde */}
      <path d="M 100 8 A 94 94 0 0 1 187.4 71.6" opacity="0.35" />
      <path d="M 187.4 71.6 A 94 94 0 0 1 154 174.4" opacity="0.35" />
      <path d="M 154 174.4 A 94 94 0 0 1 46 174.4" opacity="0.35" />
      <path d="M 46 174.4 A 94 94 0 0 1 12.6 71.6" opacity="0.35" />
      <path d="M 12.6 71.6 A 94 94 0 0 1 100 8" opacity="0.35" />
      <polyline points="100,8 121,36 154,30" opacity="0.5" />
      <polyline points="187.4,71.6 155,84 158,52" opacity="0.5" />
      <polyline points="154,174.4 133,148 166,140" opacity="0.5" />
      <polyline points="46,174.4 67,148 34,140" opacity="0.5" />
      <polyline points="12.6,71.6 45,84 42,52" opacity="0.5" />
    </svg>
  );
}
