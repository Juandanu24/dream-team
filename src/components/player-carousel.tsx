"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Carrusel con scroll-snap: la carta del centro se ve grande y las
// vecinas asoman pequeñas a los lados. Se navega deslizando.
export function PlayerCarousel({ children }: { children: React.ReactNode[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const updateActive = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDistance = Infinity;
    Array.from(track.children).forEach((child, index) => {
      const el = child as HTMLElement;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const distance = Math.abs(elCenter - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    setActive(best);
  }, []);

  useEffect(updateActive, [updateActive]);

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={updateActive}
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-[12%] py-4"
      >
        {children.map((child, index) => (
          <div
            key={index}
            className={cn(
              // min-w-0 es obligatorio: en flexbox el min-width:auto de un item
              // resuelve al ancho mínimo de su contenido, y como el nombre va
              // con truncate (nowrap) ese mínimo LE GANA al max-w y estira la
              // carta. Con nombres largos las cartas salían más anchas.
              "w-[72%] max-w-[280px] min-w-0 shrink-0 snap-center transition-all duration-300 ease-out",
              index === active ? "scale-100 opacity-100" : "scale-85 opacity-50",
            )}
          >
            {child}
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {active + 1} / {children.length} · desliza para ver más
      </p>
    </div>
  );
}
