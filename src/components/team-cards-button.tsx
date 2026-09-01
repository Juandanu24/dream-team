"use client";

import { useState } from "react";
import { Images, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CardImageData } from "@/lib/card-image";
import {
  renderPostImage,
  type Encuadre,
  type PerfilStat,
  type PostImageData,
  type TeamSide,
} from "@/lib/post-image";

/** Un jugador con todo lo que necesita su pieza de perfil. */
export interface PlayerPiece extends CardImageData {
  playerId: string;
  detail: string;
  stats: PerfilStat[];
  /** Cómo recortar su foto. Nulo = sin ajustar. */
  encuadre: Encuadre | null;
}

/** Exporta el multipost de un equipo: primero el escudo con la nómina y
 *  después una pieza por jugador, todas en 1080×1350 y con el mismo
 *  marco. Listo para subirlo como carrusel. */
export function TeamCardsButton({
  teamName,
  teamColor,
  crestUrl,
  cards,
  portada,
}: {
  teamName: string;
  teamColor: string | null;
  crestUrl: string | null;
  cards: PlayerPiece[];
  /** La pieza del escudo, que va de primera. */
  portada: PostImageData;
}) {
  const [progreso, setProgreso] = useState<number | null>(null);

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  function slug(texto: string) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  const team: TeamSide = { name: teamName, color: teamColor, crestUrl };

  async function exportar() {
    setProgreso(0);
    try {
      const archivos: File[] = [];

      // 1. El escudo abre el carrusel.
      const cubierta = await renderPostImage(portada);
      archivos.push(
        new File([cubierta], `00-${slug(teamName) || "equipo"}.png`, {
          type: "image/png",
        }),
      );
      setProgreso(1);

      // 2. Un perfil por jugador, en el orden en que van en el carrusel.
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const pieza: PostImageData = {
          kind: "perfil",
          format: "feed",
          // Solo el nombre del equipo: "Conoce a X" envejece mal, y a
          // estas alturas del torneo ya nadie los está conociendo.
          eyebrow: teamName,
          headline: "",
          team,
          playerName: c.name,
          photoUrl: c.photoUrl,
          encuadre: c.encuadre,
          detail: c.detail,
          stats: c.stats,
          isCaptain: c.isCaptain,
        };
        const blob = await renderPostImage(pieza);
        archivos.push(
          new File(
            [blob],
            `${String(i + 1).padStart(2, "0")}-${slug(c.name) || "jugador"}.png`,
            { type: "image/png" },
          ),
        );
        setProgreso(i + 2);
      }

      // En el celular se entregan todas juntas al selector nativo, que es
      // justo lo que pide un carrusel.
      if (canShareFiles && navigator.canShare({ files: archivos })) {
        try {
          await navigator.share({ files: archivos, title: `${teamName}, uno por uno` });
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
      toast.error("No se pudo armar el multipost");
    } finally {
      setProgreso(null);
    }
  }

  const trabajando = progreso !== null;
  const total = cards.length + 1;

  return (
    <div className="space-y-1.5">
      <Button
        variant="outline"
        className="w-full"
        disabled={trabajando || cards.length === 0}
        onClick={exportar}
      >
        {trabajando ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : canShareFiles ? (
          <Share2 aria-hidden />
        ) : (
          <Images aria-hidden />
        )}
        {trabajando
          ? `Generando ${progreso}/${total}…`
          : `${canShareFiles ? "Compartir" : "Descargar"} el multipost (${total})`}
      </Button>
      <p className="text-xs text-muted-foreground">
        El escudo con la nómina de primera, y después un perfil por jugador
        con sus números del torneo. Van numeradas para conservar el orden.
      </p>
      {cards.length > 10 ? (
        <p className="text-xs text-volt">
          Instagram admite 10 por carrusel y este equipo tiene {total} piezas:
          te toca partirlo en dos publicaciones.
        </p>
      ) : null}
    </div>
  );
}
