"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Team } from "@/lib/types";
import { AddWeekForm } from "./add-week-form";

// Envuelve el armador en un acordeón controlado: arranca abierto solo
// si no hay semanas, y se cierra solo al guardar una.
export function WeekPlanner({
  teams,
  nextWeek,
  weeks,
}: {
  teams: Team[];
  nextWeek: number;
  weeks: number[];
}) {
  const [open, setOpen] = useState(weeks.length === 0);

  return (
    <Card className="mt-6 border-volt/40 bg-card/70 py-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 p-5 text-left"
        aria-expanded={open}
      >
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden
        />
        <span className="font-display text-2xl tracking-wide">
          PROGRAMAR UNA SEMANA
        </span>
        <span className="text-sm text-muted-foreground">
          {weeks.length === 0
            ? "empieza por la semana 1"
            : `ya van ${weeks.length}: ${weeks.join(", ")}`}
        </span>
      </button>
      {open ? (
        <CardContent className="px-5 pb-5">
          <AddWeekForm
            teams={teams}
            nextWeek={nextWeek}
            onSaved={() => setOpen(false)}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
