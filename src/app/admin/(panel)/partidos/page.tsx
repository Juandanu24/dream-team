import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import { ShareTextButton } from "@/components/share-text-button";
import { getAdminMatchesData, toBogotaInput } from "@/lib/admin-matches";
import { type Match, type Team } from "@/lib/types";
import { buildWeekWhatsAppMessage } from "@/lib/match-summary";
import { deleteFixture } from "./actions";
import { MatchScheduleRow } from "./match-schedule-row";
import { PublishWeekButton } from "./publish-week-button";
import { WeekPlanner } from "./week-planner";

export const dynamic = "force-dynamic";

// Revisa que en la semana jueguen todos los equipos, exactamente una
// vez. Con 4 equipos y 2 partidos por semana, cualquier otra cosa deja
// a alguien por fuera o hace que alguien juegue doble.
function weekIssues(weekMatches: Match[], teams: Team[]): string[] {
  const issues: string[] = [];
  const sinCruce = weekMatches.filter(
    (m) => !m.home_team_id || !m.away_team_id,
  ).length;
  if (sinCruce > 0) {
    issues.push(`${sinCruce} partido${sinCruce > 1 ? "s" : ""} sin cruce`);
  }

  const counts = new Map<string, number>();
  for (const match of weekMatches) {
    for (const id of [match.home_team_id, match.away_team_id]) {
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const repetidos = teams.filter((t) => (counts.get(t.id) ?? 0) > 1);
  const ausentes = teams.filter((t) => !counts.has(t.id));

  if (repetidos.length > 0) {
    issues.push(`juegan dos veces: ${repetidos.map((t) => t.name).join(", ")}`);
  }
  if (ausentes.length > 0 && sinCruce === 0) {
    issues.push(`no juegan: ${ausentes.map((t) => t.name).join(", ")}`);
  }
  return issues;
}

export default async function AdminFixturePage() {
  const data = await getAdminMatchesData();

  if (!data) {
    return (
      <div>
        <h1 className="font-display text-4xl tracking-wide">CALENDARIO</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No se pudo leer la base de datos. Revisa la configuración de Supabase.
        </p>
      </div>
    );
  }

  const { teams, matches } = data;
  const weeks = [...new Set(matches.map((m) => m.week))].sort((a, b) => a - b);
  const nextWeek = weeks.length > 0 ? Math.max(...weeks) + 1 : 1;
  const anyFinished = matches.some((m) => m.status === "finished");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide">CALENDARIO</h1>
        {matches.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {weeks.length} semana{weeks.length > 1 ? "s" : ""} ·{" "}
            {matches.length} partidos
          </p>
        ) : null}
      </div>

      {teams.length < 2 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Primero crea los equipos en{" "}
          <Link
            href="/admin/equipos"
            className="text-volt underline-offset-4 hover:underline"
          >
            Equipos
          </Link>
          .
        </p>
      ) : (
        <>
          <WeekPlanner teams={teams} nextWeek={nextWeek} weeks={weeks} />

          {/* Semanas ya programadas */}
          {weeks.length > 0 ? (
            <>
              <div className="mt-8 space-y-4">
                {weeks.map((week) => {
                  const weekMatches = matches.filter((m) => m.week === week);
                  const issues = weekIssues(weekMatches, teams);
                  return (
                    <Card key={week} className="border-border/60 bg-card/70">
                      <CardHeader>
                        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-2xl tracking-wide text-volt">
                          SEMANA {week}
                          {issues.length === 0 ? (
                            <span className="text-xs font-normal text-volt/80">
                              ✓ Juegan los {teams.length}
                            </span>
                          ) : (
                            <span className="text-xs font-normal text-yellow-500">
                              ⚠️ {issues.join(" · ")}
                            </span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {weekMatches.map((match) => (
                          <MatchScheduleRow
                            key={match.id}
                            match={match}
                            teams={teams}
                            kickoffValue={toBogotaInput(match.kickoff_at)}
                          />
                        ))}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <PublishWeekButton
                            week={week}
                            published={weekMatches.every((m) => m.announced_at)}
                          />
                          <ShareTextButton
                            text={buildWeekWhatsAppMessage(week, weekMatches, teams)}
                            title="Compartir la programación en WhatsApp"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <ConfirmButton
                  action={deleteFixture}
                  message={
                    anyFinished
                      ? "¿Borrar TODO el calendario? Se eliminan los partidos Y sus resultados, goles y tarjetas. Esto no se puede deshacer."
                      : "¿Borrar todo el calendario? Se eliminan todos los partidos."
                  }
                  variant="outline"
                  className="text-muted-foreground hover:text-destructive"
                >
                  Borrar calendario completo
                </ConfirmButton>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
