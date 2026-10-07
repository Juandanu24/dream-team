import Link from "next/link";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getTournamentList } from "@/lib/tournaments";
import { ACTIVE_TOURNAMENT_SLUG } from "@/lib/types";
import { ESTADO } from "../admin-tournament-badge";

export const dynamic = "force-dynamic";

/** Los torneos que existen y en qué estado está cada uno.
 *
 *  Es de SOLO LECTURA, y la ruta es de lectura por construcción: acá no
 *  se monta ni un formulario. El admin escribe siempre sobre el torneo
 *  que marque `NEXT_PUBLIC_TOURNAMENT_SLUG`, y esa barrera se sostiene
 *  porque las pantallas que editan solo listan filas de ese torneo. Un
 *  selector que cambiara eso haría que varias acciones —las que
 *  resuelven el torneo por slug en vez de por id de fila— escribieran en
 *  el torneo equivocado sin avisar. */
export default async function AdminTournamentsPage() {
  const torneos = await getTournamentList();

  return (
    <div>
      <h1 className="font-display text-4xl tracking-wide">TORNEOS</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Solo lectura. Se edita siempre el torneo activo; para cambiar cuál es,
        hay que mover <code className="text-foreground">NEXT_PUBLIC_TOURNAMENT_SLUG</code>{" "}
        en Vercel y volver a desplegar.
      </p>

      {torneos.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No se pudo leer la lista de torneos.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {torneos.map((t) => {
            const estado = ESTADO[t.status];
            return (
              <Card
                key={t.slug}
                className={
                  t.activo
                    ? "border border-volt/40 bg-card shadow-card ring-0"
                    : "bg-card shadow-card ring-0"
                }
              >
                <CardContent className="px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {t.activo ? (
                          <span className="rounded-full bg-volt px-2 py-0.5 font-display text-[11px] tracking-widest text-volt-ink uppercase">
                            Activo
                          </span>
                        ) : null}
                        {t.esPrueba ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] tracking-widest text-muted-foreground uppercase">
                            <FlaskConical className="size-3" aria-hidden />
                            Pruebas
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 font-display text-2xl tracking-wide">
                        {t.name.toUpperCase()}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${estado.punto}`}
                          aria-hidden
                        />
                        {estado.label}
                        <code className="ml-1">{t.slug}</code>
                      </p>
                    </div>

                    <Link
                      href={t.activo ? "/torneo" : `/torneos/${t.slug}`}
                      className="flex shrink-0 items-center gap-1 text-sm text-dt-blue underline-offset-4 hover:underline"
                    >
                      Ver tabla y calendario
                      <ArrowUpRight className="size-4" aria-hidden />
                    </Link>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-separator sm:grid-cols-4">
                    <Dato rotulo="Equipos" valor={t.equipos} />
                    <Dato
                      rotulo="Aprobados"
                      valor={t.inscritos.aprobados}
                      pie={
                        t.inscritos.pendientes > 0
                          ? `${t.inscritos.pendientes} por revisar`
                          : undefined
                      }
                    />
                    <Dato
                      rotulo="Partidos"
                      valor={`${t.partidos.jugados}/${t.partidos.total}`}
                    />
                    <Dato rotulo="Goles" valor={t.goles} />
                  </dl>
                </CardContent>
              </Card>
            );
          })}

          <p className="pt-2 text-xs text-muted-foreground">
            Hoy el activo es <code className="text-foreground">{ACTIVE_TOURNAMENT_SLUG}</code>.
          </p>
        </div>
      )}
    </div>
  );
}

function Dato({
  rotulo,
  valor,
  pie,
}: {
  rotulo: string;
  valor: number | string;
  pie?: string;
}) {
  return (
    <div className="bg-card px-3 py-3 text-center">
      <dd className="font-display text-2xl leading-none tabular-nums">
        {valor}
      </dd>
      <dt className="mt-1 text-[10px] tracking-widest text-muted-foreground uppercase">
        {rotulo}
      </dt>
      {pie ? (
        <p className="mt-0.5 text-[10px] text-volt-text">{pie}</p>
      ) : null}
    </div>
  );
}
