import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InteractiveBall } from "@/components/interactive-ball";
import { getTournamentStatus } from "@/lib/data";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: "Inscripción",
};

export const dynamic = "force-dynamic";

export default async function RegistrationPage() {
  const status = await getTournamentStatus();
  const open = status === "registration";

  return (
    <div className="relative mx-auto max-w-4xl overflow-hidden px-4 py-12">
      <div className="animate-float pointer-events-none absolute -top-6 -right-10 size-32 text-volt/15 motion-reduce:animate-none sm:right-0 sm:size-40">
        <InteractiveBall className="pointer-events-auto size-full" spinSeconds={30} />
      </div>
      <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
        SUMA TU <span className="text-volt">NOMBRE</span>
      </h1>

      {open ? (
        <>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Llena tus datos como si fuera tu carta de FIFA: la vas a ver armarse
            en vivo. Cuando los organizadores aprueben tu inscripción, quedas
            oficial en el torneo.
          </p>
          <div className="mt-10">
            <RegistrationForm />
          </div>
        </>
      ) : (
        <Card className="mt-8 border-border/60 bg-card/70">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <Lock className="size-10 text-volt" aria-hidden />
            <div>
              <h2 className="font-display text-3xl tracking-wide">
                INSCRIPCIONES CERRADAS
              </h2>
              <p className="mt-2 max-w-md text-muted-foreground">
                {status === "finished"
                  ? "Este torneo ya terminó. Atento al grupo: viene el próximo 👀"
                  : "Los cupos ya se llenaron y el torneo arrancó. Atento al grupo para el próximo."}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/torneo">Ver el torneo</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/penales">Reto de penales</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
