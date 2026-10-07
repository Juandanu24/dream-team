import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { TeamCrest } from "@/components/team-crest";
import { AWARD_LABELS, getHistory } from "@/lib/history";
import { readableAccent } from "@/lib/team-color";

export const metadata: Metadata = {
  title: "Palmarés",
  description:
    "Los campeones y los premios de cada torneo del Dream Team, torneo por torneo.",
};

// Dinámica a propósito: los datos están cacheados, pero prerenderizar
// guardaría el estado vacío del build sin credenciales de Supabase.
export const dynamic = "force-dynamic";

const MEDALLAS = ["🥇", "🥈", "🥉", "4️⃣"];

export default async function HistoriaPage() {
  const torneos = await getHistory();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
        PAL<span className="text-volt-text">MARÉS</span>
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        Todo lo que ha pasado en el Dream Team, torneo por torneo. Acá quedan
        los que levantaron la copa.
      </p>

      {torneos.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Todavía no hay torneos terminados. Cuando se cierre el primero,
          aparece acá.
        </p>
      ) : (
        <div className="mt-10 space-y-10">
          {torneos.map((torneo) => {
            const acento = readableAccent(torneo.champion?.color);
            return (
              <section key={torneo.slug}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-display text-3xl tracking-wide">
                    {torneo.name.toUpperCase()}
                  </h2>
                  <Link
                    href={`/torneos/${torneo.slug}`}
                    className="flex items-center gap-1 text-xs text-dt-blue underline-offset-4 hover:underline"
                  >
                    Ver tabla y calendario <ArrowRight className="size-3" aria-hidden />
                  </Link>
                </div>

                {/* El campeón, grande: es lo que la gente viene a ver */}
                {torneo.champion ? (
                  <Card
                    className="mt-4 overflow-hidden border-border/60 py-0"
                    style={{
                      background: `linear-gradient(135deg, ${acento}22, transparent 60%)`,
                    }}
                  >
                    <CardContent className="flex flex-wrap items-center gap-4 p-5">
                      <TeamCrest
                        name={torneo.champion.teamName}
                        crestUrl={torneo.champion.crestUrl}
                        color={torneo.champion.color}
                        className="size-20 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-xs tracking-widest text-volt-text uppercase">
                          <Trophy className="size-3.5" aria-hidden /> Campeón
                        </p>
                        <p className="font-display text-3xl tracking-wide sm:text-4xl">
                          {torneo.champion.teamName.toUpperCase()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {torneo.podium.length > 1 ? (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {torneo.podium.slice(1).map((fila, i) => (
                      <li
                        key={fila.teamName}
                        className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                      >
                        <span aria-hidden>{MEDALLAS[i + 1]}</span>
                        <TeamCrest
                          name={fila.teamName}
                          crestUrl={fila.crestUrl}
                          color={fila.color}
                          className="size-7 shrink-0"
                        />
                        <span className="truncate font-medium">{fila.teamName}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {fila.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {torneo.awards.length > 0 ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {torneo.awards.map((premio) => (
                      <Card
                        key={premio.kind}
                        className="border-border/60 bg-card/70 py-0"
                      >
                        <CardContent className="flex items-center gap-3 p-4">
                          <Avatar className="size-12 shrink-0">
                            <AvatarImage src={premio.photoUrl ?? undefined} alt="" />
                            <AvatarFallback>
                              {premio.playerName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[11px] tracking-widest text-dt-blue uppercase">
                              {AWARD_LABELS[premio.kind]}
                            </p>
                            <Link
                              href={`/jugador/${premio.playerId}`}
                              className="block truncate font-display text-xl tracking-wide underline-offset-4 hover:underline"
                            >
                              {premio.playerName.toUpperCase()}
                            </Link>
                            {premio.detail ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {premio.detail}
                              </p>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
