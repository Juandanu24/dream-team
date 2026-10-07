import Link from "next/link";
import {
  ChevronRight,
  Goal,
  Handshake,
  RectangleVertical,
  Star,
  Trophy,
} from "lucide-react";
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
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SyncedTabs } from "@/components/synced-tabs";
import { InteractiveBall } from "@/components/interactive-ball";
import { NotificationsButton } from "@/components/notifications-button";
import { PlayersGallery } from "@/components/players-gallery";
import { TeamShowcase } from "@/components/team-showcase";
import { TeamCrest } from "@/components/team-crest";
import { PlayoffBracket } from "./playoff-bracket";
import { RankingCard } from "./ranking-card";
import {
  formatKickoff,
  getTournamentData,
  type EventWithPlayer,
} from "@/lib/data";
import { getPublishedLineups, type LineupWithPlayers } from "@/lib/lineups";
import {
  getPublishedTeamsOfWeek,
  type TeamOfWeekWithPlayers,
} from "@/lib/team-of-week";
import { readableAccent } from "@/lib/team-color";
import { cn } from "@/lib/utils";
import {
  FOOT_LABELS,
  POSITION_SHORT,
  STAGE_LABELS,
  type Match,
  type MatchEventType,
  type Player,
  type Team,
  cardName,
} from "@/lib/types";

// Pestañas de /torneo. El valor viaja en ?tab= para poder enlazar
// directo, por ejemplo /torneo?tab=calendario.
const TABS = [
  "posiciones",
  "calendario",
  "equipos",
  "jugadores",
  "goleadores",
  "penales",
];

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

/** Los eventos de UN equipo, agrupados por jugador y tipo.
 *
 *  El autogol va en la columna del equipo que se benefició, marcado
 *  (e.c.): así los nombres de cada columna cuadran con su marcador.
 *  Mismo criterio que la pieza de resultado. */
function eventosDe(
  eventos: EventWithPlayer[],
  teamId: string | null,
  rivalId: string | null,
) {
  const mios = eventos.filter(
    (e) =>
      (e.type === "own_goal" ? e.team_id === rivalId : e.team_id === teamId) &&
      e.type !== "assist",
  );
  const asistencias = eventos.filter(
    (e) => e.type === "assist" && e.team_id === teamId,
  );

  const agrupado = new Map<
    string,
    { tipo: MatchEventType; nombre: string; veces: number }
  >();
  for (const e of [...mios, ...asistencias]) {
    const clave = `${e.player_id}:${e.type}`;
    const previo = agrupado.get(clave);
    if (previo) previo.veces += 1;
    else
      agrupado.set(clave, {
        tipo: e.type,
        nombre: e.players.full_name,
        veces: 1,
      });
  }
  // Primero los goles, que es lo que la gente busca.
  const orden: MatchEventType[] = [
    "goal",
    "own_goal",
    "assist",
    "yellow_card",
    "red_card",
  ];
  return [...agrupado.values()].sort(
    (a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo),
  );
}

/** Marca de cada evento.
 *
 *  A 14px un icono de línea detallado es una mancha: hay que poder
 *  distinguir un gol de una asistencia de reojo, en una lista de doce.
 *  Por eso son formas planas y no iconografía fina — un disco para el
 *  gol, una "A" para la asistencia y los rectángulos de las tarjetas. */
function MarcaEvento({ tipo }: { tipo: MatchEventType }) {
  if (tipo === "yellow_card")
    return (
      <span
        className="inline-block h-3.5 w-2.5 shrink-0 rounded-[2px] bg-yellow-400"
        aria-label="Amarilla"
      />
    );
  if (tipo === "red_card")
    return (
      <span
        className="inline-block h-3.5 w-2.5 shrink-0 rounded-[2px] bg-red-500"
        aria-label="Roja"
      />
    );
  if (tipo === "assist")
    return (
      <span
        className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px] bg-dt-blue/15 font-display text-[10px] leading-none text-dt-blue"
        aria-label="Asistencia"
      >
        A
      </span>
    );
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        tipo === "own_goal"
          ? "bg-transparent ring-1 ring-muted-foreground"
          : "bg-volt",
      )}
      aria-label={tipo === "own_goal" ? "Autogol" : "Gol"}
    />
  );
}

function ColumnaEventos({
  eventos,
  alinearDerecha = false,
}: {
  eventos: ReturnType<typeof eventosDe>;
  alinearDerecha?: boolean;
}) {
  if (eventos.length === 0) return <div />;
  return (
    <ul className="space-y-1">
      {eventos.map((e, i) => (
        <li
          key={i}
          className={cn(
            "flex items-center gap-1.5 text-xs text-muted-foreground",
            alinearDerecha && "sm:flex-row-reverse sm:text-right",
          )}
        >
          <MarcaEvento tipo={e.tipo} />
          <span className="min-w-0 truncate">
            {e.nombre}
            {e.tipo === "own_goal" ? " (e.c.)" : ""}
            {e.veces > 1 ? ` ×${e.veces}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MatchRow({
  match,
  teams,
  events,
  lineups,
  mvp,
}: {
  match: Match;
  teams: Team[];
  events: EventWithPlayer[];
  lineups: LineupWithPlayers[];
  mvp?: { id: string; full_name: string };
}) {
  const kickoff = formatKickoff(match.kickoff_at);
  const matchEvents = events.filter((e) => e.match_id === match.id);
  const local = teams.find((t) => t.id === match.home_team_id);
  const visita = teams.find((t) => t.id === match.away_team_id);
  const jugado = match.status === "finished";
  const porPenales =
    match.home_penalties != null && match.away_penalties != null;

  return (
    <div className="border-b border-separator py-5 last:border-b-0">
      <p className="flex flex-wrap items-center gap-x-2 text-[11px] tracking-[0.18em] text-dt-blue uppercase">
        {STAGE_LABELS[match.stage]}
        {kickoff ? (
          <span className="tracking-normal text-muted-foreground normal-case">
            · {kickoff}
          </span>
        ) : null}
      </p>

      {/* Escudo, nombre y marcador. El escudo hace de ancla visual: en una
          lista de diez partidos los nombres solos se confunden. */}
      <div className="mt-3 flex items-center gap-3 sm:gap-5">
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
          <span className="min-w-0 truncate text-sm font-medium sm:text-base">
            {local?.name ?? "Por definir"}
          </span>
          <TeamCrest
            name={local?.name ?? "Por definir"}
            color={local?.color}
            crestUrl={local?.crest_url}
            className="size-8 shrink-0 sm:size-10"
          />
        </div>

        <div className="shrink-0 text-center">
          {jugado ? (
            <>
              <p className="font-display text-3xl leading-none tabular-nums sm:text-4xl">
                {match.home_score}
                <span className="px-1.5 text-muted-foreground">-</span>
                {match.away_score}
              </p>
              {porPenales ? (
                <p className="mt-1 text-[10px] tracking-widest text-muted-foreground uppercase tabular-nums">
                  {match.home_penalties}-{match.away_penalties} pen
                </p>
              ) : null}
            </>
          ) : (
            <p className="font-display text-xl text-muted-foreground">VS</p>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamCrest
            name={visita?.name ?? "Por definir"}
            color={visita?.color}
            crestUrl={visita?.crest_url}
            className="size-8 shrink-0 sm:size-10"
          />
          <span className="min-w-0 truncate text-sm font-medium sm:text-base">
            {visita?.name ?? "Por definir"}
          </span>
        </div>
      </div>

      {/* Goleadores en dos columnas, una por equipo. Corridos en una sola
          frase, un partido de nueve goles era un muro de texto. */}
      {jugado && matchEvents.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 sm:gap-6">
          <ColumnaEventos
            eventos={eventosDe(matchEvents, match.home_team_id, match.away_team_id)}
            alinearDerecha
          />
          <ColumnaEventos
            eventos={eventosDe(matchEvents, match.away_team_id, match.home_team_id)}
          />
        </div>
      ) : null}

      {mvp ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs">
          <Trophy className="size-3.5 text-volt-text" aria-hidden />
          <span className="text-muted-foreground">Figura:</span>
          <Link
            href={`/jugador/${mvp.id}`}
            className="font-medium text-volt-text underline-offset-4 hover:underline"
          >
            {mvp.full_name}
          </Link>
        </p>
      ) : null}

      {lineups.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {lineups.map((lineup) => (
            <LineupBlock
              key={lineup.id}
              lineup={lineup}
              teamName={teamName(teams, lineup.team_id)}
              color={teams.find((t) => t.id === lineup.team_id)?.color ?? null}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Once ideal de la fecha: los nueve por línea, con su equipo al lado.
function FechaCard({
  week,
  matches,
  teams,
  events,
  lineups,
  approvedPlayers,
  oncesIdeales,
  abierta,
}: {
  week: number;
  matches: Match[];
  teams: Team[];
  events: EventWithPlayer[];
  lineups: LineupWithPlayers[];
  approvedPlayers: Player[];
  oncesIdeales: TeamOfWeekWithPlayers[];
  /** La fecha que arranca desplegada. */
  abierta: boolean;
}) {
  const deLaFecha = matches.filter((m) => m.week === week);
  const jugados = deLaFecha.filter((m) => m.status === "finished").length;
  const resumen =
    jugados === deLaFecha.length
      ? `${deLaFecha.length} partido${deLaFecha.length === 1 ? "" : "s"}`
      : `${jugados} de ${deLaFecha.length} jugado${jugados === 1 ? "" : "s"}`;

  return (
    <Card className="bg-card py-0 shadow-card ring-0">
      {/* `details` y no estado en React: con diez fechas el acordeón no
          justifica hidratar la página entera, y así funciona sin JS. */}
      <details open={abierta} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden
          />
          <span className="font-display text-2xl tracking-wide text-volt-text">
            SEMANA {week}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {resumen}
          </span>
        </summary>
        <div className="px-5 pb-4">
          {deLaFecha.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              teams={teams}
              events={events}
              lineups={lineups.filter((l) => l.match_id === match.id)}
              mvp={
                match.mvp_player_id
                  ? approvedPlayers.find((p) => p.id === match.mvp_player_id)
                  : undefined
              }
            />
          ))}
          {oncesIdeales
            .filter((t) => t.week === week)
            .map((t) => (
              <TeamOfWeekBlock key={t.id} totw={t} />
            ))}
        </div>
      </details>
    </Card>
  );
}

function TeamOfWeekBlock({ totw }: { totw: TeamOfWeekWithPlayers }) {
  const porLinea = (line: string) =>
    totw.entries.filter((e) => e.line === line).map((e) => e.full_name);

  const lineas = [
    { label: "ARQ", players: porLinea("gk") },
    { label: "DEF", players: porLinea("def") },
    { label: "MED", players: porLinea("mid") },
    { label: "DEL", players: porLinea("fwd") },
  ].filter((l) => l.players.length > 0);

  if (lineas.length === 0) return null;

  return (
    <div className="mt-4 rounded-md border border-volt/40 bg-volt/5 p-4">
      <div className="flex items-center gap-2">
        <Star className="size-4 text-volt-text" aria-hidden />
        <span className="font-display text-lg tracking-wide text-volt-text">
          ONCE IDEAL DE LA FECHA
        </span>
        <span className="ml-auto text-xs text-dt-blue">{totw.formation}</span>
      </div>
      <dl className="mt-2 space-y-1">
        {lineas.map((l) => (
          <div key={l.label} className="flex gap-2 text-xs">
            <dt className="w-9 shrink-0 text-muted-foreground">{l.label}</dt>
            <dd className="flex-1">{l.players.join(", ")}</dd>
          </div>
        ))}
      </dl>
      {totw.notes ? (
        <p className="mt-2 border-t border-volt/20 pt-2 text-xs text-muted-foreground">
          {totw.notes}
        </p>
      ) : null}
    </div>
  );
}

// Alineación publicada, compacta: los titulares por línea y la banca.
function LineupBlock({
  lineup,
  teamName,
  color,
}: {
  lineup: LineupWithPlayers;
  teamName: string;
  color: string | null;
}) {
  const accent = readableAccent(color);
  const starters = lineup.entries.filter((e) => e.is_starter);
  const bench = lineup.entries.filter((e) => !e.is_starter);
  const byLine = (line: string) =>
    starters.filter((e) => e.line === line).map((e) => e.full_name);

  const lines = [
    { label: "ARQ", players: byLine("gk") },
    { label: "DEF", players: byLine("def") },
    { label: "MED", players: byLine("mid") },
    { label: "DEL", players: byLine("fwd") },
  ].filter((l) => l.players.length > 0);

  if (lines.length === 0) return null;

  return (
    <div className="rounded-md border border-border/60 bg-card/50 p-3">
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: accent }}
          aria-hidden
        />
        <span className="font-display text-base tracking-wide">{teamName}</span>
        <span className="ml-auto text-xs text-dt-blue">{lineup.formation}</span>
      </div>
      <dl className="mt-2 space-y-1">
        {lines.map((line) => (
          <div key={line.label} className="flex gap-2 text-xs">
            <dt className="w-9 shrink-0 text-muted-foreground">{line.label}</dt>
            <dd className="flex-1">{line.players.join(", ")}</dd>
          </div>
        ))}
        {bench.length > 0 ? (
          <div className="flex gap-2 border-t border-border/40 pt-1 text-xs">
            <dt className="w-9 shrink-0 text-muted-foreground">BAN</dt>
            <dd className="flex-1 text-muted-foreground">
              {bench.map((e) => e.full_name).join(", ")}
            </dd>
          </div>
        ) : null}
      </dl>
      {lineup.notes ? (
        <p className="mt-2 border-t border-border/40 pt-2 text-xs text-volt-text">
          {lineup.notes}
        </p>
      ) : null}
    </div>
  );
}

/** La vista del torneo, reutilizable.
 *
 *  La usan dos rutas: `/torneo`, que muestra el que está en curso, y
 *  `/torneos/[slug]`, que muestra uno archivado. Es la misma pantalla
 *  —tabla, calendario, equipos, jugadores— y duplicarla significaría
 *  arreglar cada cosa dos veces. */
export async function TournamentView({
  slug,
  archivado = false,
}: {
  /** Omitido = el torneo activo. */
  slug?: string;
  /** Cambia el encabezado y avisa que es un torneo terminado. */
  archivado?: boolean;
}) {
  const data = await getTournamentData(slug);
  // Solo las publicadas: los borradores del admin no salen acá.
  const lineups = data ? await getPublishedLineups(data.tournament.id) : [];
  const oncesIdeales = data
    ? await getPublishedTeamsOfWeek(data.tournament.id)
    : [];

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="font-display text-5xl tracking-wide">
          EL <span className="text-volt-text">TORNEO</span>
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
  } = data;
  const captains = new Set(
    roster.filter((entry) => entry.is_captain).map((entry) => entry.player_id),
  );
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const rosterEntryOf = new Map(roster.map((e) => [e.player_id, e]));

  // Vista unificada de jugador, usada por la galería y por los planteles.
  const toGalleryPlayer = (player: (typeof approvedPlayers)[number]) => {
    const entry = rosterEntryOf.get(player.id);
    const team = entry ? teamById.get(entry.team_id) : undefined;
    return {
      id: player.id,
      // El de la camiseta; cae al completo si todavía no lo eligió.
      name: cardName(player),
      age: player.age,
      heightCm: player.height_cm ?? null,
      positionShort: entry?.is_goalkeeper
        ? "ARQ"
        : POSITION_SHORT[player.position],
      footLabel: FOOT_LABELS[player.dominant_foot],
      memberSince: player.member_since,
      photoUrl: player.photo_url,
      teamName: team?.name ?? "Por sortear",
      teamColor: team?.color ?? null,
      crestUrl: team?.crest_url ?? null,
      isCaptain: captains.has(player.id),
    };
  };

  const galleryPlayers = approvedPlayers.map(toGalleryPlayer);
  const showcaseTeams = teams.map((team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    crestUrl: team.crest_url ?? null,
    players: galleryPlayers
      .filter((p) => rosterEntryOf.get(p.id)?.team_id === team.id)
      .sort(
        (a, b) =>
          Number(b.isCaptain) - Number(a.isCaptain) ||
          a.name.localeCompare(b.name),
      ),
  }));
  const torneoTerminado = tournament.status === "finished";
  // Las figuras no tienen vista SQL: se cuentan de matches.mvp_player_id,
  // que ya viene cargado. Solo entran los que tienen al menos una.
  const vecesFigura = new Map<string, number>();
  for (const m of matches) {
    if (m.mvp_player_id) {
      vecesFigura.set(m.mvp_player_id, (vecesFigura.get(m.mvp_player_id) ?? 0) + 1);
    }
  }
  const figuras = [...vecesFigura.entries()]
    .map(([playerId, valor]) => {
      const jugador = approvedPlayers.find((p) => p.id === playerId);
      const equipo = teamById.get(rosterEntryOf.get(playerId)?.team_id ?? "");
      return {
        playerId,
        name: jugador ? cardName(jugador) : "—",
        photoUrl: jugador?.photo_url ?? null,
        teamName: equipo?.name ?? null,
        valor,
      };
    })
    .sort((a, b) => b.valor - a.valor || a.name.localeCompare(b.name));

  const weeks = [...new Set(matches.map((m) => m.week))].sort((a, b) => a - b);
  const jugadas = weeks.filter((w) =>
    matches.some((m) => m.week === w && m.status === "finished"),
  );
  const semanaAbierta = jugadas.at(-1) ?? weeks[0];
  // Las fechas de grupos y las de playoff se muestran aparte: en grupos lo
  // que importa es cuándo se juega, y en playoff de dónde sale cada uno.
  const esDePlayoff = (semana: number) =>
    matches.some((m) => m.week === semana && m.stage !== "group");
  const semanasDeGrupos = weeks.filter((w) => !esDePlayoff(w));
  const semanasDePlayoff = weeks.filter(esDePlayoff);
  const partidosDePlayoff = matches.filter((m) => m.stage !== "group");

  return (
    <div className="relative mx-auto max-w-5xl overflow-hidden px-4 py-12">
      <div className="animate-float pointer-events-none absolute -top-4 -right-12 size-32 text-volt-text/15 motion-reduce:animate-none sm:right-0 sm:size-40">
        <InteractiveBall className="pointer-events-auto size-full" spinSeconds={32} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-5xl tracking-wide">
          {tournament.name.toUpperCase()}
        </h1>
        <Badge variant="outline" className="border-volt/50 text-volt-text">
          {tournament.status === "registration"
            ? "Inscripciones abiertas"
            : tournament.status === "in_progress"
              ? "En juego"
              : "Finalizado"}
        </Badge>
        {/* Los avisos son del torneo en curso: en un archivo no tienen
            nada que notificar. */}
        {archivado ? null : <NotificationsButton className="ml-auto" withLabel />}
      </div>

      {archivado ? (
        <p className="mt-3 rounded-md border border-dt-blue/40 bg-dt-blue/5 px-4 py-3 text-sm">
          Este torneo ya terminó. Estás viendo el archivo.{" "}
          <Link
            href="/torneo"
            className="text-dt-blue underline-offset-4 hover:underline"
          >
            Ir al torneo en curso
          </Link>
          .
        </p>
      ) : null}

      <SyncedTabs
        tabs={TABS}
        defaultTab="posiciones"
        className="mt-8"
      >
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
          <TabsTrigger value="jugadores" className="col-span-3 py-1.5">
            Jugadores
          </TabsTrigger>
          <TabsTrigger value="goleadores" className="col-span-3 py-1.5">
            Estadísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posiciones" className="mt-6 space-y-4">
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
                      <TableHead className="text-center text-volt-text">PTS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((row, i) => (
                      <TableRow key={row.team_id}>
                        <TableCell className="font-display text-lg text-volt-text">
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
                        <TableCell className="text-center font-display text-lg text-volt-text">
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

          {partidosDePlayoff.length > 0 ? (
            <Card className="bg-card shadow-card ring-0">
              <CardHeader>
                <CardTitle className="font-display text-2xl tracking-wide">
                  PLAYOFF
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  El puesto final no sale de esta tabla: sale de la final y del
                  partido por el tercer puesto.
                </p>
              </CardHeader>
              <CardContent className="px-4 pb-2 sm:px-6">
                <PlayoffBracket matches={partidosDePlayoff} teams={teams} />
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="calendario" className="mt-6 space-y-4">
          {matches.length === 0 ? (
            <EmptyNote>
              El calendario se publica cuando se sorteen los equipos. Mientras
              tanto: martes 8:00 PM y jueves 9:00 PM, cancha F8.
            </EmptyNote>
          ) : (
            <>
              {semanasDeGrupos.length > 0 ? (
                <section className="space-y-4">
                  <h3 className="font-display text-xl tracking-[0.18em] text-muted-foreground uppercase">
                    Fase de grupos
                  </h3>
                  {semanasDeGrupos.map((week) => (
                    <FechaCard
                      key={week}
                      week={week}
                      matches={matches}
                      teams={teams}
                      events={events}
                      lineups={lineups}
                      approvedPlayers={approvedPlayers}
                      oncesIdeales={oncesIdeales}
                      abierta={week === semanaAbierta}
                    />
                  ))}
                </section>
              ) : null}

              {partidosDePlayoff.length > 0 ? (
                <section className="space-y-4 pt-6">
                  <h3 className="font-display text-xl tracking-[0.18em] text-muted-foreground uppercase">
                    Playoff
                  </h3>
                  {semanasDePlayoff.map((week) => (
                    <FechaCard
                      key={week}
                      week={week}
                      matches={matches}
                      teams={teams}
                      events={events}
                      lineups={lineups}
                      approvedPlayers={approvedPlayers}
                      oncesIdeales={oncesIdeales}
                      abierta={week === semanaAbierta}
                    />
                  ))}
                </section>
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="equipos" className="mt-6 space-y-4">
          {showcaseTeams.length === 0 ? (
            <EmptyNote>
              Los equipos se anuncian cuando cierre la inscripción. ¿Ya sumaste
              tu nombre?
            </EmptyNote>
          ) : (
            showcaseTeams.map((team) => (
              <TeamShowcase key={team.id} team={team} />
            ))
          )}
        </TabsContent>

        <TabsContent value="jugadores" className="mt-6">
          {approvedPlayers.length === 0 ? (
            <EmptyNote>
              Los jugadores aparecen aquí cuando los organizadores aprueben las
              inscripciones. ¿Ya sumaste tu nombre?
            </EmptyNote>
          ) : (
            <PlayersGallery players={galleryPlayers} />
          )}
        </TabsContent>

        <TabsContent value="goleadores" className="mt-6 grid gap-4 lg:grid-cols-2">
          <RankingCard
            titulo="Goleadores"
            tituloLider="Goleador del torneo"
            icono={<Goal className="size-5 text-volt-text" aria-hidden />}
            acento="volt"
            sufijo={["gol", "goles"]}
            coronar={torneoTerminado}
            vacio="Todavía no hay goles. El que anote primero abre la lista."
            filas={scorers.map((r) => ({
              playerId: r.player_id,
              name: r.full_name,
              photoUrl: r.photo_url,
              teamName: r.team_name,
              valor: r.goals,
            }))}
          />

          <RankingCard
            titulo="Asistencias"
            tituloLider="Máximo asistidor"
            icono={<Handshake className="size-5 text-dt-blue" aria-hidden />}
            acento="blue"
            sufijo={["asistencia", "asistencias"]}
            coronar={torneoTerminado}
            vacio="Todavía no hay asistencias registradas. El que sirva el primer gol abre la lista."
            filas={assists.map((r) => ({
              playerId: r.player_id,
              name: r.full_name,
              photoUrl: r.photo_url,
              teamName: r.team_name,
              valor: r.assists,
            }))}
          />

          <RankingCard
            titulo="Figuras"
            tituloLider="Más figuras del torneo"
            icono={<Trophy className="size-5 text-volt-text" aria-hidden />}
            acento="volt"
            sufijo={["figura", "figuras"]}
            coronar={torneoTerminado}
            vacio="Las figuras del partido las elige la organización después de cada fecha."
            filas={figuras}
          />

          <Card className="bg-card shadow-card ring-0">
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
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {row.full_name}
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.team_name}
                      </span>
                    </span>
                    {row.yellow_cards > 0 ? (
                      <span className="flex items-center gap-1 text-sm tabular-nums">
                        <span className="inline-block h-4 w-3 rounded-[2px] bg-yellow-400" />
                        {row.yellow_cards}
                      </span>
                    ) : null}
                    {row.red_cards > 0 ? (
                      <span className="flex items-center gap-1 text-sm tabular-nums">
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
      </SyncedTabs>
    </div>
  );
}
