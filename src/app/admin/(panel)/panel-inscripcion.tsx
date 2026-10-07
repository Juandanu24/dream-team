import Link from "next/link";
import { Bell, Receipt, UserCheck, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PanelDeInscripcion } from "@/lib/admin-pendientes";

/** El tablero de la temporada de inscripciones.
 *
 *  Solo sale mientras el torneo está en `registration`: después no
 *  informa nada y estorba. Responde tres preguntas que hoy no tienen
 *  pantalla —a quién falta perseguir del torneo pasado, cómo van los
 *  pagos y cuánta gente recibe los avisos— y avisa de los aprobados que
 *  se quedaron sin equipo, que en el torneo 1 fue uno todo el torneo. */
export function PanelDeInscripcionCard({
  panel,
}: {
  panel: PanelDeInscripcion;
}) {
  const faltan = panel.delAnterior - panel.vuelven;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {panel.delAnterior > 0 ? (
        <Card className="bg-card shadow-card ring-0">
          <CardContent className="px-5">
            <UserCheck className="size-5 text-volt-text" aria-hidden />
            <p className="mt-3 font-display text-4xl tabular-nums">
              {panel.vuelven}
              <span className="text-xl text-muted-foreground">
                /{panel.delAnterior}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {faltan === 0
                ? `Volvieron todos los de ${panel.nombreAnterior}`
                : `ya volvieron. Faltan ${faltan} del torneo pasado.`}
            </p>
            <Link
              href="/admin/inscripciones"
              className="mt-2 inline-block text-xs text-dt-blue underline-offset-4 hover:underline"
            >
              Ver inscripciones
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-card shadow-card ring-0">
        <CardContent className="px-5">
          <Receipt className="size-5 text-volt-text" aria-hidden />
          <p className="mt-3 font-display text-4xl tabular-nums">
            {panel.pagos.verificados}
          </p>
          <p className="text-sm text-muted-foreground">pagos verificados</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {panel.pagos.porRevisar > 0 ? (
              <span className="text-yellow-500">
                {panel.pagos.porRevisar} por revisar
              </span>
            ) : (
              "Nada por revisar"
            )}
            {" · "}
            {panel.pagos.sinComprobante} sin comprobante
          </p>
          <Link
            href="/admin/inscripciones"
            className="mt-2 inline-block text-xs text-dt-blue underline-offset-4 hover:underline"
          >
            Revisar pagos
          </Link>
        </CardContent>
      </Card>

      <Card className="bg-card shadow-card ring-0">
        <CardContent className="px-5">
          <Bell className="size-5 text-volt-text" aria-hidden />
          <p className="mt-3 font-display text-4xl tabular-nums">
            {panel.suscritosPush}
          </p>
          <p className="text-sm text-muted-foreground">suscritos a push</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Es el canal que llega a todos, al revés de Instagram.
          </p>
        </CardContent>
      </Card>

      {panel.sinEquipo.length > 0 ? (
        <Card className="border border-yellow-500/40 bg-card shadow-card ring-0 lg:col-span-3">
          <CardContent className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 text-sm">
            <UserX className="size-4 shrink-0 text-yellow-500" aria-hidden />
            <span>
              {panel.sinEquipo.length} aprobado
              {panel.sinEquipo.length === 1 ? "" : "s"} sin equipo:
            </span>
            <span className="text-muted-foreground">
              {panel.sinEquipo.join(", ")}
            </span>
            <Link
              href="/admin/equipos"
              className="text-xs text-dt-blue underline-offset-4 hover:underline"
            >
              Asignar
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
