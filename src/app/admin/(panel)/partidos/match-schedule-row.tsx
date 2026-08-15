"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { STAGE_LABELS, type Match, type Team } from "@/lib/types";
import { deleteMatch, updateMatch } from "./actions";

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 [&>option]:bg-popover";

// Fila de programación: fecha, hora y cruce. Es cliente para poder
// avisar del error con un toast en vez de tumbar la página, y para no
// dejar elegir dos veces el mismo equipo.
export function MatchScheduleRow({
  match,
  teams,
  kickoffValue,
}: {
  match: Match;
  teams: Team[];
  kickoffValue: string;
}) {
  const [home, setHome] = useState(match.home_team_id ?? "");
  const [away, setAway] = useState(match.away_team_id ?? "");
  const [pending, startTransition] = useTransition();

  const mismoEquipo = Boolean(home) && home === away;

  return (
    <form
      action={(formData: FormData) =>
        startTransition(async () => {
          try {
            await updateMatch(match.id, formData);
            toast.success("Partido actualizado");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo guardar el partido",
            );
          }
        })
      }
      className="flex flex-wrap items-center gap-2 border-b border-border/40 py-3 last:border-b-0"
    >
      <Badge variant="outline" className="border-volt/50 text-volt">
        {STAGE_LABELS[match.stage]}
      </Badge>
      <Input
        type="datetime-local"
        name="kickoff_at"
        defaultValue={kickoffValue}
        className="w-fit"
      />
      <select
        name="home_team_id"
        value={home}
        onChange={(e) => setHome(e.target.value)}
        className={selectClass}
        aria-label="Equipo local"
      >
        <option value="">Local por definir</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id} disabled={team.id === away}>
            {team.name}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">vs</span>
      <select
        name="away_team_id"
        value={away}
        onChange={(e) => setAway(e.target.value)}
        className={selectClass}
        aria-label="Equipo visitante"
      >
        <option value="">Visitante por definir</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id} disabled={team.id === home}>
            {team.name}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="sm"
        type="submit"
        title="Guardar cambios"
        disabled={pending || mismoEquipo}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
      </Button>
      {match.status === "finished" ? (
        <Badge>Jugado</Badge>
      ) : (
        <ConfirmButton
          action={deleteMatch.bind(null, match.id)}
          message="¿Borrar este partido del calendario?"
          variant="ghost"
          title="Borrar partido"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden />
        </ConfirmButton>
      )}
      {mismoEquipo ? (
        <span className="text-xs text-yellow-500">
          ⚠️ Un equipo no puede jugar contra sí mismo
        </span>
      ) : null}
    </form>
  );
}
