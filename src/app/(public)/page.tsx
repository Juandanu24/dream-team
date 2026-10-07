import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  Medal,
  RefreshCw,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InteractiveBall } from "@/components/interactive-ball";
import { getActiveTournamentName } from "@/lib/data";
import { TorneoUno } from "./torneo-uno";

// Nada de esto depende de cuántos equipos entren. Lo que sí dependía
// —"4 equipos", el calendario de cinco semanas, los cruces 1 vs 2— era
// del primer torneo y salió de acá: el formato del segundo se define
// cuando cierren las inscripciones.
const stats = [
  {
    icon: Zap,
    title: "Fútbol 9",
    detail: "8 en cancha + arquero fijo por equipo",
  },
  {
    icon: Users,
    title: "Equipos parejos",
    detail: "Los sortea la organización, nadie arma el suyo",
  },
  {
    icon: RefreshCw,
    title: "Rotación",
    detail: "Todos juegan, todos suman",
  },
  {
    icon: Medal,
    title: "Premios",
    detail: "Para los primeros puestos",
  },
];

// Los tres pasos son los mismos con cuatro equipos o con ocho. Antes
// acá vivía el formato del torneo (fases, semifinales, en qué semana
// iba cada una) y el calendario con los cruces ya escritos: eso solo
// se puede decir cuando ya se sabe cuántos equipos hay.
const howItWorks = [
  {
    icon: UserPlus,
    title: "Te inscribes",
    detail:
      "Llenas tus datos, subes tu foto y el comprobante de pago. Vale $12.000.",
  },
  {
    icon: Users,
    // Que los equipos se sortean ya lo dice la tarjeta de arriba; acá
    // el paso cuenta qué te pasa a ti, no cómo se arma el torneo.
    title: "Te toca equipo",
    detail:
      "Cuando aprueben tu inscripción entras al sorteo y sabes en qué equipo quedaste.",
  },
  {
    icon: Trophy,
    title: "A jugar",
    detail:
      "Tabla, goleadores, alineaciones y las cartas de cada jugador quedan en la web.",
  },
];

export default async function HomePage() {
  const nombreDelTorneo = await getActiveTournamentName();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Balones flotando, como en el flyer. Se pueden patear 👟 */}
        <div className="animate-float absolute top-14 -right-8 size-28 text-volt-text/50 drop-shadow-[0_0_18px_rgba(204,255,0,0.25)] motion-reduce:animate-none sm:top-20 sm:right-6 sm:size-44 lg:right-24">
          <InteractiveBall className="size-full" spinSeconds={26} />
        </div>
        <div className="animate-float absolute bottom-8 -left-10 size-24 text-volt-text/20 [animation-delay:-2.5s] motion-reduce:animate-none sm:left-4 sm:size-32">
          <InteractiveBall className="size-full" spinSeconds={34} reverse />
        </div>
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-20 pb-16 text-center sm:pt-28">
          {nombreDelTorneo ? (
            <span className="clip-angled bg-primary px-4 py-1.5 font-display text-lg tracking-widest text-primary-foreground">
              {nombreDelTorneo.toUpperCase()}
            </span>
          ) : null}
          <h1 className="mt-6 font-display text-7xl leading-none tracking-wide sm:text-9xl">
            DREAM
            <span className="block -skew-x-6 text-volt-text drop-shadow-[0_0_35px_rgba(204,255,0,0.35)]">
              TEAM
            </span>
          </h1>
          <p className="mt-6 font-display text-2xl tracking-widest text-foreground/90 sm:text-3xl">
            UN TORNEO. UN EQUIPO. <span className="text-volt-text">UN SUEÑO.</span>
          </p>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Ven a ser parte del mejor torneo: fútbol 9 —8 en cancha más arquero
            fijo— todos los martes y jueves en Montería.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="h-12 rounded-full px-7 text-base font-semibold" asChild>
              <Link href="/inscripcion">Inscríbete ahora</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 rounded-full px-7 text-base font-semibold" asChild>
              <Link href="/torneo">Ver el torneo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* El torneo pasado, contado para quien llega nuevo */}
      <TorneoUno />

      {/* Datos rápidos */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="bg-card shadow-card ring-0">
              <CardContent className="flex flex-col items-center gap-2 px-4 py-2 text-center">
                <stat.icon className="size-7 text-volt-text" aria-hidden />
                <p className="font-display text-2xl tracking-wide">{stat.title}</p>
                <p className="text-sm text-muted-foreground">{stat.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Cómo funciona + cuándo se juega */}
      <section className="border-y border-border/60 bg-background/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="font-display text-4xl tracking-wide sm:text-5xl">
              CÓMO <span className="text-volt-text">FUNCIONA</span>
            </h2>
            <div className="mt-6 space-y-3">
              {howItWorks.map((item, i) => (
                <Card key={item.title} className="bg-card py-4 shadow-card ring-0">
                  <CardContent className="flex items-start gap-4 px-5">
                    <span className="font-display text-4xl leading-none text-volt-text/40">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="flex items-center gap-2 font-display text-2xl tracking-wide">
                        <item.icon className="size-5 text-volt-text" aria-hidden />
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Decir el formato antes de tiempo es prometer algo que
                todavía no se sabe: con cuatro equipos no es el mismo
                torneo que con ocho. */}
            <Card className="mt-3 bg-accent py-4 ring-0">
              <CardContent className="flex items-start gap-3 px-5">
                <CalendarDays className="mt-0.5 size-5 shrink-0 text-dt-blue" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground">
                    El formato se define cuando cierren las inscripciones
                  </span>
                  , según cuántos equipos entren: cuántas fechas, cómo se
                  clasifica y los cruces. El calendario sale en{" "}
                  <Link
                    href="/torneo?tab=calendario"
                    className="text-dt-blue underline-offset-4 hover:underline"
                  >
                    la página del torneo
                  </Link>{" "}
                  apenas se sorteen los equipos.
                </p>
              </CardContent>
            </Card>
          </div>

          <aside>
            {/* Mismo tamaño y mismo margen que el título de la izquierda:
                con escalas distintas las dos columnas arrancaban a
                alturas diferentes y se veía desnivelado. */}
            <h2 className="font-display text-4xl tracking-wide sm:text-5xl">
              ¿CUÁNDO<span className="text-dt-blue">?</span>
            </h2>
            <div className="mt-6 space-y-3">
            <Card className="bg-card shadow-card ring-0">
              <CardContent className="space-y-4 px-5 py-2">
                <div className="flex items-center gap-3">
                  <Clock className="size-6 shrink-0 text-dt-blue" aria-hidden />
                  <div>
                    <p className="font-display text-2xl tracking-wide">MARTES</p>
                    <p className="text-sm text-muted-foreground">8:00 PM</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="size-6 shrink-0 text-dt-blue" aria-hidden />
                  <div>
                    <p className="font-display text-2xl tracking-wide">JUEVES</p>
                    <p className="text-sm text-muted-foreground">9:00 PM</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="size-6 shrink-0 text-dt-blue" aria-hidden />
                  <div>
                    <p className="font-display text-2xl tracking-wide">CANCHA F8</p>
                    <p className="text-sm text-muted-foreground">Montería</p>
                  </div>
                </div>
                {/* Los horarios son los de siempre del grupo, no el
                    fixture: en el torneo pasado hubo semanas con los dos
                    partidos el mismo jueves. */}
                <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  Son los horarios de siempre. El día exacto de cada partido
                  se confirma con el calendario.
                </p>
              </CardContent>
            </Card>
              <p className="text-center font-display text-xl tracking-widest text-muted-foreground">
                PASIÓN, AMISTAD Y{" "}
                <span className="text-volt-text">BUEN FÚTBOL</span>
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center">
          <h2 className="font-display text-4xl tracking-wide sm:text-6xl">
            SUMA TU NOMBRE A TU EQUIPO
            <span className="block -skew-x-6 text-volt-text">¡Y VAMOS POR TODO!</span>
          </h2>
          <Button size="lg" className="h-12 rounded-full px-7 text-base font-semibold" asChild>
            <Link href="/inscripcion">Quiero jugar</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
