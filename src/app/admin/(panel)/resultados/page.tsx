import Link from "next/link";
import { Check, ChevronRight, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getAdminMatchesData,
  type EventWithPlayer,
  type RosterEntry,
} from "@/lib/admin-matches";
import {
  buildWhatsAppMessage,
  formatPieceWhen,
  PIECE_VENUE,
  tallyScorers,
} from "@/lib/match-summary";
import { ShareTextButton } from "@/components/share-text-button";
import { MatchPieceButton } from "@/components/match-piece-button";
import { readableAccent } from "@/lib/team-color";
import {
  EVENT_ICONS,
  FOOT_LABELS,
  POSITION_SHORT,
  STAGE_LABELS,
  type Match,
  type MatchEvent,
  type Team,
} from "@/lib/types";
import { deleteEvent, reopenMatch, saveResult } from "./actions";
import { MatchEventForm } from "./match-event-form";
import { MvpPicker, type MvpOption } from "./mvp-picker";
import { MvpPieceButton } from "@/components/mvp-piece-button";

export const dynamic = "force-dynamic";

// Agrupa los eventos por jugador y tipo: "Andrés Pertuz ×3" en vez de
// tres filas iguales. Borrar quita una unidad del grupo.
function groupEvents(events: EventWithPlayer[]) {
  const groups = new Map<
    string,
    {
      ids: string[];
      type: MatchEvent["type"];
      name: string;
      teamId: string;
    }
  >();
  for (const event of events) {
    const key = `${event.player_id}:${event.type}`;
    const group = groups.get(key);
    if (group) group.ids.push(event.id);
    else
      groups.set(key, {
        ids: [event.id],
        type: event.type,
        name: event.players.full_name,
        teamId: event.team_id,
      });
  }
  return [...groups.values()];
}

function MatchResult({
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
  const matchEvents = events.filter((e) => e.match_id === match.id);
  const rosterByTeam = (teamId: string | null) =>
    roster
      .filter((r) => r.team_id === teamId)
      .sort((a, b) => a.players.full_name.localeCompare(b.players.full_name));

  if (!home || !away) {
    return (
      <div className="border-b border-border/40 py-4 text-sm text-muted-foreground last:border-b-0">
        <Badge variant="outline" className="mr-2 border-volt/50 text-volt">
          {STAGE_LABELS[match.stage]}
        </Badge>
        Cruce sin definir — asígnalo en{" "}
        <Link
          href="/admin/partidos"
          className="text-dt-blue underline-offset-4 hover:underline"
        >
          Calendario
        </Link>
        .
      </div>
    );
  }

  // Candidatos a figura: los de los dos equipos, con su equipo al lado
  // porque hay nombres repetidos entre plantillas.
  const mvpOptions: MvpOption[] = [
    ...rosterByTeam(home.id).map((r) => ({
      playerId: r.player_id,
      name: r.players.full_name,
      teamName: home.name,
    })),
    ...rosterByTeam(away.id).map((r) => ({
      playerId: r.player_id,
      name: r.players.full_name,
      teamName: away.name,
    })),
  ];

  // Datos de la carta de la figura, si ya está elegida.
  const mvpEntry = match.mvp_player_id
    ? roster.find((r) => r.player_id === match.mvp_player_id)
    : undefined;
  const mvpTeam = mvpEntry
    ? teams.find((t) => t.id === mvpEntry.team_id)
    : undefined;
  const mvpCard = mvpEntry
    ? {
        name: mvpEntry.players.full_name,
        age: mvpEntry.players.age,
        positionShort: POSITION_SHORT[mvpEntry.players.position],
        footLabel: FOOT_LABELS[mvpEntry.players.dominant_foot],
        memberSince: mvpEntry.players.member_since,
        photoUrl: mvpEntry.players.photo_url,
        teamName: mvpTeam?.name ?? null,
        teamColor: mvpTeam?.color ?? null,
        crestUrl: mvpTeam?.crest_url ?? null,
        isCaptain: Boolean(mvpEntry.is_captain),
      }
    : null;

  const totalScore = (match.home_score ?? 0) + (match.away_score ?? 0);
  const assignedGoals = matchEvents.filter(
    (e) => e.type === "goal" || e.type === "own_goal",
  ).length;

  return (
    <div className="space-y-3 border-b border-border/40 py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-volt/50 text-volt">
          {STAGE_LABELS[match.stage]}
        </Badge>
        {match.status === "finished" ? <Badge>Jugado</Badge> : null}
      </div>

      {/* Marcador: en mobile una fila por equipo */}
      <div className="flex flex-wrap items-center gap-2">
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
            <ShareTextButton
              text={buildWhatsAppMessage(
                match,
                teams,
                matchEvents.map((e) => ({
                  player_id: e.player_id,
                  team_id: e.team_id,
                  type: e.type,
                  name: e.players.full_name,
                })),
              )}
              title="Compartir el resultado en WhatsApp"
            />
            <MatchPieceButton
              eyebrow={`Semana ${match.week} · ${STAGE_LABELS[match.stage]}`}
              home={{
                name: home.name,
                color: home.color,
                crestUrl: home.crest_url,
                score: match.home_score,
              }}
              away={{
                name: away.name,
                color: away.color,
                crestUrl: away.crest_url,
                score: match.away_score,
              }}
              when={formatPieceWhen(match.kickoff_at)}
              venue={PIECE_VENUE}
              homeScorers={
                tallyScorers(matchEvents, home.id, away.id).home
              }
              awayScorers={
                tallyScorers(matchEvents, home.id, away.id).away
              }
            />
            <div className="w-full sm:max-w-xs">
              <MvpPicker
                matchId={match.id}
                current={match.mvp_player_id ?? null}
                options={mvpOptions}
              />
            </div>
            {mvpCard ? (
              <MvpPieceButton
                card={mvpCard}
                eyebrow={`Semana ${match.week} · ${home.name} vs ${away.name}`}
                caption={`🏆 FIGURA DEL PARTIDO\n\n${mvpCard.name} se llevó los aplausos en el ${home.name} ${match.home_score ?? 0}-${match.away_score ?? 0} ${away.name}.\n\nSu carta y sus números están en la web, link en la bio.\n\n#DreamTeamColombia #FutbolAmateur #Montería #LaF8`}
              />
            ) : null}
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

      {/* Goles, asistencias y tarjetas */}
      <div className="space-y-2 pl-1">
        {match.status === "finished" && assignedGoals !== totalScore ? (
          <p className="text-xs text-yellow-500">
            {assignedGoals < totalScore
              ? `⚠️ Faltan ${totalScore - assignedGoals} de ${totalScore} goles por asignar — agrégalos abajo (gol o autogol).`
              : `⚠️ Hay ${assignedGoals} goles asignados pero el marcador suma ${totalScore} — sobra alguno.`}
          </p>
        ) : null}

        {groupEvents(matchEvents).map((group) => (
          <div
            key={`${group.type}-${group.ids[0]}`}
            className="flex items-center gap-2 text-sm"
          >
            <span aria-hidden>{EVENT_ICONS[group.type]}</span>
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{
                background: readableAccent(
                  teams.find((t) => t.id === group.teamId)?.color,
                ),
              }}
              title={teams.find((t) => t.id === group.teamId)?.name}
            />
            <span className="flex-1 truncate">
              {group.name}
              {group.ids.length > 1 ? (
                <span className="font-display text-volt"> ×{group.ids.length}</span>
              ) : null}
              <span className="ml-2 text-xs text-muted-foreground">
                {teams.find((t) => t.id === group.teamId)?.name}
              </span>
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
            color: home.color,
            players: rosterByTeam(home.id).map((entry) => ({
              id: entry.player_id,
              name: entry.players.full_name,
            })),
          }}
          away={{
            id: away.id,
            name: away.name,
            color: away.color,
            players: rosterByTeam(away.id).map((entry) => ({
              id: entry.player_id,
              name: entry.players.full_name,
            })),
          }}
        />
      </div>
    </div>
  );
}

export default async function AdminResultsPage() {
  const data = await getAdminMatchesData();

  if (!data) {
    return (
      <div>
        <h1 className="font-display text-4xl tracking-wide">RESULTADOS</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No se pudo leer la base de datos. Revisa la configuración de Supabase.
        </p>
      </div>
    );
  }

  const { teams, matches, roster, events } = data;
  const weeks = [...new Set(matches.map((m) => m.week))].sort((a, b) => a - b);
  const played = matches.filter((m) => m.status === "finished").length;
  // Se abre la primera semana con partidos sin cargar; si están todos
  // jugados, la última.
  const semanaAbierta =
    weeks.find((w) =>
      matches.some((m) => m.week === w && m.status !== "finished"),
    ) ?? weeks.at(-1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide">RESULTADOS</h1>
        {matches.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {played} de {matches.length} partidos jugados
          </p>
        ) : null}
      </div>

      {matches.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Todavía no hay partidos. Programa las semanas en{" "}
          <Link
            href="/admin/partidos"
            className="text-dt-blue underline-offset-4 hover:underline"
          >
            Calendario
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {weeks.map((week) => (
            <Card key={week} className="border-border/60 bg-card/70 py-0">
              <details open={week === semanaAbierta} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 p-5">
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                  <span className="font-display text-2xl tracking-wide text-volt">
                    SEMANA {week}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {matches.filter((m) => m.week === week && m.status === "finished").length}
                    /{matches.filter((m) => m.week === week).length} jugados
                  </span>
                </summary>
              <CardContent className="px-5 pb-5">
                {matches
                  .filter((m) => m.week === week)
                  .map((match) => (
                    <MatchResult
                      key={match.id}
                      match={match}
                      teams={teams}
                      roster={roster}
                      events={events}
                    />
                  ))}
              </CardContent>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
