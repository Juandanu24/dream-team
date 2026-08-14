// El color del equipo lo eligen los admins y puede ser cualquiera —
// incluido el negro. Sobre el fondo oscuro de la carta eso sería
// invisible, así que aclaramos los colores muy oscuros hasta que se
// vean, conservando su tono (negro → plateado, azul marino → azul).

const VOLT = "#ccff00";

function parse(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function toHex(value: number) {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, "0");
}

/** Color del equipo listo para usarse como acento sobre fondo oscuro. */
export function readableAccent(color?: string | null): string {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return VOLT;

  const rgb = parse(color);
  const lum = luminance(rgb);
  const TARGET = 0.45;
  if (lum >= TARGET) return color;

  // Mezcla con blanco lo justo para alcanzar el objetivo.
  const t = (TARGET - lum) / (1 - lum);
  return `#${toHex(rgb.r + (255 - rgb.r) * t)}${toHex(rgb.g + (255 - rgb.g) * t)}${toHex(rgb.b + (255 - rgb.b) * t)}`;
}

/** Versión con transparencia, para degradados y bordes suaves. */
export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${toHex(alpha * 255)}`;
}
