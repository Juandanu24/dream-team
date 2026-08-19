import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { getLineupsData, type LineupWithPlayers } from "@/lib/lineups";
import { formatPieceWhen, PIECE_VENUE } from "@/lib/match-summary";
import { readableAccent } from "@/lib/team-color";
import { STAGE_LABELS, type LineupLine, type Team } from "@/lib/types";
import { LineupCard, type EditorTarget, type LineupSeed } from "./lineup-editor";

export const dynamic = "force-dynamic";

function seedFrom(lineup: LineupWithPlayers | undefined): LineupSeed | null {
  if (!lineup) return null;
  const slots: LineupSeed["slots"] = {};
  for (const entry of lineup.entries) {
    slots[entry.player_id] = {
      line: entry.line as LineupLine,
      slot: entry.slot,
      isStarter: entry.is_starter,
    };
  }
  return {
    id: lineup.id,
    formation: lineup.formation,
    notes: lineup.notes,
    publishedAt: lineup.published_at,
    slots,
  };
}

function teamName(teams: Team[], id: string | null) {
  return teams.find((t) => t.id === id)?.name ?? "Por definir";
}

export default async function AlineacionesPage() {
  const data = await getLineupsData();

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-4xl tracking-wide">
          ALINEACIONES <span className="text-dt-blue">POR PARTIDO</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No pudimos leer el torneo. Revisa la conexión con Supabase.
        </p>
      </div>
    );
  }

  const { teams, matches, roster, lineups } = data;

  // Solo los partidos con los dos equipos definidos: una semifinal sin
  // cruce todavía no tiene a quién alinear.
  const jugables = matches.filter((m) => m.home_team_id && m.away_team_id);
  const weeks = [...new Set(jugables.map((m) => m.week))].sort((a, b) => a - b);

  // La semana abierta por defecto es la del próximo partido sin jugar.
  const proxima =
    jugables.find((m) => m.status !== "finished")?.week ?? weeks[0];

  const squadOf = (teamId: string) =>
    roster
      .filter((r) => r.team_id === teamId)
      .map((r) => ({
        playerId: r.player_id,
        name: r.players.full_name,
        isGoalkeeper: r.is_goalkeeper,
        isCaptain: Boolean(r.is_captain),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-4xl tracking-wide sm:text-5xl">
        ALINEACIONES <span className="text-dt-blue">POR PARTIDO</span>
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Arma la titular de cada equipo, publícala para notificar por push, y
        compártela por WhatsApp o como imagen para Instagram.
      </p>

      {jugables.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Todavía no hay partidos con los dos equipos definidos. Ármalos en{" "}
          <Link
            href="/admin/partidos"
            className="text-dt-blue underline-offset-4 hover:underline"
          >
            Calendario
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {weeks.map((week) => {
            const delaSemana = jugables.filter((m) => m.week === week);
            const conAlineacion = delaSemana.filter((m) =>
              lineups.some((l) => l.match_id === m.id && l.published_at),
            ).length;

            return (
              <Card key={week} className="border-border/60 bg-card/70 py-0">
                <details open={week === proxima} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 p-5">
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                    <span className="font-display text-2xl tracking-wide text-volt">
                      SEMANA {week}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {conAlineacion}/{delaSemana.length} publicadas
                    </span>
                  </summary>

                  <CardContent className="space-y-6 px-5 pb-5">
                    {delaSemana.map((match) => {
                      const when = formatPieceWhen(match.kickoff_at);
                      const eyebrow = `Semana ${match.week} · ${STAGE_LABELS[match.stage]}`;

                      const lados = [
                        { id: match.home_team_id!, rivalId: match.away_team_id! },
                        { id: match.away_team_id!, rivalId: match.home_team_id! },
                      ];

                      return (
                        <div key={match.id} className="space-y-3">
                          <p className="font-display text-xl tracking-wide">
                            {teamName(teams, match.home_team_id)}{" "}
                            <span className="text-muted-foreground">vs</span>{" "}
                            {teamName(teams, match.away_team_id)}
                            <span className="ml-2 text-xs font-normal text-dt-blue capitalize">
                              {when}
                            </span>
                          </p>

                          <div className="grid gap-4 lg:grid-cols-2">
                            {lados.map(({ id, rivalId }) => {
                              const team = teams.find((t) => t.id === id);
                              if (!team) return null;
                              const target: EditorTarget = {
                                matchId: match.id,
                                teamId: team.id,
                                teamName: team.name,
                                teamColor: team.color,
                                crestUrl: team.crest_url ?? null,
                                rivalName: teamName(teams, rivalId),
                                when,
                                venue: PIECE_VENUE,
                                eyebrow,
                                squad: squadOf(team.id),
                                lineup: seedFrom(
                                  lineups.find(
                                    (l) =>
                                      l.match_id === match.id &&
                                      l.team_id === team.id,
                                  ),
                                ),
                              };
                              return (
                                <LineupCard
                                  key={team.id}
                                  target={target}
                                  accent={readableAccent(team.color)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
