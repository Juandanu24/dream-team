import { cn } from "@/lib/utils";

/** La foto de un jugador respetando el encuadre que él mismo ajustó.
 *
 *  Es la versión HTML de `drawCover()` (`src/lib/post-image.ts`) y usa
 *  la misma convención: zoom 1 = la foto justo cubre el marco, y x/y
 *  van de −1 a 1 medidos sobre LO QUE SOBRA, no en píxeles. Hasta hoy
 *  el encuadre solo servía en las piezas de canvas; las fotos en la web
 *  se recortaban al centro y a quien tenga la cara arriba —Baloco está
 *  en y = 0.66— le quedaba cortada.
 *
 *  Por qué dos cajas y no un simple `object-position`: `object-position`
 *  reparte el sobrante de la foto SIN zoom, así que al acercarla el
 *  ancla se corre y deja de significar lo mismo que en drawCover. La
 *  caja interna mide `zoom` veces el marco —con lo que `object-fit:
 *  cover` dentro de ella da exactamente la foto ya acercada— y se
 *  desplaza `p · (1 − zoom)`, que es la cuenta que vuelve a poner el
 *  ancla donde drawCover la pone. Verificado en los dos extremos
 *  (x = ±1) contra la fórmula del canvas. */
export function PlayerPhoto({
  src,
  alt,
  zoom,
  offsetX = 0,
  offsetY = 0,
  fallback,
  className,
}: {
  src: string | null;
  alt: string;
  zoom?: number | null;
  offsetX?: number | null;
  offsetY?: number | null;
  /** Qué mostrar si el jugador no tiene foto (iniciales, normalmente). */
  fallback?: React.ReactNode;
  className?: string;
}) {
  // Igual que drawCover: nunca por debajo de 1, para no dejar vacíos.
  const z = Math.max(1, zoom ?? 1);
  const px = (1 - (offsetX ?? 0)) / 2;
  const py = (1 - (offsetY ?? 0)) / 2;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="absolute object-cover"
          style={{
            width: `${z * 100}%`,
            height: `${z * 100}%`,
            left: `${px * (1 - z) * 100}%`,
            top: `${py * (1 - z) * 100}%`,
            objectPosition: `${px * 100}% ${py * 100}%`,
          }}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-secondary font-display text-2xl tracking-wide text-muted-foreground">
          {fallback}
        </div>
      )}
    </div>
  );
}
