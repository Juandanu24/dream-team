import {
  STAGE_LABELS,
  type Match,
  type MatchEventType,
  type Team,
} from "@/lib/types";

// En WhatsApp solo usamos emoji de Unicode 6 (2010), que renderiza
// cualquier teléfono. Los cuadrados de colores y la 🅰️ son de 2019 y
// con selector de variación: en equipos viejos salen como "�".
const WA_LABELS: Record<MatchEventType, string> = {
  goal: "⚽ Goles:",
  own_goal: "⚽ En propia:",
  assist: "🎯 Asistencias:",
  yellow_card: "Amarillas:",
  red_card: "Rojas:",
};

export interface SummaryEvent {
  player_id: string;
  team_id: string;
  type: MatchEventType;
  name: string;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://dreamteamcolombia.vercel.app";

// Agrupa por jugador y tipo: "Andrés Pertuz ×2".
function summarize(events: SummaryEvent[], type: MatchEventType): string {
  const counts = new Map<string, { name: string; count: number }>();
  for (const event of events.filter((e) => e.type === type)) {
    const entry = counts.get(event.player_id);
    if (entry) entry.count += 1;
    else counts.set(event.player_id, { name: event.name, count: 1 });
  }
  return [...counts.values()]
    .map((e) => (e.count > 1 ? `${e.name} ×${e.count}` : e.name))
    .join(", ");
}

// Mensaje listo para pegar en el grupo de WhatsApp.
// Usa *negrita* de WhatsApp, no Markdown.
export function buildWhatsAppMessage(
  match: Match,
  teams: Team[],
  events: SummaryEvent[],
): string {
  const nameOf = (id: string | null) =>
    teams.find((t) => t.id === id)?.name ?? "Por definir";

  const home = nameOf(match.home_team_id);
  const away = nameOf(match.away_team_id);

  const lines = [
    `⚽ *${STAGE_LABELS[match.stage]} · Semana ${match.week}*`,
    `*${home} ${match.home_score} - ${match.away_score} ${away}*`,
    "",
  ];

  const homeEvents = events.filter((e) => e.team_id === match.home_team_id);
  const awayEvents = events.filter((e) => e.team_id === match.away_team_id);

  for (const [label, list] of [
    [home, homeEvents],
    [away, awayEvents],
  ] as const) {
    const goals = summarize(list, "goal");
    const own = summarize(list, "own_goal");
    const assists = summarize(list, "assist");
    if (!goals && !own && !assists) continue;

    lines.push(`_${label}_`);
    if (goals) lines.push(`${WA_LABELS.goal} ${goals}`);
    if (own) lines.push(`${WA_LABELS.own_goal} ${own}`);
    if (assists) lines.push(`${WA_LABELS.assist} ${assists}`);
    lines.push("");
  }

  const yellows = summarize(events, "yellow_card");
  const reds = summarize(events, "red_card");
  if (yellows) lines.push(`${WA_LABELS.yellow_card} ${yellows}`);
  if (reds) lines.push(`${WA_LABELS.red_card} ${reds}`);
  if (yellows || reds) lines.push("");

  lines.push(`🏆 Tabla y goleadores: ${SITE_URL}/torneo?tab=posiciones`);

  return lines.join("\n");
}

export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// Mensaje con la programación de una semana, para avisar en el grupo.
export function buildWeekWhatsAppMessage(
  week: number,
  matches: Match[],
  teams: Team[],
): string {
  const nameOf = (id: string | null) =>
    teams.find((t) => t.id === id)?.name ?? "Por definir";

  const cuando = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("es-CO", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "America/Bogota",
        }).format(new Date(iso))
      : "por confirmar";

  const lines = [`📅 *Semana ${week} — Dream Team*`, ""];

  for (const match of matches) {
    lines.push(`*${nameOf(match.home_team_id)}* vs *${nameOf(match.away_team_id)}*`);
    lines.push(`🕗 ${cuando(match.kickoff_at)}`);
    lines.push("");
  }

  lines.push("📍 Cancha F8, Montería");
  lines.push(`⚽ Calendario completo: ${SITE_URL}/torneo?tab=calendario`);

  return lines.join("\n");
}

/** "Martes 18 de agosto · 8:00 PM" en hora de Colombia, para las piezas
 *  de redes. Se arma a mano porque toLocaleString mete comas y "a. m."
 *  donde no van. */
export function formatPieceWhen(iso: string | null): string {
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

/** Lugar fijo del torneo, usado en las piezas. */
export const PIECE_VENUE = "Cancha F8 · Montería";

// ---------- Alineaciones ----------

export interface LineupMessageInput {
  teamName: string;
  rivalName: string;
  when: string;
  venue: string;
  formation: string;
  /** De arquero a delantera. */
  lines: { label: string; players: string[] }[];
  bench: string[];
  notes?: string | null;
}

/** Texto de la alineación para WhatsApp. Mismo criterio de emoji que el
 *  resumen del partido: solo Unicode 6, que renderiza cualquier teléfono. */
export function buildLineupMessage(input: LineupMessageInput): string {
  const partes = [
    `ALINEACION - ${input.teamName.toUpperCase()}`,
    "",
    `vs ${input.rivalName}`,
    input.when,
    input.venue,
    "",
    `Formacion: ${input.formation}`,
    "",
  ];

  for (const line of input.lines) {
    if (line.players.length === 0) continue;
    partes.push(`${line.label}: ${line.players.join(", ")}`);
  }

  if (input.bench.length > 0) {
    partes.push("", `Suplentes: ${input.bench.join(", ")}`);
  }
  if (input.notes) {
    partes.push("", input.notes);
  }

  partes.push("", "Mas info: dreamteamcolombia.vercel.app");
  return partes.join("\n");
}

// ---------- Goleadores por equipo, para las piezas ----------

export interface GoalTally {
  name: string;
  goals: number;
}

interface GoalEvent {
  type: MatchEventType;
  team_id: string;
  players: { full_name: string };
}

/** Reparte los goles del partido en las dos columnas de la pieza.
 *
 *  Un autogol se acredita al jugador que lo hizo pero SUMA AL RIVAL, así
 *  que aparece en la columna del equipo que se benefició, marcado (e.c.).
 *  De lo contrario los nombres de una columna no cuadrarían con su
 *  marcador, que es lo primero que revisa quien mira la foto. */
export function tallyScorers(
  events: GoalEvent[],
  homeTeamId: string,
  awayTeamId: string,
): { home: GoalTally[]; away: GoalTally[] } {
  const conteo = { home: new Map<string, number>(), away: new Map<string, number>() };

  for (const event of events) {
    if (event.type !== "goal" && event.type !== "own_goal") continue;

    const propio = event.type === "own_goal";
    const deCasa = event.team_id === homeTeamId;
    // El autogol cambia de lado; el gol normal se queda en el suyo.
    const lado: "home" | "away" = propio
      ? deCasa
        ? "away"
        : "home"
      : deCasa
        ? "home"
        : "away";

    // Un equipo distinto a los dos del partido no debería existir, pero
    // si el dato viene sucio no lo colamos en una columna al azar.
    if (!deCasa && event.team_id !== awayTeamId) continue;

    const nombre = propio
      ? `${event.players.full_name} (e.c.)`
      : event.players.full_name;
    conteo[lado].set(nombre, (conteo[lado].get(nombre) ?? 0) + 1);
  }

  const aLista = (m: Map<string, number>): GoalTally[] =>
    [...m.entries()]
      .map(([name, goals]) => ({ name, goals }))
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));

  return { home: aLista(conteo.home), away: aLista(conteo.away) };
}
