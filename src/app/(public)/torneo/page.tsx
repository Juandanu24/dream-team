import type { Metadata } from "next";
import Link from "next/link";
import { Goal, Handshake, RectangleVertical, Target } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InteractiveBall } from "@/components/interactive-ball";
import { PenaltyLeaderboard } from "@/components/penalty-leaderboard";
import { PlayersGallery } from "@/components/players-gallery";
import { TeamCrest } from "@/components/team-crest";
import {
  formatKickoff,
  getTournamentData,
  type EventWithPlayer,
} from "@/lib/data";
import {
  EVENT_ICONS,
  FOOT_LABELS,
  POSITION_SHORT,
  STAGE_LABELS,
  type Match,
  type Team,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "El torneo",
};

export const dynamic = "force-dynamic";

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-dashed border-border/60 bg-card/40">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

function teamName(teams: Team[], id: string | null): string {
  return teams.find((t) => t.id === id)?.name ?? "Por definir";
}

// Agrupa por jugador y tipo: "⚽ Juan ×2" en vez de dos entradas.
function summarizeEvents(events: EventWithPlayer[]): string {
  const counts = new Map<string, { label: string; count: number }>();
  for (const event of events) {
    const key = `${event.player_id}:${event.type}`;
    const entry = counts.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(key, {
        label: `${EVENT_ICONS[event.type]} ${event.players.full_name}`,
        count: 1,
      });
    }
  }
  return [...counts.values()]
    .map((e) => (e.count > 1 ? `${e.label} ×${e.count}` : e.label))
    .join(" · ");
}

function MatchRow({
  match,
  teams,
  events,
}: {
  match: Match;
  teams: Team[];
  events: EventWithPlayer[];
}) {
  const kickoff = formatKickoff(match.kickoff_at);
  const matchEvents = events.filter((e) => e.match_id === match.id);
  return (
    <div className="border-b border-border/40 py-3 last:border-b-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex w-40 shrink-0 flex-col">
          <span className="text-xs tracking-widest text-volt uppercase">
            {STAGE_LABELS[match.stage]}
          </span>
          {kickoff ? (
            <span className="text-xs text-muted-foreground capitalize">{kickoff}</span>
          ) : null}
        </div>
        <div className="flex flex-1 items-center gap-3">
          <span className="flex-1 text-right font-medium">
            {teamName(teams, match.home_team_id)}
          </span>
          {match.status === "finished" ? (
            <span className="font-display text-2xl text-volt">
              {match.home_score} - {match.away_score}
            </span>
          ) : (
            <span className="font-display text-xl text-muted-foreground">VS</span>
          )}
          <span className="flex-1 font-medium">
            {teamName(teams, match.away_team_id)}
          </span>
        </div>
      </div>
      {match.status === "finished" && matchEvents.length > 0 ? (
        <p className="mt-1 text-center text-xs text-muted-foreground sm:pl-44">
          {summarizeEvents(matchEvents)}
        </p>
      ) : null}
    </div>
  );
}

export default async function TournamentPage() {
  const data = await getTournamentData();

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="font-display text-5xl tracking-wide">
          EL <span className="text-volt">TORNEO</span>
        </h1>
        <div className="mt-8">
          <EmptyNote>
            El torneo aún no está configurado. Vuelve pronto ⚽
          </EmptyNote>
        </div>
      </div>
    );
  }

  const {
    tournament,
    standings,
    teams,
    roster,
    approvedPlayers,
    matches,
    events,
    scorers,
    assists,
    cards,
    penaltyLeaderboard,
  } = data;
  const teamOfPlayer = new Map(
    roster.map((entry) => [
      entry.player_id,
      teams.find((t) => t.id === entry.team_id)?.name ?? null,
    ]),
  );
  const weeks = [...new Set(matches.map((m) => m.week))].sort((a, b) => a - b);

  return (
    <div className="relative mx-auto max-w-5xl overflow-hidden px-4 py-12">
      <div className="animate-float pointer-events-none absolute -top-4 -right-12 size-32 text-volt/15 motion-reduce:animate-none sm:right-0 sm:size-40">
        <InteractiveBall className="pointer-events-auto size-full" spinSeconds={32} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-5xl tracking-wide">
          {tournament.name.toUpperCase()}
        </h1>
        <Badge variant="outline" className="border-volt/50 text-volt">
          {tournament.status === "registration"
            ? "Inscripciones abiertas"
            : tournament.status === "in_progress"
              ? "En juego"
              : "Finalizado"}
        </Badge>
      </div>

      <Tabs defaultValue="posiciones" className="mt-8">
        {/* Mobile: cuadrícula 3+2 a todo el ancho; desktop: una fila repartida */}
        <TabsList className="grid h-auto w-full grid-cols-6 gap-1 group-data-horizontal/tabs:h-auto sm:flex">
          <TabsTrigger value="posiciones" className="col-span-2 py-1.5">
            Posiciones
          </TabsTrigger>
          <TabsTrigger value="calendario" className="col-span-2 py-1.5">
            Calendario
          </TabsTrigger>
          <TabsTrigger value="equipos" className="col-span-2 py-1.5">
            Equipos
          </TabsTrigger>
          <TabsTrigger value="jugadores" className="col-span-2 py-1.5">
            Jugadores
          </TabsTrigger>
          <TabsTrigger value="goleadores" className="col-span-2 py-1.5">
            Goleadores
          </TabsTrigger>
          <TabsTrigger value="penales" className="col-span-2 py-1.5">
            Penales
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posiciones" className="mt-6">
          {standings.length === 0 ? (
            <EmptyNote>
              La tabla aparece cuando se sorteen los equipos.
            </EmptyNote>
          ) : (
            <Card className="border-border/60 bg-card/70">
              <CardContent className="px-2 sm:px-4">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs tracking-widest uppercase">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Equipo</TableHead>
                      <TableHead className="text-center">PJ</TableHead>
                      <TableHead className="text-center">G</TableHead>
                      <TableHead className="text-center">E</TableHead>
                      <TableHead className="text-center">P</TableHead>
                      <TableHead className="hidden text-center sm:table-cell">GF</TableHead>
                      <TableHead className="hidden text-center sm:table-cell">GC</TableHead>
                      <TableHead className="text-center">DG</TableHead>
                      <TableHead className="hidden text-center sm:table-cell">🟨</TableHead>
                      <TableHead className="hidden text-center sm:table-cell">🟥</TableHead>
                      <TableHead className="text-center text-volt">PTS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((row, i) => (
                      <TableRow key={row.team_id}>
                        <TableCell className="font-display text-lg text-volt">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            <TeamCrest
                              name={row.team_name}
                              color={row.team_color}
                              crestUrl={
                                teams.find((t) => t.id === row.team_id)?.crest_url
                              }
                              className="size-4"
                            />
                            {row.team_name}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{row.played}</TableCell>
                        <TableCell className="text-center">{row.won}</TableCell>
                        <TableCell className="text-center">{row.drawn}</TableCell>
                        <TableCell className="text-center">{row.lost}</TableCell>
                        <TableCell className="hidden text-center sm:table-cell">
                          {row.goals_for}
                        </TableCell>
                        <TableCell className="hidden text-center sm:table-cell">
                          {row.goals_against}
                        </TableCell>
                        <TableCell className="text-center">{row.goal_diff}</TableCell>
                        <TableCell className="hidden text-center sm:table-cell">
                          {row.yellow_cards ?? 0}
                        </TableCell>
                        <TableCell className="hidden text-center sm:table-cell">
                          {row.red_cards ?? 0}
                        </TableCell>
                        <TableCell className="text-center font-display text-lg text-volt">
                          {row.points}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 px-2 text-xs text-muted-foreground">
                  Desempate: puntos → diferencia de gol → goles a favor → fair
                  play (🟨 = 1, 🟥 = 3; gana el que menos tenga).
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendario" className="mt-6 space-y-4">
          {matches.length === 0 ? (
            <EmptyNote>
              El calendario se publica cuando se sorteen los equipos. Mientras
              tanto: martes 8:00 PM y jueves 9:00 PM, cancha F8.
            </EmptyNote>
          ) : (
            weeks.map((week) => (
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
                      <MatchRow
                        key={match.id}
                        match={match}
                        teams={teams}
                        events={events}
                      />
                    ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="equipos" className="mt-6">
          {teams.length === 0 ? (
            <EmptyNote>
              Los equipos se anuncian cuando cierre la inscripción. ¿Ya sumaste
              tu nombre?
            </EmptyNote>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {teams.map((team) => {
                const players = roster
                  .filter((r) => r.team_id === team.id)
                  .sort((a, b) => Number(b.is_goalkeeper) - Number(a.is_goalkeeper));
                return (
                  <Card key={team.id} className="border-border/60 bg-card/70">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-display text-2xl tracking-wide">
                        <TeamCrest
                          name={team.name}
                          color={team.color}
                          crestUrl={team.crest_url}
                          className="size-7"
                        />
                        {team.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {players.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Plantilla por definir.
                        </p>
                      ) : (
                        players.map((entry) => (
                          <div key={entry.id} className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarImage
                                src={entry.players.photo_url ?? undefined}
                                alt=""
                              />
                              <AvatarFallback>
                                {entry.players.full_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate text-sm">
                              {entry.players.full_name}
                            </span>
                            {entry.jersey_number ? (
                              <span className="font-display text-sm text-muted-foreground">
                                #{entry.jersey_number}
                              </span>
                            ) : null}
                            <Badge variant="secondary" className="text-[10px]">
                              {entry.is_goalkeeper
                                ? "ARQ"
                                : POSITION_SHORT[entry.players.position]}
                            </Badge>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jugadores" className="mt-6">
          {approvedPlayers.length === 0 ? (
            <EmptyNote>
              Los jugadores aparecen aquí cuando los organizadores aprueben las
              inscripciones. ¿Ya sumaste tu nombre?
            </EmptyNote>
          ) : (
            <PlayersGallery
              players={approvedPlayers.map((player) => ({
                id: player.id,
                name: player.full_name,
                age: player.age,
                positionShort: POSITION_SHORT[player.position],
                footLabel: FOOT_LABELS[player.dominant_foot],
                memberSince: player.member_since,
                photoUrl: player.photo_url,
                teamName: teamOfPlayer.get(player.id) ?? "Por sortear",
              }))}
            />
          )}
        </TabsContent>

        <TabsContent value="penales" className="mt-6">
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 font-display text-2xl tracking-wide">
                <Target className="size-5 text-volt" aria-hidden />
                RETO DE PENALES
                <Link
                  href="/penales"
                  className="ml-auto text-sm font-normal text-volt underline-offset-4 hover:underline"
                >
                  Jugar →
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PenaltyLeaderboard rows={penaltyLeaderboard} limit={15} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goleadores" className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl tracking-wide">
                <Goal className="size-5 text-volt" aria-hidden />
                GOLEADORES
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scorers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay goles. El que anote primero abre la lista.
                </p>
              ) : (
                scorers.map((scorer, i) => (
                  <div key={scorer.player_id} className="flex items-center gap-3">
                    <span className="w-6 font-display text-lg text-volt">
                      {i + 1}
                    </span>
                    <Avatar className="size-8">
                      <AvatarImage src={scorer.photo_url ?? undefined} alt="" />
                      <AvatarFallback>
                        {scorer.full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">
                      {scorer.full_name}
                      <span className="block text-xs text-muted-foreground">
                        {scorer.team_name}
                      </span>
                    </span>
                    <span className="font-display text-2xl text-volt">
                      {scorer.goals}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl tracking-wide">
                <Handshake className="size-5 text-volt" aria-hidden />
                ASISTENCIAS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assists.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay asistencias registradas. El que sirva el primer
                  gol abre la lista.
                </p>
              ) : (
                assists.map((assist, i) => (
                  <div key={assist.player_id} className="flex items-center gap-3">
                    <span className="w-6 font-display text-lg text-volt">
                      {i + 1}
                    </span>
                    <Avatar className="size-8">
                      <AvatarImage src={assist.photo_url ?? undefined} alt="" />
                      <AvatarFallback>
                        {assist.full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">
                      {assist.full_name}
                      <span className="block text-xs text-muted-foreground">
                        {assist.team_name}
                      </span>
                    </span>
                    <span className="font-display text-2xl text-volt">
                      {assist.assists}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl tracking-wide">
                <RectangleVertical
                  className="size-5 fill-yellow-400 text-yellow-400"
                  aria-hidden
                />
                TARJETAS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cards.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Cero tarjetas. Así nos gusta: pasión, amistad y buen fútbol.
                </p>
              ) : (
                cards.map((row) => (
                  <div key={row.player_id} className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarImage src={row.photo_url ?? undefined} alt="" />
                      <AvatarFallback>
                        {row.full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">
                      {row.full_name}
                      <span className="block text-xs text-muted-foreground">
                        {row.team_name}
                      </span>
                    </span>
                    {row.yellow_cards > 0 ? (
                      <span className="flex items-center gap-1 text-sm">
                        <span className="inline-block h-4 w-3 rounded-[2px] bg-yellow-400" />
                        {row.yellow_cards}
                      </span>
                    ) : null}
                    {row.red_cards > 0 ? (
                      <span className="flex items-center gap-1 text-sm">
                        <span className="inline-block h-4 w-3 rounded-[2px] bg-red-500" />
                        {row.red_cards}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
