"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import type { TournamentListItem } from "@/lib/tournaments";

/** Saltar de un torneo a otro desde la misma pantalla.
 *
 *  Hasta ahora había que saber que `/torneos/<slug>` existía. Con dos
 *  torneos ya se nota; con el tercero sería inencontrable.
 *
 *  El activo va a `/torneo` y no a `/torneos/<su-slug>`: son la misma
 *  pantalla, pero `/torneo` es la URL que se comparte y la que no se
 *  rompe cuando el torneo activo cambie. */
export function TournamentSwitcher({
  torneos,
  slugActual,
}: {
  torneos: TournamentListItem[];
  slugActual: string;
}) {
  const router = useRouter();
  if (torneos.length < 2) return null;

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Cambiar de torneo</span>
      <select
        value={slugActual}
        onChange={(e) => {
          const destino = torneos.find((t) => t.slug === e.target.value);
          if (!destino) return;
          router.push(destino.activo ? "/torneo" : `/torneos/${destino.slug}`);
        }}
        className="appearance-none rounded-full bg-surface-2 py-2 pr-9 pl-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover"
      >
        {torneos.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
            {t.status === "finished" ? " · finalizado" : ""}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-3 size-4 text-muted-foreground"
        aria-hidden
      />
    </label>
  );
}
