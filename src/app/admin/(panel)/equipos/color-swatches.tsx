import { TEAM_COLORS } from "@/lib/team-colors";

// Radios nativos estilizados: funcionan en forms de server components sin JS.
export function ColorSwatches({ defaultValue }: { defaultValue?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TEAM_COLORS.map((color, i) => (
        <label key={color.value} className="cursor-pointer" title={color.label}>
          <input
            type="radio"
            name="color"
            value={color.value}
            defaultChecked={
              defaultValue ? defaultValue === color.value : i === 0
            }
            className="peer sr-only"
          />
          <span
            className="block size-7 rounded-full border border-border/60 opacity-60 transition peer-checked:scale-110 peer-checked:border-foreground peer-checked:opacity-100 peer-checked:ring-2 peer-checked:ring-volt/60"
            style={{ background: color.value }}
          />
        </label>
      ))}
    </div>
  );
}
