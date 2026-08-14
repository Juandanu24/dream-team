import Link from "next/link";
import { CalendarDays, ClipboardList, Goal, Trophy, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TeamCrest } from "@/components/team-crest";
import { formatKickoff, getTournamentData } from "@/lib/data";
import { STAGE_LABELS } from "@/lib/types";
import { TournamentStatusCard } from "./tournament-status";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const data = await getTournamentData();

  if (!data) {
    return (
      <div>
        <h1 className="font-display text-4xl tracking-wide">
          PANEL DEL <span className="text-volt">TORNEO</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No se pudo leer la base de datos. ¿Ya configuraste Supabase y el
          archivo .env.local? Mira el AGENTS.md del proyecto.
        </p>
      </div>
    );
  }

  const { standings, teams, roster, approvedPlayers, matches, scorers } = data;
  const pending = data.registrations.pending;
  const played = matches.filter((m) => m.status === "finished").length;
  const next = matches
    .filter((m) => m.status === "scheduled" && m.kickoff_at)
    .sort((a, b) => (a.kickoff_at! < b.kickoff_at! ? -1 : 1))
    .slice(0, 3);

  const tiles = [
    {
      href: "/admin/inscripciones",
      icon: ClipboardList,
      label: "Pendientes por aprobar",
      value: pending,
      highlight: pending > 0,
    },
    {
      href: "/admin/inscripciones",
      icon: Users,
      label: "Jugadores aprobados",
      value: approvedPlayers.length,
    },
    {
      href: "/admin/equipos",
      icon: Trophy,
      label: "Equipos creados",
      value: teams.length,
    },
    {
      href: "/admin/partidos",
      icon: CalendarDays,
      label: `Partidos jugados de ${matches.length}`,
      value: played,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide">
          PANEL DEL <span className="text-volt">TORNEO</span>
        </h1>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <Link key={tile.label} href={tile.href}>
              <Card
                className={`h-full border-border/60 bg-card/70 transition-colors hover:border-volt/50 ${
                  tile.highlight ? "border-volt/60" : ""
                }`}
              >
                <CardContent className="px-5 py-2">
                  <tile.icon className="size-5 text-volt" aria-hidden />
                  <p className="mt-3 font-display text-4xl">{tile.value}</p>
                  <p className="text-sm text-muted-foreground">{tile.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <TournamentStatusCard status={data.tournament.status} />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Tabla de posiciones */}
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-2xl tracking-wide">
              TABLA DE POSICIONES
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            {standings.length === 0 ? (
              <p className="px-3 pb-3 text-sm text-muted-foreground">
                Crea los equipos para ver la tabla.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-xs tracking-widest uppercase">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead className="text-center">PJ</TableHead>
                    <TableHead className="text-center">G</TableHead>
                    <TableHead className="text-center">E</TableHead>
                    <TableHead className="text-center">P</TableHead>
                    <TableHead className="text-center">DG</TableHead>
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
                          <span className="truncate">{row.team_name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{row.played}</TableCell>
                      <TableCell className="text-center">{row.won}</TableCell>
                      <TableCell className="text-center">{row.drawn}</TableCell>
                      <TableCell className="text-center">{row.lost}</TableCell>
                      <TableCell className="text-center">{row.goal_diff}</TableCell>
                      <TableCell className="text-center font-display text-lg text-volt">
                        {row.points}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Goleadores */}
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
                Sin goles registrados todavía.
              </p>
            ) : (
              scorers.slice(0, 8).map((scorer, i) => (
                <div key={scorer.player_id} className="flex items-center gap-3">
                  <span className="w-5 font-display text-lg text-volt">
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
      </div>

      {/* Próximos partidos */}
      {next.length > 0 ? (
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-2xl tracking-wide">
              PRÓXIMOS PARTIDOS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {next.map((match) => {
              const home = teams.find((t) => t.id === match.home_team_id);
              const away = teams.find((t) => t.id === match.away_team_id);
              return (
                <div
                  key={match.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                >
                  <span className="w-36 shrink-0 text-xs text-volt uppercase">
                    {STAGE_LABELS[match.stage]}
                  </span>
                  <span className="flex-1">
                    {home?.name ?? "Por definir"} vs {away?.name ?? "Por definir"}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {formatKickoff(match.kickoff_at)}
                  </span>
                </div>
              );
            })}
            <p className="pt-2 text-xs text-muted-foreground">
              Los resultados se cargan en{" "}
              <Link
                href="/admin/partidos"
                className="text-volt underline-offset-4 hover:underline"
              >
                Partidos
              </Link>
              . {roster.length} jugadores repartidos en {teams.length} equipos.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
