import type { TournamentStatus } from "@/lib/types";

const ESTADO: Record<TournamentStatus, { label: string; punto: string }> = {
  registration: { label: "Inscripciones abiertas", punto: "bg-volt" },
  in_progress: { label: "En juego", punto: "bg-dt-blue" },
  finished: { label: "Finalizado", punto: "bg-muted-foreground" },
};

/** Qué torneo estás tocando, siempre a la vista en la barra lateral.
 *
 *  No es decoración: el admin escribe sobre el torneo que marque
 *  `NEXT_PUBLIC_TOURNAMENT_SLUG`, y ese dato no se ve en ninguna
 *  pantalla. Ya hubo una confusión por no saber cuál estaba activo. */
export function AdminTournamentBadge({
  nombre,
  status,
}: {
  nombre: string | null;
  status: TournamentStatus;
}) {
  const estado = ESTADO[status];

  return (
    <div className="border-b border-border/60 px-4 py-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
        Estás editando
      </p>
      <p className="mt-0.5 font-display text-lg leading-tight tracking-wide">
        {nombre ? nombre.toUpperCase() : "TORNEO SIN NOMBRE"}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={`size-1.5 shrink-0 rounded-full ${estado.punto}`} aria-hidden />
        {estado.label}
      </p>
    </div>
  );
}
