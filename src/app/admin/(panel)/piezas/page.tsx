import { getTournamentData, type EventWithPlayer } from "@/lib/data";
import { tallyScorers } from "@/lib/match-summary";
import {
  FOOT_LABELS,
  POSITION_SHORT,
  STAGE_LABELS,
  type Match,
  type Team,
} from "@/lib/types";
import { PiecesStudio, type PiecesData } from "./pieces-studio";
import { WeekPack } from "./week-pack";

export const dynamic = "force-dynamic";

const VENUE = "Cancha F8 · Montería";

// "Martes 18 de agosto · 8:00 PM" en hora de Colombia. Se arma a mano
// porque toLocaleString mete comas y "a. m." donde no van.
function formatWhen(iso: string | null): string {
  if (!iso) return "Fecha por definir";
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const period = get("dayPeriod").replace(/[.\s]/g, "").toUpperCase();
  return `${get("weekday")} ${get("day")} de ${get("month")} · ${get("hour")}:${get("minute")} ${period}`;
}

function teamSide(teams: Team[], id: string | null) {
  const team = teams.find((t) => t.id === id);
  return {
    name: team?.name ?? "Por definir",
    color: team?.color ?? null,
    crestUrl: team?.crest_url ?? null,
  };
}

// Los goles del partido, ya repartidos en las dos columnas de la pieza.
function scorersOf(match: Match, events: EventWithPlayer[]) {
  return tallyScorers(
    events.filter((e) => e.match_id === match.id),
    match.home_team_id ?? "",
    match.away_team_id ?? "",
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-4xl tracking-wide">
        PIEZAS PARA <span className="text-dt-blue">REDES</span>
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default async function PiezasPage() {
  const data = await getTournamentData();

  if (!data) {
    return (
      <EmptyState message="No pudimos leer el torneo. Revisa la conexión con Supabase." />
    );
  }

  const {
    teams,
    matches,
    events,
    standings,
    scorers,
    assists,
    roster,
    penaltyLeaderboard,
  } = data;

  // Solo sirven los partidos con los dos equipos definidos: una
  // semifinal sin cruce todavía no se puede dibujar.
  const matchOptions = matches
    .filter((m) => m.home_team_id && m.away_team_id)
    .map((match) => {
      const home = teamSide(teams, match.home_team_id);
      const away = teamSide(teams, match.away_team_id);
      const finished = match.status === "finished";
      const scorers = finished
        ? scorersOf(match, events)
        : { home: [], away: [] };
      return {
        id: match.id,
        week: match.week,
        label: `Semana ${match.week} · ${home.name} vs ${away.name}`,
        eyebrow: `Semana ${match.week} · ${STAGE_LABELS[match.stage]}`,
        when: formatWhen(match.kickoff_at),
        venue: VENUE,
        home: { ...home, score: match.home_score },
        away: { ...away, score: match.away_score },
        finished,
        homeScorers: scorers.home,
        awayScorers: scorers.away,
      };
    });

  const playedWeeks = new Set(
    matches.filter((m) => m.status === "finished").map((m) => m.week),
  );
  const lastWeek = playedWeeks.size > 0 ? Math.max(...playedWeeks) : 0;
  const weekLabel = lastWeek > 0 ? `Después de la semana ${lastWeek}` : "Fase de grupos";

  const pieces: PiecesData = {
    matches: matchOptions,
    standings: {
      eyebrow: weekLabel,
      rows: standings.map((row) => ({
        teamName: row.team_name,
        color: row.team_color,
        crestUrl: teams.find((t) => t.id === row.team_id)?.crest_url ?? null,
        played: row.played,
        goalDiff: row.goal_diff,
        points: row.points,
      })),
    },
    scorers: {
      eyebrow: weekLabel,
      // Se mandan todos y el estudio decide cuántos dibujar: tras la
      // primera fecha hay nueve empatados en un gol y recortar a seis
      // dejaba fuera a gente con el mismo mérito.
      rows: scorers.slice(0, 20).map((row) => ({
        name: row.full_name,
        detail: row.team_name,
        value: row.goals,
        photoUrl: row.photo_url,
        color: row.team_color,
      })),
    },
    assists: {
      eyebrow: weekLabel,
      rows: assists.slice(0, 20).map((row) => ({
        name: row.full_name,
        detail: row.team_name,
        value: row.assists,
        photoUrl: row.photo_url,
        color: row.team_color,
      })),
    },
    penalties: {
      eyebrow: "Reto de penales",
      rows: penaltyLeaderboard.slice(0, 20).map((row) => ({
        name: row.full_name,
        detail: `${row.attempts} ${row.attempts === 1 ? "intento" : "intentos"}`,
        value: row.best_score,
        photoUrl: row.photo_url,
        color: null,
      })),
    },
    teams: teams.map((team) => {
      const squad = roster.filter((r) => r.team_id === team.id);
      return {
        id: team.id,
        eyebrow: "Presentación de equipo",
        team: {
          name: team.name,
          color: team.color,
          crestUrl: team.crest_url ?? null,
        },
        captain: squad.find((r) => r.is_captain)?.players.full_name,
        players: squad
          .map((r) => r.players.full_name)
          .sort((a, b) => a.localeCompare(b)),
        // Datos completos de cada carta, para exportar el multipost
        // del equipo: escudo + una carta por jugador.
        cards: squad
          .slice()
          .sort((a, b) => a.players.full_name.localeCompare(b.players.full_name))
          .map((r) => ({
            name: r.players.full_name,
            age: r.players.age,
            positionShort: POSITION_SHORT[r.players.position],
            footLabel: FOOT_LABELS[r.players.dominant_foot],
            memberSince: r.players.member_since,
            photoUrl: r.players.photo_url,
            teamName: team.name,
            teamColor: team.color,
            crestUrl: team.crest_url ?? null,
            isCaptain: Boolean(r.is_captain),
          })),
      };
    }),
  };

  const hasSomething =
    pieces.matches.length > 0 ||
    pieces.standings.rows.length > 0 ||
    pieces.teams.length > 0;

  if (!hasSomething) {
    return (
      <EmptyState message="Todavía no hay equipos ni partidos. Ármalos en Equipos y Calendario, y vuelve." />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-4xl tracking-wide sm:text-5xl">
        PIEZAS PARA <span className="text-dt-blue">REDES</span>
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Las imágenes se dibujan con los datos reales del torneo, con las fuentes
        y los colores de la web. Descárgalas y súbelas a Instagram.
      </p>
      <WeekPack data={pieces} />
      <PiecesStudio data={pieces} />
    </div>
  );
}
