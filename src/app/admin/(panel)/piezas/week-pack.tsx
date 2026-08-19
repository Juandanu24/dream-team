"use client";

import { useMemo, useState } from "react";
import { Loader2, PackageOpen, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { renderPostImage, type PostImageData } from "@/lib/post-image";
import type { PiecesData } from "./pieces-studio";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

const SITE = "dreamteamcolombia.vercel.app";
const TAGS = "#DreamTeamColombia #FutbolAmateur #Montería #LaF8";

/** Todas las piezas de una fecha, en el orden en que van en el carrusel.
 *
 *  El paquete se adapta al estado de la semana: si ya se jugó, cuenta la
 *  historia (resultados → tabla → goleadores); si todavía no, anuncia los
 *  partidos. Es el mismo recorrido que se hacía a mano pieza por pieza. */
function armarPaquete(data: PiecesData, week: number): PostImageData[] {
  const partidos = data.matches.filter((m) => m.week === week);
  const jugados = partidos.filter((m) => m.finished);
  const piezas: PostImageData[] = [];

  for (const match of partidos) {
    if (match.finished) {
      piezas.push({
        kind: "resultado",
        format: "feed",
        eyebrow: match.eyebrow,
        headline: "Resultado",
        home: match.home,
        away: match.away,
        when: match.when,
        venue: match.venue,
        homeScorers: match.homeScorers,
        awayScorers: match.awayScorers,
      });
    } else {
      piezas.push({
        kind: "anuncio",
        format: "feed",
        eyebrow: match.eyebrow,
        headline: "Hoy jugamos",
        home: match.home,
        away: match.away,
        when: match.when,
        venue: match.venue,
      });
    }
  }

  // La tabla y los goleadores solo tienen sentido si ya se jugó algo.
  if (jugados.length > 0 && data.standings.rows.length > 0) {
    piezas.push({
      kind: "posiciones",
      format: "feed",
      eyebrow: data.standings.eyebrow,
      headline: "Tabla de posiciones",
      rows: data.standings.rows,
    });
  }
  if (jugados.length > 0 && data.scorers.rows.length > 0) {
    const tope = 6;
    const visibles = data.scorers.rows.slice(0, tope);
    const corte = visibles[visibles.length - 1].value;
    const fuera = data.scorers.rows
      .slice(tope)
      .filter((r) => r.value === corte).length;
    piezas.push({
      kind: "goleadores",
      format: "feed",
      eyebrow: data.scorers.eyebrow,
      headline: "Goleadores",
      rows: visibles,
      unit: "goles",
      footnote: fuera > 0 ? `+${fuera} más con ${corte} gol` : undefined,
    });
  }

  return piezas;
}

function textoPaquete(data: PiecesData, week: number): string {
  const partidos = data.matches.filter((m) => m.week === week);
  const jugados = partidos.filter((m) => m.finished);

  if (jugados.length === 0) {
    const lineas = partidos
      .map((m) => `${m.home.name} 🆚 ${m.away.name}\n${m.when}`)
      .join("\n\n");
    return `⚽ SEMANA ${week}\n\n${lineas}\n\n📍 ${partidos[0]?.venue ?? ""}\n\nTabla y planteles en la web, link en la bio.\n\n${TAGS}`;
  }

  const marcadores = jugados
    .map(
      (m) =>
        `${m.home.name} ${m.home.score ?? 0} - ${m.away.score ?? 0} ${m.away.name}`,
    )
    .join("\n");
  const lider = data.standings.rows[0];
  const puntero = lider
    ? `\n\nManda ${lider.teamName} con ${lider.points} ${lider.points === 1 ? "punto" : "puntos"}.`
    : "";

  return `📊 ASÍ QUEDÓ LA SEMANA ${week}\n\n${marcadores}${puntero}\n\nDesliza 👉 para ver la tabla y los goleadores.\n\nTodo en vivo en ${SITE}, link en la bio.\n\n${TAGS}`;
}

export function WeekPack({ data }: { data: PiecesData }) {
  const semanas = useMemo(
    () => [...new Set(data.matches.map((m) => m.week))].sort((a, b) => a - b),
    [data.matches],
  );

  // Arranca en la última semana con algo jugado, que es la que se publica.
  const porDefecto = useMemo(() => {
    const jugadas = data.matches.filter((m) => m.finished).map((m) => m.week);
    return jugadas.length > 0 ? Math.max(...jugadas) : (semanas[0] ?? 1);
  }, [data.matches, semanas]);

  const [week, setWeek] = useState(porDefecto);
  const [progreso, setProgreso] = useState<number | null>(null);

  const piezas = useMemo(() => armarPaquete(data, week), [data, week]);
  const texto = useMemo(() => textoPaquete(data, week), [data, week]);

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  async function exportar() {
    if (piezas.length === 0) return;
    setProgreso(0);
    try {
      const archivos: File[] = [];
      for (let i = 0; i < piezas.length; i++) {
        const blob = await renderPostImage(piezas[i]);
        archivos.push(
          new File([blob], `semana-${week}-${String(i + 1).padStart(2, "0")}.png`, {
            type: "image/png",
          }),
        );
        setProgreso(i + 1);
      }

      if (canShareFiles && navigator.canShare({ files: archivos })) {
        try {
          await navigator.share({ files: archivos, text: texto });
          return;
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return;
        }
      }

      for (const archivo of archivos) {
        const url = URL.createObjectURL(archivo);
        const link = document.createElement("a");
        link.href = url;
        link.download = archivo.name;
        link.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 250));
      }
      toast.success(`${archivos.length} piezas descargadas`);
    } catch {
      toast.error("No se pudo armar el paquete");
    } finally {
      setProgreso(null);
    }
  }

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Texto copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  const trabajando = progreso !== null;

  return (
    <Card className="mt-8 border-dt-blue/40 bg-card/70">
      <CardContent className="space-y-4 px-5">
        <div>
          <h2 className="font-display text-2xl tracking-wide">
            PAQUETE DE LA <span className="text-dt-blue">FECHA</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas las piezas de una semana de un solo golpe, en el orden del
            carrusel.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="semana-paquete">Semana</Label>
            <select
              id="semana-paquete"
              className={selectClass}
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
            >
              {semanas.map((s) => (
                <option key={s} value={s}>
                  Semana {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={exportar} disabled={trabajando || piezas.length === 0}>
              {trabajando ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : canShareFiles ? (
                <Share2 aria-hidden />
              ) : (
                <PackageOpen aria-hidden />
              )}
              {trabajando
                ? `Generando ${progreso}/${piezas.length}…`
                : `${canShareFiles ? "Compartir" : "Descargar"} ${piezas.length} ${piezas.length === 1 ? "pieza" : "piezas"}`}
            </Button>
            <Button variant="outline" onClick={copiarTexto} disabled={trabajando}>
              Copiar texto
            </Button>
          </div>
        </div>

        {piezas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Esta semana todavía no tiene partidos con los dos equipos
            definidos.
          </p>
        ) : (
          <ol className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {piezas.map((p, i) => (
              <li
                key={`${p.kind}-${i}`}
                className="rounded-md border border-border/60 px-2 py-1"
              >
                {i + 1}. {p.kind}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
