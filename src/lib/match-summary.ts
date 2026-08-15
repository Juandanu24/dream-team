import {
  EVENT_ICONS,
  STAGE_LABELS,
  type Match,
  type MatchEventType,
  type Team,
} from "@/lib/types";

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
    if (goals) lines.push(`${EVENT_ICONS.goal} ${goals}`);
    if (own) lines.push(`${EVENT_ICONS.own_goal} ${own} (en propia)`);
    if (assists) lines.push(`${EVENT_ICONS.assist} ${assists}`);
    lines.push("");
  }

  const yellows = summarize(events, "yellow_card");
  const reds = summarize(events, "red_card");
  if (yellows) lines.push(`${EVENT_ICONS.yellow_card} ${yellows}`);
  if (reds) lines.push(`${EVENT_ICONS.red_card} ${reds}`);
  if (yellows || reds) lines.push("");

  lines.push(`🏆 Tabla y goleadores: ${SITE_URL}/torneo`);

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
  lines.push(`⚽ Calendario completo: ${SITE_URL}/torneo`);

  return lines.join("\n");
}
