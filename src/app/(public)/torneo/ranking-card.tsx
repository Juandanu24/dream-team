import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface RankingRow {
  playerId: string;
  name: string;
  photoUrl: string | null;
  teamName: string | null;
  valor: number;
}

/** Un ranking de la pestaña de estadísticas.
 *
 *  Con el torneo en curso todas las filas pesan igual: el que va primero
 *  hoy puede no ir primero el jueves, y coronarlo sería mentir. Cuando el
 *  torneo TERMINA el primero deja de ser "el que va ganando" y pasa a ser
 *  el goleador del torneo, así que ahí sí se destaca: foto grande, nombre
 *  en Bebas y la cifra al tamaño que se merece. */
export function RankingCard({
  titulo,
  tituloLider,
  icono,
  acento,
  sufijo,
  filas,
  vacio,
  coronar,
}: {
  titulo: string;
  /** El rótulo del destacado, en singular: "Goleador del torneo". */
  tituloLider: string;
  icono: React.ReactNode;
  /** "volt" para goles y figuras, "blue" para asistencias. */
  acento: "volt" | "blue";
  /** Qué se cuenta, en singular y plural: ["gol", "goles"]. */
  sufijo: [string, string];
  filas: RankingRow[];
  vacio: string;
  /** El torneo ya terminó: el primero es campeón de su categoría. */
  coronar: boolean;
}) {
  const color = acento === "volt" ? "text-volt-text" : "text-dt-blue";
  const [lider, ...resto] = filas;
  // Solo se corona a quien va SOLO en la punta. Destacar al primero
  // cuando hay empate es inventar un ganador: en figuras del torneo 1
  // ocho jugadores tienen una y el orden entre ellos es alfabético.
  const unicoLider = Boolean(lider) && (resto.length === 0 || lider.valor > resto[0].valor);
  const destacar = coronar && unicoLider;

  return (
    <Card className="bg-card shadow-card ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-2xl tracking-wide">
          {icono}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vacio}</p>
        ) : (
          <>
            {destacar ? (
              <div className="flex items-center gap-4 rounded-xl bg-surface-2 p-4">
                <Avatar className="size-16 shrink-0">
                  <AvatarImage src={lider.photoUrl ?? undefined} alt="" />
                  <AvatarFallback className="font-display text-xl">
                    {lider.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    {tituloLider}
                  </p>
                  <Link
                    href={`/jugador/${lider.playerId}`}
                    className="block truncate font-display text-2xl tracking-wide underline-offset-4 hover:underline"
                  >
                    {lider.name.toUpperCase()}
                  </Link>
                  {lider.teamName ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {lider.teamName}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "font-display text-5xl leading-none tabular-nums",
                      color,
                    )}
                  >
                    {lider.valor}
                  </p>
                  <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                    {lider.valor === 1 ? sufijo[0] : sufijo[1]}
                  </p>
                </div>
              </div>
            ) : null}

            {(destacar ? resto : filas).map((fila, i) => (
              <div key={fila.playerId} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-6 font-display text-lg tabular-nums",
                    color,
                  )}
                >
                  {destacar ? i + 2 : i + 1}
                </span>
                <Avatar className="size-8">
                  <AvatarImage src={fila.photoUrl ?? undefined} alt="" />
                  <AvatarFallback>
                    {fila.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {fila.name}
                  {fila.teamName ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {fila.teamName}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "font-display text-2xl tabular-nums",
                    color,
                  )}
                >
                  {fila.valor}
                </span>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
