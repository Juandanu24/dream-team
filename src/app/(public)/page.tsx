import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  Medal,
  RefreshCw,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  {
    icon: Users,
    title: "4 equipos",
    detail: "Plantillas parejas, sorteadas por la organización",
  },
  {
    icon: Zap,
    title: "Fútbol 9",
    detail: "8 en cancha + arquero fijo por equipo",
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

const format = [
  {
    icon: Users,
    title: "Fase de grupos",
    detail: "Todos contra todos. Cada equipo juega 3 partidos en 3 semanas.",
  },
  {
    icon: Trophy,
    title: "Semifinales",
    detail: "1º vs 4º y 2º vs 3º de la tabla. Semana 4.",
  },
  {
    icon: Medal,
    title: "Finales",
    detail: "Partido por el 3º puesto y la Gran Final. Semana 5.",
  },
];

const calendar = [
  { week: "Semana 1", tuesday: "1 vs 2", thursday: "3 vs 4" },
  { week: "Semana 2", tuesday: "1 vs 3", thursday: "2 vs 4" },
  { week: "Semana 3", tuesday: "1 vs 4", thursday: "2 vs 3" },
  {
    week: "Semana 4",
    tuesday: "Semifinal 1 (1º vs 4º)",
    thursday: "Semifinal 2 (2º vs 3º)",
  },
  { week: "Semana 5", tuesday: "3º y 4º puesto", thursday: "GRAN FINAL" },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-20 pb-16 text-center sm:pt-28">
          <span className="clip-angled bg-primary px-4 py-1.5 font-display text-lg tracking-widest text-primary-foreground">
            TORNEO RELÁMPAGO
          </span>
          <h1 className="mt-6 font-display text-7xl leading-none tracking-wide sm:text-9xl">
            DREAM
            <span className="block -skew-x-6 text-volt drop-shadow-[0_0_35px_rgba(204,255,0,0.35)]">
              TEAM
            </span>
          </h1>
          <p className="mt-6 font-display text-2xl tracking-widest text-foreground/90 sm:text-3xl">
            UN TORNEO. UN EQUIPO. <span className="text-volt">UN SUEÑO.</span>
          </p>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Ven a ser parte del mejor torneo: fútbol 9 —8 en cancha más arquero
            fijo— todos los martes y jueves en Montería.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="font-display text-xl tracking-wide" asChild>
              <Link href="/inscripcion">INSCRÍBETE AHORA</Link>
            </Button>
            <Button size="lg" variant="outline" className="font-display text-xl tracking-wide" asChild>
              <Link href="/torneo">VER EL TORNEO</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Datos rápidos */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="border-border/60 bg-card/70">
              <CardContent className="flex flex-col items-center gap-2 px-4 py-2 text-center">
                <stat.icon className="size-7 text-volt" aria-hidden />
                <p className="font-display text-2xl tracking-wide">{stat.title}</p>
                <p className="text-sm text-muted-foreground">{stat.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Formato */}
      <section className="border-y border-border/60 bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-4xl tracking-wide sm:text-5xl">
            FORMATO DEL <span className="text-volt">TORNEO</span>
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {format.map((item, i) => (
              <Card key={item.title} className="border-border/60 bg-card/70">
                <CardContent className="px-5 py-2">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-4xl text-volt/40">
                      {i + 1}
                    </span>
                    <item.icon className="size-6 text-volt" aria-hidden />
                    <h3 className="font-display text-2xl tracking-wide">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.detail}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Todos los equipos juegan <span className="text-volt">5 partidos</span>:
            3 de fase de grupos, semifinal y final o partido por el puesto.
          </p>
        </div>
      </section>

      {/* Calendario + Cuándo */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="flex items-center gap-3 font-display text-4xl tracking-wide sm:text-5xl">
            <CalendarDays className="size-8 text-volt" aria-hidden />
            CALENDARIO
          </h2>
          <div className="mt-8 space-y-3">
            {calendar.map((row) => (
              <Card key={row.week} className="border-border/60 bg-card/70 py-4">
                <CardContent className="flex flex-col gap-2 px-5 sm:flex-row sm:items-center">
                  <p className="w-32 shrink-0 font-display text-xl tracking-wide text-volt">
                    {row.week}
                  </p>
                  <div className="flex flex-1 flex-col gap-1 text-sm sm:flex-row sm:gap-6">
                    <p>
                      <span className="text-muted-foreground">MAR:</span>{" "}
                      {row.tuesday}
                    </p>
                    <p>
                      <span className="text-muted-foreground">JUE:</span>{" "}
                      <span className={row.thursday === "GRAN FINAL" ? "font-semibold text-volt" : undefined}>
                        {row.thursday}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Los cruces de la fase de grupos se definen cuando se sorteen los
            equipos. Resultados y tabla en vivo en{" "}
            <Link href="/torneo" className="text-volt underline-offset-4 hover:underline">
              la página del torneo
            </Link>
            .
          </p>
        </div>

        <aside className="space-y-3">
          <h2 className="font-display text-4xl tracking-wide">
            ¿CUÁNDO<span className="text-volt">?</span>
          </h2>
          <Card className="border-volt/40 bg-card/70">
            <CardContent className="space-y-4 px-5 py-2">
              <div className="flex items-center gap-3">
                <Clock className="size-6 shrink-0 text-volt" aria-hidden />
                <div>
                  <p className="font-display text-2xl tracking-wide">MARTES</p>
                  <p className="text-sm text-muted-foreground">8:00 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="size-6 shrink-0 text-volt" aria-hidden />
                <div>
                  <p className="font-display text-2xl tracking-wide">JUEVES</p>
                  <p className="text-sm text-muted-foreground">9:00 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="size-6 shrink-0 text-volt" aria-hidden />
                <div>
                  <p className="font-display text-2xl tracking-wide">CANCHA F8</p>
                  <p className="text-sm text-muted-foreground">
                    Montería · 1 hora por día
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="text-center font-display text-xl tracking-widest text-muted-foreground">
            PASIÓN, AMISTAD Y <span className="text-volt">BUEN FÚTBOL</span>
          </p>
        </aside>
      </section>

      {/* CTA final */}
      <section className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center">
          <h2 className="font-display text-4xl tracking-wide sm:text-6xl">
            SUMA TU NOMBRE A TU EQUIPO
            <span className="block -skew-x-6 text-volt">¡Y VAMOS POR TODO!</span>
          </h2>
          <Button size="lg" className="font-display text-xl tracking-wide" asChild>
            <Link href="/inscripcion">QUIERO JUGAR</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
