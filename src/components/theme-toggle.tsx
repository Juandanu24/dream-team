"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CYCLE = ["system", "light", "dark"] as const;

const LABELS: Record<(typeof CYCLE)[number], string> = {
  system: "Tema del sistema",
  light: "Tema claro",
  dark: "Tema oscuro",
};

// Cicla sistema → claro → oscuro. Por defecto sigue al OS.
// withLabel: fila completa clickeable con el nombre del tema (menú mobile).
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { theme, setTheme } = useTheme();
  // El tema real solo se conoce en el cliente; en el server render
  // mostramos el ícono neutro para no romper la hidratación.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const current = (CYCLE.includes(theme as (typeof CYCLE)[number])
    ? theme
    : "system") as (typeof CYCLE)[number];

  const Icon = !mounted
    ? Monitor
    : current === "light"
      ? Sun
      : current === "dark"
        ? Moon
        : Monitor;

  return (
    <Button
      variant="ghost"
      size={withLabel ? "default" : "sm"}
      title={mounted ? LABELS[current] : "Tema"}
      className={cn(
        "text-muted-foreground hover:text-foreground",
        withLabel && "w-full justify-start",
      )}
      onClick={() => {
        const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
        setTheme(next);
      }}
    >
      <Icon aria-hidden />
      {withLabel ? (
        <span>{mounted ? LABELS[current] : "Tema"}</span>
      ) : (
        <span className="sr-only">Cambiar tema</span>
      )}
    </Button>
  );
}
