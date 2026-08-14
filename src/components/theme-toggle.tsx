"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const CYCLE = ["system", "light", "dark"] as const;

const LABELS: Record<(typeof CYCLE)[number], string> = {
  system: "Tema del sistema",
  light: "Tema claro",
  dark: "Tema oscuro",
};

// Cicla sistema → claro → oscuro. Por defecto sigue al OS.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
      size="sm"
      title={mounted ? LABELS[current] : "Tema"}
      className="text-muted-foreground hover:text-foreground"
      onClick={() => {
        const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
        setTheme(next);
      }}
    >
      <Icon aria-hidden />
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
