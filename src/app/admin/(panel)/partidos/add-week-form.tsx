"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Team } from "@/lib/types";
import { addWeek } from "./actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

const MODES = [
  { value: "group", label: "Fase de grupos", detail: "Dos partidos de grupos" },
  { value: "semifinal", label: "Semifinales", detail: "Las dos semifinales" },
  {
    value: "finals",
    label: "Finales",
    detail: "Martes 3º y 4º puesto · jueves la Gran Final",
  },
] as const;

type Slot = "tue_home" | "tue_away" | "thu_home" | "thu_away";
const SLOTS: Slot[] = ["tue_home", "tue_away", "thu_home", "thu_away"];

// Programa la semana completa de una: el partido del martes y el del
// jueves. Avisa en vivo si un equipo queda repetido o sin jugar.
export function AddWeekForm({
  teams,
  nextWeek,
}: {
  teams: Team[];
  nextWeek: number;
}) {
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("group");
  const [picks, setPicks] = useState<Record<Slot, string>>({
    tue_home: "",
    tue_away: "",
    thu_home: "",
    thu_away: "",
  });
  const [pending, startTransition] = useTransition();

  const chosen = SLOTS.map((s) => picks[s]).filter(Boolean);
  const repeated = chosen.filter((id, i) => chosen.indexOf(id) !== i);
  const missing = teams.filter((t) => !chosen.includes(t.id));

  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? "";

  const problems: string[] = [];
  if (repeated.length > 0) {
    problems.push(
      `repetido: ${[...new Set(repeated)].map(nameOf).join(", ")}`,
    );
  }
  if (mode === "group" && chosen.length < 4) {
    problems.push(
      missing.length > 0 && chosen.length > 0
        ? `falta asignar: ${missing.map((t) => t.name).join(", ")}`
        : "faltan equipos por asignar",
    );
  }
  const ready = problems.length === 0 && chosen.length > 0;

  const teamSelect = (slot: Slot, label: string) => (
    <div className="min-w-0 flex-1 space-y-1">
      <Label htmlFor={`w-${slot}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <select
        id={`w-${slot}`}
        name={slot}
        value={picks[slot]}
        onChange={(e) => setPicks((p) => ({ ...p, [slot]: e.target.value }))}
        className={selectClass}
      >
        <option value="">Por definir</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <form
      action={(formData: FormData) =>
        startTransition(async () => {
          try {
            await addWeek(formData);
            setPicks({ tue_home: "", tue_away: "", thu_home: "", thu_away: "" });
            toast.success("Semana programada");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo programar la semana",
            );
          }
        })
      }
      className="space-y-5"
    >
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="w-week" className="text-xs">
            Semana
          </Label>
          <Input
            id="w-week"
            type="number"
            inputMode="numeric"
            name="week"
            min={1}
            max={10}
            defaultValue={nextWeek}
            required
            className="w-24"
          />
        </div>
        <div className="min-w-52 flex-1 space-y-1">
          <Label htmlFor="w-mode" className="text-xs">
            Modo
          </Label>
          <select
            id="w-mode"
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className={selectClass}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {MODES.find((m) => m.value === mode)?.detail}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="w-tuesday" className="text-xs">
            Martes
          </Label>
          <Input
            id="w-tuesday"
            type="date"
            name="tuesday"
            required
            className="w-fit"
          />
          <p className="text-xs text-muted-foreground">
            El jueves se calcula solo (+2 días)
          </p>
        </div>
      </div>

      {/* Martes */}
      <div className="rounded-lg border border-border/60 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <span className="font-display text-lg tracking-wide text-volt">
            MARTES
          </span>
          <Input
            type="time"
            name="tuesday_time"
            defaultValue="20:00"
            required
            className="w-fit"
            aria-label="Hora del martes"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {teamSelect("tue_home", "Local")}
          <span className="pb-2 text-xs text-muted-foreground">vs</span>
          {teamSelect("tue_away", "Visitante")}
        </div>
      </div>

      {/* Jueves */}
      <div className="rounded-lg border border-border/60 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <span className="font-display text-lg tracking-wide text-volt">
            JUEVES
          </span>
          <Input
            type="time"
            name="thursday_time"
            defaultValue="21:00"
            required
            className="w-fit"
            aria-label="Hora del jueves"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {teamSelect("thu_home", "Local")}
          <span className="pb-2 text-xs text-muted-foreground">vs</span>
          {teamSelect("thu_away", "Visitante")}
        </div>
      </div>

      {/* Estado del armado */}
      {problems.length > 0 ? (
        <p className="text-sm text-yellow-500">⚠️ {problems.join(" · ")}</p>
      ) : ready ? (
        <p className="text-sm text-volt">
          ✓ Todos los equipos juegan una vez esta semana
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full font-display text-lg tracking-wide"
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <CalendarPlus aria-hidden />
        )}
        GUARDAR PROGRAMACIÓN DE LA SEMANA
      </Button>
    </form>
  );
}
