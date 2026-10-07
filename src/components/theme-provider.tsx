"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Por ahora la web va SIEMPRE en oscuro.
 *
 *  El tema claro está construido y probado —tokens, contraste medido y
 *  todo— pero Juan quiere soltar solo el oscuro de momento. `forcedTheme`
 *  lo fija sin desmontar nada: para volver a los dos temas se quita esta
 *  línea y el selector vuelve solo, porque el `ThemeToggle` sigue en su
 *  sitio detrás de TEMA_FIJO. */
export const TEMA_FIJO: string | undefined = "dark";

export function ThemeProvider(
  props: React.ComponentProps<typeof NextThemesProvider>,
) {
  return <NextThemesProvider {...props} forcedTheme={TEMA_FIJO} />;
}
