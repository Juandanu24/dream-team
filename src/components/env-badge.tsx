import { ACTIVE_TOURNAMENT_SLUG, TORNEO_DE_PRUEBA } from "@/lib/types";

/** Aviso de "no estás en producción", con el torneo al que apunta.
 *
 *  La condición es el entorno, no el slug. Antes comparaba contra el
 *  slug del torneo real escrito a mano (`relampago-2026`), y eso falla
 *  en los dos sentidos: al arrancar el segundo torneo el sitio público
 *  se rotuló solo como entorno de prueba —lo vieron los visitantes—, y
 *  al revés, correr en local contra el torneo REAL no mostraba nada,
 *  que es justo el caso peligroso: con el slug real el admin escribe en
 *  producción. Con `NODE_ENV` no hay nada que actualizar al cambiar de
 *  torneo y el sitio desplegado no puede volver a rotularse mal. */
export function EnvBadge() {
  if (process.env.NODE_ENV === "production") return null;

  const esPrueba = ACTIVE_TOURNAMENT_SLUG === TORNEO_DE_PRUEBA;

  return (
    <span
      className={
        esPrueba
          ? "rounded-sm border border-amber-500/60 bg-amber-500/15 px-1.5 py-0.5 font-display text-xs tracking-widest text-amber-500 uppercase"
          : "rounded-sm border border-destructive/60 bg-destructive/15 px-1.5 py-0.5 font-display text-xs tracking-widest text-destructive uppercase"
      }
      title={
        esPrueba
          ? `Torneo de prueba: ${ACTIVE_TOURNAMENT_SLUG}. No toca datos reales.`
          : `Estás en local pero apuntando a ${ACTIVE_TOURNAMENT_SLUG}: lo que guardes acá se va a producción.`
      }
    >
      {esPrueba ? "Prueba" : "Datos reales"}
    </span>
  );
}
