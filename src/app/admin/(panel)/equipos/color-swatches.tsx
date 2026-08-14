"use client";

import { useState } from "react";
import { TEAM_COLORS } from "@/lib/team-colors";

// Colores sugeridos + picker libre. El input oculto lleva el valor final.
export function ColorSwatches({ defaultValue }: { defaultValue?: string }) {
  const [color, setColor] = useState(defaultValue ?? TEAM_COLORS[0].value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TEAM_COLORS.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.label}
          onClick={() => setColor(option.value)}
          className={`size-7 rounded-full border transition ${
            color.toLowerCase() === option.value.toLowerCase()
              ? "scale-110 border-foreground opacity-100 ring-2 ring-volt/60"
              : "border-border/60 opacity-60"
          }`}
          style={{ background: option.value }}
        />
      ))}
      <label
        className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-xs"
        title="Color personalizado"
      >
        <span aria-hidden>🎨</span>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="sr-only"
        />
      </label>
      <input type="hidden" name="color" value={color} />
    </div>
  );
}
