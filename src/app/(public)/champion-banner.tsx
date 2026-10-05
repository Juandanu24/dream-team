import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { getHistory } from "@/lib/history";
import { readableAccent } from "@/lib/team-color";

/** El campeón vigente en el home.
 *
 *  Van a entrar visitantes nuevos por el torneo que viene, y lo primero
 *  que ven no puede ser una web sin memoria: el torneo pasado tuvo
 *  campeón y eso es lo que da ganas de inscribirse. */
export async function ChampionBanner() {
  const torneos = await getHistory();
  const ultimo = torneos.find((t) => t.champion);
  if (!ultimo?.champion) return null;

  const campeon = ultimo.champion;
  const acento = readableAccent(campeon.color);

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <Link
        href="/historia"
        className="group block overflow-hidden rounded-xl border border-border/60 transition-colors hover:border-volt/50"
        style={{
          background: `linear-gradient(110deg, ${acento}22, transparent 65%)`,
        }}
      >
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <TeamCrest
            name={campeon.teamName}
            crestUrl={campeon.crestUrl}
            color={campeon.color}
            className="size-16 shrink-0 sm:size-20"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs tracking-widest text-volt uppercase">
              <Trophy className="size-3.5" aria-hidden />
              Campeón · {ultimo.name}
            </p>
            <p className="font-display text-3xl tracking-wide sm:text-4xl">
              {campeon.teamName.toUpperCase()}
            </p>
            {ultimo.awards.length > 0 ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {ultimo.awards
                  .map((a) => a.playerName)
                  .slice(0, 3)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-sm text-dt-blue">
            Ver el palmarés
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </Link>
    </section>
  );
}
