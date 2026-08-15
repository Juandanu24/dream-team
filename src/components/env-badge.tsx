const REAL_SLUG = "relampago-2026";

// Aviso visible cuando la app no está apuntando al torneo real, para no
// confundir un entorno de prueba con producción. En Vercel la variable
// va vacía, así que allí nunca aparece.
export function EnvBadge() {
  const slug = process.env.NEXT_PUBLIC_TOURNAMENT_SLUG;
  if (!slug || slug === REAL_SLUG) return null;

  return (
    <span
      className="rounded-sm border border-amber-500/60 bg-amber-500/15 px-1.5 py-0.5 font-display text-xs tracking-widest text-amber-500 uppercase"
      title={`Torneo de prueba: ${slug}. No es el torneo real.`}
    >
      Prueba
    </span>
  );
}
