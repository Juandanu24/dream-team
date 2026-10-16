import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeamCrest } from "@/components/team-crest";
import { PlayerPhoto } from "@/components/player-photo";
import { AutoRefresh } from "@/components/auto-refresh";
import { getDraftData } from "@/lib/draft";
import { nombreDeBombo } from "@/lib/draft-turn";
import { POSITION_SHORT } from "@/lib/types";

export const metadata: Metadata = {
  title: "El sorteo",
  description:
    "El sorteo de jugadores del Dream Team en vivo: el orden, los bombos y a quién eligió cada equipo.",
};

// Dinámica a propósito, y sin caché: mientras el sorteo corre cambia
// cada pocos segundos y servir una versión de hace un minuto sería
// mostrar un turno que ya pasó.
export const dynamic = "force-dynamic";

export default async function SorteoPage() {
  const data = await getDraftData();

  if (!data || data.draft.status === "setup") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
          EL <span className="text-volt-text">SORTEO</span>
        </h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Todavía no arranca. Acá vas a ver en vivo el orden de elección y a
          quién va eligiendo cada equipo.
        </p>
        <Button className="mt-6 h-12 rounded-full px-7 text-base font-semibold" asChild>
          <Link href="/inscripcion">Quiero jugar</Link>
        </Button>
      </div>
    );
  }

  const {
    draft, equipos, disponibles, disponiblesEnLaRonda, picks, equipoEnTurno,
    potActual,
  } = data;
  const enCurso = draft.status === "running";
  const participantes = equipos.filter((e) => e.participates && e.position);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {/* Mientras corre, la página se refresca sola: el que lo está
          siguiendo no tiene que recargar a mano. */}
      {enCurso ? <AutoRefresh segundos={12} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
          EL <span className="text-volt-text">SORTEO</span>
        </h1>
        {enCurso ? (
          <span className="flex items-center gap-1.5 rounded-full bg-volt px-3 py-1 font-display text-sm tracking-widest text-volt-ink uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-volt-ink" />
            En vivo
          </span>
        ) : (
          <span className="rounded-full bg-surface-2 px-3 py-1 font-display text-sm tracking-widest text-muted-foreground uppercase">
            Terminado
          </span>
        )}
      </div>

      {/* Turno */}
      {enCurso ? (
        <Card className="sticky top-16 z-20 mt-6 border border-volt/40 bg-card shadow-card ring-0">
          <CardContent className="px-4 sm:px-5">
            <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              {draft.mode === "pots" && potActual
                ? `${nombreDeBombo(potActual)} · vuelta ${draft.current_round}`
                : `Vuelta ${draft.current_round}`}
              {" · "}
              {disponiblesEnLaRonda.length} por elegir
            </p>
            {equipoEnTurno ? (
              <p className="mt-1 flex items-center gap-3 font-display text-3xl tracking-wide sm:text-4xl">
                <TeamCrest
                  name={equipoEnTurno.name}
                  color={equipoEnTurno.color}
                  crestUrl={equipoEnTurno.crestUrl}
                  className="size-10 shrink-0"
                />
                ELIGE {equipoEnTurno.name.toUpperCase()}
              </p>
            ) : null}
            {equipoEnTurno?.capitan ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Al bate: {equipoEnTurno.capitan}
              </p>
            ) : null}
            {!equipoEnTurno ? (
              <p className="mt-1 font-display text-2xl tracking-wide text-muted-foreground">
                Ronda completa
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Orden */}
      {participantes.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl tracking-wide">
            ORDEN DE ELECCIÓN
          </h2>
          <ol className="mt-3 flex flex-wrap gap-2">
            {participantes.map((e) => (
              <li
                key={e.teamId}
                className="flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pr-4 pl-2"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-dt-blue font-display text-sm text-background tabular-nums">
                  {e.position}
                </span>
                <TeamCrest
                  name={e.name}
                  color={e.color}
                  crestUrl={e.crestUrl}
                  className="size-5 shrink-0"
                />
                <span className="text-sm font-medium">{e.name}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Lo último elegido, en grande */}
      {picks.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl tracking-wide">
            LO ÚLTIMO ({picks.length})
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[...picks]
              .reverse()
              .slice(0, 8)
              .map((p) => (
                <div
                  key={p.pickNumber}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-card"
                >
                  <span className="w-6 shrink-0 text-right font-display text-lg text-muted-foreground tabular-nums">
                    {p.pickNumber}
                  </span>
                  <PlayerPhoto
                    src={p.jugador.photoUrl}
                    alt={p.jugador.nombre}
                    offsetY={0.16}
                    fallback={p.jugador.nombre.slice(0, 2).toUpperCase()}
                    className="size-12 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl tracking-wide">
                      {p.jugador.nombre.toUpperCase()}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {POSITION_SHORT[p.jugador.position]} → {p.teamName}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {/* Cómo va cada equipo */}
      <section className="mt-8">
        <h2 className="font-display text-2xl tracking-wide">LOS EQUIPOS</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {equipos.map((e) => (
            <Card key={e.teamId} className="bg-card shadow-card ring-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2">
                  <TeamCrest
                    name={e.name}
                    color={e.color}
                    crestUrl={e.crestUrl}
                    className="size-7 shrink-0"
                  />
                  <p className="min-w-0 flex-1 truncate font-display text-lg tracking-wide">
                    {e.name.toUpperCase()}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {e.jugadores}
                  </span>
                </div>
                {!e.participates ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No participa en el sorteo: se queda con su nómina.
                  </p>
                ) : e.elegidos.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Todavía no ha elegido.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-0.5">
                    {e.elegidos.map((j) => (
                      <li key={j.id} className="truncate text-sm">
                        {j.nombre}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* El bombo */}
      {disponibles.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl tracking-wide">
            QUEDAN EN EL BOMBO ({disponibles.length})
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {disponibles.map((j) => (
              <span
                key={j.id}
                className="rounded-full bg-surface-2 px-3 py-1 text-sm"
              >
                {j.nombre}
                {j.pot ? (
                  <span className="ml-1.5 text-[11px] text-muted-foreground">
                    {String.fromCharCode(64 + j.pot)}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
