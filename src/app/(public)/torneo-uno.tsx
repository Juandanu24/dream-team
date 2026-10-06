import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/count-up";
import { PlayerPhoto } from "@/components/player-photo";
import { TeamCrest } from "@/components/team-crest";
import { AWARD_LABELS, getHistory, type PathStep } from "@/lib/history";
import { readableAccent } from "@/lib/team-color";
import { cn } from "@/lib/utils";

/** El torneo pasado, contado en el home.
 *
 *  Va a entrar gente nueva por el torneo que viene y lo primero que
 *  ve no puede ser una web sin memoria: que esto ya se jugó una vez,
 *  que tuvo campeón y que hubo premios es justo lo que da ganas de
 *  inscribirse. El recorrido que busca la sección es: llega un
 *  desconocido → ve que es serio → se inscribe.
 *
 *  Es un componente de servidor dentro de una página ESTÁTICA, y eso
 *  es a propósito. El torneo 1 está `finished`: su campeón, su podio y
 *  sus premios ya no pueden cambiar, así que no hay nada que se quede
 *  viejo. El home se sirve desde el CDN en 3 ms sin invocar función, y
 *  el visitante que estamos optimizando es el que llega de Instagram
 *  con datos móviles. El riesgo —que el build hornee el estado vacío,
 *  como pasó cuando una migración cerró el torneo DESPUÉS de compilar—
 *  lo cubre el `revalidate: 3600` de `getHistory()`, que la página
 *  hereda: se autocura en una hora sin redeploy. Si aun así no hay
 *  datos, la sección no se dibuja y el home queda como estaba.
 *
 *  Lo "dinámico" va en el cliente y en CSS —contadores que suben,
 *  entrada por scroll— no en más consultas. */
export async function TorneoUno() {
  const torneos = await getHistory();
  const ultimo = torneos.find((t) => t.champion);
  if (!ultimo?.champion) return null;

  const campeon = ultimo.champion;
  const acento = readableAccent(campeon.color);
  const { stats, championPath, awards } = ultimo;

  // Cuántos partidos perdió de arranque. Si empezó perdiendo, eso ES la
  // historia y se cuenta sola; escribirla a mano la dejaría mintiendo
  // con el próximo campeón.
  let arranqueEnDerrota = 0;
  for (const paso of championPath) {
    if (paso.result !== "loss") break;
    arranqueEnDerrota += 1;
  }
  const historiaDelCamino =
    arranqueEnDerrota > 0
      ? `${
          arranqueEnDerrota === 1
            ? "Perdió su primer partido"
            : `Perdió sus primeros ${arranqueEnDerrota} partidos`
        }. Levantó la copa.`
      : `${championPath.length} partidos hasta levantar la copa.`;

  // Sin "equipos" a propósito: el home ya dice "4 equipos" en Datos
  // rápidos, pero ahí es el plan del torneo NUEVO. El mismo número en
  // dos secciones vecinas hace dudar de cuál habla cada una, y es
  // justo la cifra que menos cuenta —los equipos se ven en el camino.
  const cifras = [
    { valor: stats.players, rotulo: "jugadores" },
    { valor: stats.matches, rotulo: "partidos" },
    { valor: stats.goals, rotulo: "goles" },
  ].filter((c) => c.valor > 0);

  return (
    <section className="border-y border-border/60 bg-background/40">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-xs tracking-widest text-dt-blue uppercase">
              Ya pasó una vez
            </p>
            <h2 className="font-display text-4xl tracking-wide sm:text-5xl">
              ASÍ FUE EL <span className="text-dt-blue">PRIMER TORNEO</span>
            </h2>
          </div>
          <Link
            href="/historia"
            className="group flex items-center gap-1 text-sm text-dt-blue underline-offset-4 hover:underline"
          >
            Ver el palmarés completo
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>

        {/* El campeón, a todo lo ancho: es lo que la gente viene a ver.
            Centrado y no a la izquierda porque en una banda ancha un
            bloque pegado al borde deja medio cartel vacío. */}
        <Link
          href="/historia"
          className="animate-reveal group mt-8 flex flex-col items-center gap-3 overflow-hidden rounded-xl border px-6 py-10 text-center transition-colors"
          style={{
            borderColor: `${acento}55`,
            background: `radial-gradient(ellipse at 50% 120%, ${acento}2e, transparent 70%)`,
          }}
        >
          <TeamCrest
            name={campeon.teamName}
            crestUrl={campeon.crestUrl}
            color={campeon.color}
            className="size-24 drop-shadow-lg transition-transform duration-300 group-hover:scale-105 sm:size-28"
          />
          <p className="flex items-center gap-1.5 text-xs tracking-widest text-volt uppercase">
            <Trophy className="size-3.5" aria-hidden /> Campeón
          </p>
          {/* El color del equipo solo en oscuro. `readableAccent` aclara
              los colores apagados para que se vean sobre el negro, pero
              no resuelve el problema contrario: el amarillo de Los
              Irreverentes sobre el hueso del tema claro no se lee. Ahí
              manda el color de texto normal y la identidad del equipo la
              cargan el escudo, el borde y el degradado. */}
          <p
            className="font-display text-4xl leading-none tracking-wide sm:text-7xl dark:text-[var(--acento-equipo)]"
            style={{ "--acento-equipo": acento } as React.CSSProperties}
          >
            {campeon.teamName.toUpperCase()}
          </p>
          <p className="text-sm text-muted-foreground">{ultimo.name}</p>
        </Link>

        {/* Las cifras, subiendo al entrar en pantalla */}
        <div className="animate-reveal mt-3 grid grid-cols-3 gap-3">
          {cifras.map((cifra, i) => (
            <div
              key={cifra.rotulo}
              className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card/70 px-3 py-6"
            >
              <CountUp
                to={cifra.valor}
                delay={i * 110}
                className="font-display text-5xl leading-none tracking-wide text-dt-blue tabular-nums sm:text-6xl"
              />
              <p className="mt-1.5 text-xs tracking-widest text-muted-foreground uppercase">
                {cifra.rotulo}
              </p>
            </div>
          ))}
        </div>

        {/* El camino del campeón: la historia contada con resultados */}
        {championPath.length > 1 ? (
          <div className="animate-reveal mt-10">
            <h3 className="font-display text-2xl tracking-wide">
              EL CAMINO DEL{" "}
              <span
                className="text-dt-blue dark:text-[var(--acento-equipo)]"
                style={{ "--acento-equipo": acento } as React.CSSProperties}
              >
                CAMPEÓN
              </span>
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {historiaDelCamino}
            </p>
            {/* Apilado en celular y en fila a partir de sm. En el carril
                horizontal angosto solo entraban dos partidos y medio, y
                lo que quedaba escondido era justo el remate: la final.
                Una lista vertical cuenta la historia completa sin que
                nadie tenga que descubrir que ahí se desliza. */}
            <ol className="scrollbar-none mt-4 flex flex-col gap-2 sm:flex-row sm:overflow-x-auto sm:pb-1">
              {championPath.map((paso, i) => (
                <PasoDelCamino key={i} paso={paso} acento={acento} />
              ))}
            </ol>
          </div>
        ) : null}

        {/* Los premiados, con la foto encuadrada como ellos la ajustaron */}
        {awards.length > 0 ? (
          <div className="animate-reveal mt-10 grid gap-3 sm:grid-cols-3">
            {awards.map((premio) => (
              <Link
                key={premio.kind}
                href={`/jugador/${premio.playerId}`}
                className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card/70 p-4 transition-colors hover:border-dt-blue/50"
              >
                <PlayerPhoto
                  src={premio.photoUrl}
                  alt={premio.playerName}
                  zoom={premio.photoZoom}
                  offsetX={premio.photoOffsetX}
                  // Sin ajuste guardado, un pelín arriba: es el mismo
                  // arranque de la pieza de perfil (ENCUADRE_PERFIL) y
                  // en una foto de cuerpo entero la cara está arriba.
                  offsetY={premio.photoOffsetY ?? 0.16}
                  fallback={premio.playerName.slice(0, 2).toUpperCase()}
                  className="size-24 shrink-0 rounded-lg ring-1 ring-border/60"
                />
                <div className="min-w-0">
                  <p className="text-[11px] tracking-widest text-dt-blue uppercase">
                    {AWARD_LABELS[premio.kind]}
                  </p>
                  <p className="truncate font-display text-2xl tracking-wide underline-offset-4 group-hover:underline">
                    {premio.playerName.toUpperCase()}
                  </p>
                  {premio.detail ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {premio.detail}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        {/* Y de la nostalgia al presente: el que sigue está abierto */}
        <div className="animate-reveal mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-volt/40 bg-volt/5 p-6">
          <p className="font-display text-2xl tracking-wide sm:text-3xl">
            AHORA VA EL SEGUNDO.
            <span className="block text-volt sm:inline sm:ps-2">
              ¿TE LO VAS A PERDER?
            </span>
          </p>
          <Button
            size="lg"
            className="font-display text-xl tracking-wide"
            asChild
          >
            <Link href="/inscripcion">QUIERO JUGAR</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Un partido del camino, como chip. El marcador es el dato; el color
 *  del borde dice si ganó o perdió sin tener que leerlo. */
function PasoDelCamino({ paso, acento }: { paso: PathStep; acento: string }) {
  const porPenales = paso.penaltiesFor != null && paso.penaltiesAgainst != null;
  const gano = paso.result === "win";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 sm:min-w-[8.5rem] sm:flex-col sm:items-start sm:gap-1.5",
        paso.isFinal
          ? "bg-card"
          : gano
            ? "border-border/60 bg-card/70"
            : "border-border/40 bg-card/40",
      )}
      style={paso.isFinal ? { borderColor: `${acento}88` } : undefined}
    >
      <p className="flex w-[5.5rem] shrink-0 items-center gap-1 text-[10px] tracking-widest text-muted-foreground uppercase sm:w-auto">
        {paso.isFinal ? (
          <Trophy className="size-3 text-volt" aria-hidden />
        ) : null}
        {paso.label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-display text-3xl leading-none tracking-wide tabular-nums",
            gano ? "text-dt-blue" : "text-muted-foreground",
          )}
        >
          {paso.goalsFor}-{paso.goalsAgainst}
        </span>
        {porPenales ? (
          <span className="text-[10px] text-muted-foreground">
            ({paso.penaltiesFor}-{paso.penaltiesAgainst} pen)
          </span>
        ) : null}
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:ml-0">
        <TeamCrest
          name={paso.rivalName}
          crestUrl={paso.rivalCrest}
          color={paso.rivalColor}
          className="size-4 shrink-0"
        />
        <span className="truncate text-[11px] text-muted-foreground">
          {paso.rivalName}
        </span>
      </div>
    </li>
  );
}
