"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readableAccent } from "@/lib/team-color";
import { EVENT_LABELS, type MatchEventType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addEvent } from "./actions";

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

export interface EventTeam {
  id: string;
  name: string;
  color?: string | null;
  players: { id: string; name: string }[];
}

const TYPES: MatchEventType[] = [
  "goal",
  "own_goal",
  "assist",
  "yellow_card",
  "red_card",
];

// Registro de eventos: primero el equipo (así la lista de jugadores es
// corta en el celular), luego tipo, jugador y cuántas veces.
export function MatchEventForm({
  matchId,
  home,
  away,
}: {
  matchId: string;
  home: EventTeam;
  away: EventTeam;
}) {
  const [teamId, setTeamId] = useState(home.id);
  const [pending, startTransition] = useTransition();
  const team = teamId === away.id ? away : home;
  const accent = readableAccent(team.color);

  return (
    <form
      action={(formData: FormData) =>
        startTransition(async () => {
          try {
            await addEvent(matchId, formData);
          } catch {
            toast.error("No se pudo registrar el evento");
          }
        })
      }
      className="space-y-2 rounded-lg border border-border/60 p-3"
    >
      <p className="text-xs text-muted-foreground">¿De qué equipo?</p>
      <div className="grid grid-cols-2 gap-2">
        {[home, away].map((option) => {
          const selected = option.id === teamId;
          const color = readableAccent(option.color);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTeamId(option.id)}
              aria-pressed={selected}
              style={
                selected
                  ? { borderColor: color, background: `${color}22` }
                  : undefined
              }
              className={cn(
                "flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm font-medium transition",
                selected
                  ? "text-foreground shadow-sm"
                  : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: color }}
              />
              <span className="truncate">{option.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <select name="type" required defaultValue="goal" className={selectClass}>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {EVENT_LABELS[type]}
            </option>
          ))}
        </select>
        <select
          name="player_id"
          required
          defaultValue=""
          className={`${selectClass} min-w-40 flex-1`}
          key={team.id}
          style={{ borderColor: `${accent}66` }}
        >
          <option value="" disabled>
            Jugador de {team.name}…
          </option>
          {team.players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">×</span>
          <Input
            type="number"
            inputMode="numeric"
            name="count"
            min={1}
            max={20}
            defaultValue={1}
            className="w-16 text-center"
            aria-label="Cantidad"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          type="submit"
          title="Agregar evento"
          disabled={pending}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
        </Button>
      </div>
    </form>
  );
}
