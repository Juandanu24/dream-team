"use client";

import { useState } from "react";
import { SoccerBall } from "@/components/soccer-ball";
import { cn } from "@/lib/utils";

// Balón que responde al toque/click y al foco de teclado: le pega una
// "patada" (gira rápido y rebota) y vuelve a su giro lento.
export function InteractiveBall({
  className,
  spinSeconds = 26,
  reverse = false,
}: {
  className?: string;
  spinSeconds?: number;
  reverse?: boolean;
}) {
  const [kicking, setKicking] = useState(false);

  return (
    <button
      type="button"
      aria-label="Patear el balón"
      onPointerDown={() => setKicking(true)}
      onFocus={() => setKicking(true)}
      onAnimationEnd={() => setKicking(false)}
      className={cn(
        "cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-volt/60",
        kicking && "animate-kick",
        className,
      )}
    >
      <SoccerBall
        className={cn(
          "size-full motion-reduce:animate-none",
          kicking ? "animate-[spin_0.6s_linear]" : "animate-[spin_var(--spin)_linear_infinite]",
          reverse && !kicking && "[animation-direction:reverse]",
        )}
        style={{ "--spin": `${spinSeconds}s` } as React.CSSProperties}
      />
    </button>
  );
}
