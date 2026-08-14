"use client";

import { useState } from "react";
import { SoccerBall } from "@/components/soccer-ball";
import { cn } from "@/lib/utils";

// Balón que responde al click, al toque y al teclado: le pega una
// "patada" (salta girando rápido) y vuelve a su giro lento.
//
// Cada patada remonta el <span> vía key, que es lo que reinicia la
// animación CSS. No usamos animationend: ese evento también sube desde
// el giro del SVG y cortaba la patada antes de verse.
export function InteractiveBall({
  className,
  spinSeconds = 26,
  reverse = false,
}: {
  className?: string;
  spinSeconds?: number;
  reverse?: boolean;
}) {
  const [kicks, setKicks] = useState(0);

  return (
    <button
      type="button"
      aria-label="Patear el balón"
      onClick={() => setKicks((n) => n + 1)}
      className={cn(
        "cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-volt/60",
        className,
      )}
    >
      <span
        key={kicks}
        className={cn(
          "block size-full",
          kicks > 0 && "animate-kick motion-reduce:animate-none",
        )}
      >
        <SoccerBall
          className={cn(
            "size-full animate-[spin_var(--spin)_linear_infinite] motion-reduce:animate-none",
            reverse && "[animation-direction:reverse]",
          )}
          style={{ "--spin": `${spinSeconds}s` } as React.CSSProperties}
        />
      </span>
    </button>
  );
}
