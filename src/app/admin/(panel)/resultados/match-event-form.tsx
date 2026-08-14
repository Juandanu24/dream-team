"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_LABELS, type MatchEventType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addEvent } from "./actions";

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

export interface EventTeam {
  id: string;
  name: string;
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
  const team = teamId === away.id ? away : home;

  return (
    <form
      action={async (formData: FormData) => {
        try {
          await addEvent(matchId, formData);
        } catch {
          toast.error("No se pudo registrar el evento");
        }
      }}
      className="space-y-2"
    >
      <div className="flex gap-1">
        {[home, away].map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={option.id === teamId ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "flex-1 truncate",
              option.id === teamId && "text-foreground",
            )}
            onClick={() => setTeamId(option.id)}
          >
            {option.name}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        >
          <option value="" disabled>
            Jugador…
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
        <Button variant="outline" size="sm" type="submit" title="Agregar evento">
          <Plus aria-hidden />
        </Button>
      </div>
    </form>
  );
}
