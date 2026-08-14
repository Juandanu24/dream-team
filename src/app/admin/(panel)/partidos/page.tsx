import Link from "next/link";
import { Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { getAdminMatchesData, toBogotaInput } from "@/lib/admin-matches";
import { STAGE_LABELS, type Match, type Team } from "@/lib/types";
import { deleteFixture, deleteMatch, updateMatch } from "./actions";
import { AddWeekForm } from "./add-week-form";
import { PublishFixtureButton } from "./publish-fixture-button";

export const dynamic = "force-dynamic";

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

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

// Fila de programación: fecha, hora y cruce. Los resultados viven en
// su propio módulo.
function MatchSchedule({ match, teams }: { match: Match; teams: Team[] }) {
  return (
    <form
      action={updateMatch.bind(null, match.id)}
      className="flex flex-wrap items-center gap-2 border-b border-border/40 py-3 last:border-b-0"
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
      <select
        name="home_team_id"
        defaultValue={match.home_team_id ?? ""}
        className={selectClass}
        aria-label="Equipo local"
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
        aria-label="Equipo visitante"
      >
        <option value="">Visitante por definir</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <Button variant="ghost" size="sm" type="submit" title="Guardar cambios">
        <Save aria-hidden />
      </Button>
      {match.status === "finished" ? (
        <Badge>Jugado</Badge>
      ) : (
        <ConfirmButton
          action={deleteMatch.bind(null, match.id)}
          message="¿Borrar este partido del calendario?"
          variant="ghost"
          title="Borrar partido"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden />
        </ConfirmButton>
      )}
    </form>
  );
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
          {/* Programar la próxima semana */}
          <Card className="mt-6 border-volt/40 bg-card/70">
            <CardHeader>
              <CardTitle className="font-display text-2xl tracking-wide">
                PROGRAMAR SEMANA {nextWeek}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AddWeekForm teams={teams} nextWeek={nextWeek} />
            </CardContent>
          </Card>

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
                          <MatchSchedule
                            key={match.id}
                            match={match}
                            teams={teams}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <PublishFixtureButton />
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
