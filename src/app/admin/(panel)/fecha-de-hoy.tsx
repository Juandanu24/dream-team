import Link from "next/link";
import { AlertTriangle, Check, Circle, PenLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatKickoff } from "@/lib/data";
import type { EstadoPendiente, FechaDeHoy } from "@/lib/admin-pendientes";
import { STAGE_LABELS } from "@/lib/types";

const MARCA: Record<
  EstadoPendiente,
  { icono: typeof Check; clase: string; etiqueta: string }
> = {
  listo: { icono: Check, clase: "text-volt-text", etiqueta: "Listo" },
  borrador: { icono: PenLine, clase: "text-yellow-500", etiqueta: "En borrador" },
  falta: { icono: AlertTriangle, clase: "text-yellow-500", etiqueta: "Falta" },
  neutro: { icono: Circle, clase: "text-muted-foreground/50", etiqueta: "Todavía no" },
};

/** Qué te falta de la fecha más cercana, con el enlace que lo resuelve. */
export function FechaDeHoyCard({ fecha }: { fecha: FechaDeHoy }) {
  const pendientes = fecha.items.filter(
    (i) => i.estado === "falta" || i.estado === "borrador",
  ).length;

  return (
    <Card
      className={
        pendientes > 0
          ? "border border-yellow-500/40 bg-card shadow-card ring-0"
          : "bg-card shadow-card ring-0"
      }
    >
      <CardContent className="px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-2xl tracking-wide">
            SEMANA {fecha.week}
          </p>
          <p className="text-sm text-muted-foreground">
            {pendientes === 0
              ? "Todo al día"
              : `${pendientes} cosa${pendientes === 1 ? "" : "s"} por hacer`}
          </p>
        </div>

        <ul className="mt-2 space-y-0.5">
          {fecha.partidos.map((p) => (
            <li key={p.id} className="text-sm text-muted-foreground">
              <span className="text-foreground">
                {p.local} vs {p.visita}
              </span>{" "}
              · {STAGE_LABELS[p.stage]}
              {p.kickoffAt ? ` · ${formatKickoff(p.kickoffAt)}` : ""}
            </li>
          ))}
        </ul>

        <ul className="mt-4 divide-y divide-separator border-t border-separator">
          {fecha.items.map((item, i) => {
            const marca = MARCA[item.estado];
            return (
              <li key={i}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2.5 py-2.5 text-sm transition-colors hover:text-foreground"
                >
                  <marca.icono
                    className={`size-4 shrink-0 ${marca.clase}`}
                    aria-label={marca.etiqueta}
                  />
                  <span
                    className={
                      item.estado === "listo"
                        ? "text-muted-foreground"
                        : item.estado === "neutro"
                          ? "text-muted-foreground/70"
                          : ""
                    }
                  >
                    {item.texto}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
