import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { getTeamOfWeekData } from "@/lib/team-of-week";
import { type LineupLine } from "@/lib/types";
import { TotwEditor, type TotwCandidate, type TotwSeed } from "./totw-editor";

export const dynamic = "force-dynamic";

export default async function OnceIdealPage() {
  const data = await getTeamOfWeekData();

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-4xl tracking-wide">
          ONCE IDEAL DE LA <span className="text-dt-blue">FECHA</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No pudimos leer el torneo. Si acabas de crear las tablas, revisa que
          la migración <code>00011_figura_y_once_ideal.sql</code> haya corrido.
        </p>
      </div>
    );
  }

  const { teams, matches, roster, weeks } = data;
  const jugables = matches.filter((m) => m.home_team_id && m.away_team_id);
  const semanas = [...new Set(jugables.map((m) => m.week))].sort((a, b) => a - b);

  // Semana por defecto: la última con algo jugado, que es la que se arma.
  const jugadas = jugables.filter((m) => m.status === "finished").map((m) => m.week);
  const abierta = jugadas.length > 0 ? Math.max(...jugadas) : (semanas[0] ?? 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-4xl tracking-wide sm:text-5xl">
        ONCE IDEAL DE LA <span className="text-dt-blue">FECHA</span>
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Los nueve de la semana, mezclando los cuatro equipos. Se publica en la
        web, avisa por push y sale la imagen para Instagram.
      </p>

      {semanas.length === 0 ? (
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
          {semanas.map((week) => {
            // Solo los equipos que jugaron esa semana entran al once.
            const equiposDeLaSemana = new Set(
              jugables
                .filter((m) => m.week === week)
                .flatMap((m) => [m.home_team_id, m.away_team_id])
                .filter((id): id is string => Boolean(id)),
            );

            const candidates: TotwCandidate[] = roster
              .filter((r) => equiposDeLaSemana.has(r.team_id))
              .map((r) => ({
                playerId: r.player_id,
                name: r.players.full_name,
                teamName:
                  teams.find((t) => t.id === r.team_id)?.name ?? "Sin equipo",
                isGoalkeeper: r.is_goalkeeper,
              }))
              .sort((a, b) => a.name.localeCompare(b.name));

            const guardado = weeks.find((w) => w.week === week);
            const seed: TotwSeed | null = guardado
              ? {
                  id: guardado.id,
                  formation: guardado.formation,
                  notes: guardado.notes,
                  publishedAt: guardado.published_at,
                  slots: Object.fromEntries(
                    guardado.entries.map((e) => [
                      e.player_id,
                      { line: e.line as LineupLine, slot: e.slot },
                    ]),
                  ),
                }
              : null;

            return (
              <Card key={week} className="border-border/60 bg-card/70 py-0">
                <details open={week === abierta} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 p-5">
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                    <span className="font-display text-2xl tracking-wide text-volt">
                      SEMANA {week}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {guardado
                        ? guardado.published_at
                          ? "publicado"
                          : "borrador"
                        : "sin armar"}
                    </span>
                  </summary>
                  <CardContent className="px-5 pb-5">
                    {candidates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Los equipos de esta semana no tienen jugadores
                        asignados.
                      </p>
                    ) : (
                      <TotwEditor
                        week={week}
                        candidates={candidates}
                        seed={seed}
                      />
                    )}
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
