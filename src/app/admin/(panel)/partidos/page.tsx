import { Check, RotateCcw, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmButton } from "@/components/confirm-button";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_TOURNAMENT_SLUG,
  EVENT_ICONS,
  STAGE_LABELS,
  type Match,
  type MatchEvent,
  type Player,
  type Team,
  type TeamPlayer,
} from "@/lib/types";
import {
  deleteEvent,
  deleteFixture,
  generateFixture,
  reopenMatch,
  saveResult,
  updateMatch,
} from "./actions";
import { MatchEventForm } from "./match-event-form";

export const dynamic = "force-dynamic";

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover [&>optgroup]:bg-popover";

interface RosterEntry extends TeamPlayer {
  players: Player;
}

interface EventWithPlayer extends MatchEvent {
  players: Pick<Player, "full_name">;
}

interface MatchesData {
  teams: Team[];
  matches: Match[];
  roster: RosterEntry[];
  events: EventWithPlayer[];
}

async function getMatchesData(): Promise<MatchesData | null> {
  try {
    const supabase = createAdminClient();
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) return null;

    const [teams, matches, roster, events] = await Promise.all([
      supabase
        .from("teams")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("created_at"),
      supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("week")
        .order("kickoff_at", { nullsFirst: false }),
      supabase
        .from("team_players")
        .select("*, players(*)")
        .eq("tournament_id", tournament.id),
      supabase
        .from("match_events")
        .select("*, players(full_name)")
        .order("created_at"),
    ]);

    return {
      teams: (teams.data as Team[]) ?? [],
      matches: (matches.data as Match[]) ?? [],
      roster: (roster.data as unknown as RosterEntry[]) ?? [],
      events: (events.data as unknown as EventWithPlayer[]) ?? [],
    };
  } catch (error) {
    console.error("Error cargando partidos:", error);
    return null;
  }
}

// timestamptz → valor de <input type="datetime-local"> en hora de Colombia.
function toBogotaInput(ts: string | null): string {
  if (!ts) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ts))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Agrupa los eventos por jugador y tipo: "Andrés Pertuz ×3" en vez de
// tres filas iguales. Borrar quita una unidad del grupo.
function groupEvents(events: EventWithPlayer[]) {
  const groups = new Map<
    string,
    { ids: string[]; type: MatchEvent["type"]; name: string }
  >();
  for (const event of events) {
    const key = `${event.player_id}:${event.type}`;
    const group = groups.get(key);
    if (group) {
      group.ids.push(event.id);
    } else {
      groups.set(key, {
        ids: [event.id],
        type: event.type,
        name: event.players.full_name,
      });
    }
  }
  return [...groups.values()];
}

function MatchAdmin({
  match,
  teams,
  roster,
  events,
}: {
  match: Match;
  teams: Team[];
  roster: RosterEntry[];
  events: EventWithPlayer[];
}) {
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);
  const isKnockout = match.stage !== "group";
  const matchEvents = events.filter((e) => e.match_id === match.id);
  const matchRoster = roster.filter(
    (r) => r.team_id === match.home_team_id || r.team_id === match.away_team_id,
  );
  const rosterByTeam = (teamId: string | null) =>
    matchRoster
      .filter((r) => r.team_id === teamId)
      .sort((a, b) => a.players.full_name.localeCompare(b.players.full_name));

  return (
    <div className="space-y-3 border-b border-border/40 py-4 last:border-b-0">
      {/* Programación: fecha y (en finales) cruce */}
      <form
        action={updateMatch.bind(null, match.id)}
        className="flex flex-wrap items-center gap-2"
      >
        <Badge variant="outline" className="border-volt/50 text-volt">
          {STAGE_LABELS[match.stage]}
        </Badge>
        <Input
          type="datetime-local"
          name="kickoff_at"
          defaultValue={toBogotaInput(match.kickoff_at)}
          className="w-fit"
        />
        {isKnockout ? (
          <>
            <select
              name="home_team_id"
              defaultValue={match.home_team_id ?? ""}
              className={selectClass}
            >
              <option value="">Local por definir</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">vs</span>
            <select
              name="away_team_id"
              defaultValue={match.away_team_id ?? ""}
              className={selectClass}
            >
              <option value="">Visitante por definir</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <Button variant="ghost" size="sm" type="submit" title="Guardar programación">
          <Save aria-hidden />
        </Button>
      </form>

      {/* Resultado */}
      {home && away ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* Mobile: una fila por equipo. Desktop: marcador en línea. */}
          <form
            action={saveResult.bind(null, match.id)}
            className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:gap-2"
          >
            <span className="truncate text-right text-sm font-medium sm:order-1 sm:w-40">
              {home.name}
            </span>
            <Input
              type="number"
              inputMode="numeric"
              name="home_score"
              min={0}
              max={99}
              defaultValue={match.home_score ?? ""}
              required
              className="w-14 text-center sm:order-2"
            />
            <span className="hidden text-muted-foreground sm:order-3 sm:inline">
              -
            </span>
            <span className="truncate text-right text-sm font-medium sm:order-5 sm:w-40 sm:text-left">
              {away.name}
            </span>
            <Input
              type="number"
              inputMode="numeric"
              name="away_score"
              min={0}
              max={99}
              defaultValue={match.away_score ?? ""}
              required
              className="w-14 text-center sm:order-4"
            />
            <Button
              size="sm"
              type="submit"
              title="Guardar y marcar como jugado"
              className="col-span-2 justify-self-start sm:order-6 sm:col-span-1"
            >
              <Check aria-hidden />
              {match.status === "finished" ? "Actualizar" : "Finalizar"}
            </Button>
          </form>
          {match.status === "finished" ? (
            <>
              <Badge>Jugado</Badge>
              <form action={reopenMatch.bind(null, match.id)}>
                <Button
                  variant="ghost"
                  size="sm"
                  type="submit"
                  title="Volver a programado"
                >
                  <RotateCcw aria-hidden />
                </Button>
              </form>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Define el cruce para poder cargar el resultado.
        </p>
      )}

      {/* Eventos */}
      {home && away ? (
        <div className="space-y-2 pl-1">
          {(() => {
            // El marcador "pregunta" por los goleadores: avisa si los goles
            // asignados a jugadores no cuadran con el resultado.
            if (match.status !== "finished") return null;
            const totalScore = (match.home_score ?? 0) + (match.away_score ?? 0);
            // Los autogoles también suman al marcador (para el rival).
            const assignedGoals = matchEvents.filter(
              (e) => e.type === "goal" || e.type === "own_goal",
            ).length;
            if (assignedGoals === totalScore) return null;
            return (
              <p className="text-xs text-yellow-500">
                {assignedGoals < totalScore
                  ? `⚠️ Faltan ${totalScore - assignedGoals} de ${totalScore} goles por asignar — agrégalos abajo (gol o autogol).`
                  : `⚠️ Hay ${assignedGoals} goles asignados pero el marcador suma ${totalScore} — sobra alguno.`}
              </p>
            );
          })()}
          {groupEvents(matchEvents).map((group) => (
            <div
              key={`${group.type}-${group.ids[0]}`}
              className="flex items-center gap-2 text-sm"
            >
              <span aria-hidden>{EVENT_ICONS[group.type]}</span>
              <span className="flex-1 truncate">
                {group.name}
                {group.ids.length > 1 ? (
                  <span className="font-display text-volt"> ×{group.ids.length}</span>
                ) : null}
              </span>
              <form action={deleteEvent.bind(null, group.ids.at(-1)!)}>
                <Button
                  variant="ghost"
                  size="sm"
                  type="submit"
                  title={group.ids.length > 1 ? "Quitar uno" : "Borrar evento"}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X aria-hidden />
                </Button>
              </form>
            </div>
          ))}

          <MatchEventForm
            matchId={match.id}
            home={{
              id: home.id,
              name: home.name,
              players: rosterByTeam(home.id).map((entry) => ({
                id: entry.player_id,
                name: entry.players.full_name,
              })),
            }}
            away={{
              id: away.id,
              name: away.name,
              players: rosterByTeam(away.id).map((entry) => ({
                id: entry.player_id,
                name: entry.players.full_name,
              })),
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default async function AdminMatchesPage() {
  const data = await getMatchesData();

  if (!data) {
    return (
      <div>
        <h1 className="font-display text-4xl tracking-wide">PARTIDOS</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No se pudo leer la base de datos. Revisa la configuración de Supabase.
        </p>
      </div>
    );
  }

  const { teams, matches, roster, events } = data;
  const weeks = [...new Set(matches.map((m) => m.week))].sort((a, b) => a - b);
  const anyFinished = matches.some((m) => m.status === "finished");

  return (
    <div>
      <h1 className="font-display text-4xl tracking-wide">PARTIDOS</h1>

      {matches.length === 0 ? (
        teams.length === 4 ? (
          <Card className="mt-6 border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="font-display text-xl tracking-wide">
                GENERAR FIXTURE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={generateFixture}
                className="flex flex-col gap-4 sm:flex-row sm:items-end"
              >
                <div className="space-y-2">
                  <Label htmlFor="first_tuesday">Martes de la semana 1</Label>
                  <Input
                    id="first_tuesday"
                    type="date"
                    name="first_tuesday"
                    required
                    className="w-fit"
                  />
                </div>
                <Button type="submit">Generar las 5 semanas</Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">
                Crea los 10 partidos: grupos según el orden de creación de los
                equipos (semana 1: 1 vs 2 y 3 vs 4…), martes 8:00 PM y jueves
                9:00 PM. Las semis y finales quedan &quot;por definir&quot; hasta
                que termine la fase de grupos. Luego puedes ajustar cualquier
                fecha u hora partido por partido.
              </p>
            </CardContent>
          </Card>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Para generar el fixture primero crea los 4 equipos en{" "}
            <a href="/admin/equipos" className="text-volt underline-offset-4 hover:underline">
              Equipos
            </a>
            . Van {teams.length} de 4.
          </p>
        )
      ) : (
        <>
          <div className="mt-6 space-y-4">
            {weeks.map((week) => (
              <Card key={week} className="border-border/60 bg-card/70">
                <CardHeader>
                  <CardTitle className="font-display text-2xl tracking-wide text-volt">
                    SEMANA {week}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {matches
                    .filter((m) => m.week === week)
                    .map((match) => (
                      <MatchAdmin
                        key={match.id}
                        match={match}
                        teams={teams}
                        roster={roster}
                        events={events}
                      />
                    ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6">
            <ConfirmButton
              action={deleteFixture}
              message={
                anyFinished
                  ? "¿Borrar TODO el fixture? Se eliminan los partidos Y sus resultados, goles, asistencias y tarjetas. Esto no se puede deshacer."
                  : "¿Borrar todo el fixture? Se eliminan todos los partidos."
              }
              variant="outline"
              className="text-muted-foreground hover:text-destructive"
            >
              Borrar fixture completo
            </ConfirmButton>
          </div>
        </>
      )}
    </div>
  );
}
