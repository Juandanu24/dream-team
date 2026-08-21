"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  postFileName,
  renderPostImage,
  type PieceFormat,
  type PieceKind,
  type PostImageData,
  type RankLite,
  type ScorerLine,
  type StandingLite,
  type TeamSide,
} from "@/lib/post-image";
import { TeamCardsButton } from "@/components/team-cards-button";
import { renderCardImage } from "@/lib/card-image";
import { renderPlayerPost } from "@/lib/post-image";
import type { CardImageData } from "@/lib/card-image";
import { cn } from "@/lib/utils";

/** El estudio ofrece un tipo más que los que sabe dibujar renderPostImage:
 *  "figura" se compone en dos pasos (carta + marco), así que no forma
 *  parte de PieceKind. */
type StudioKind = PieceKind | "figura";

const SITE = "dreamteamcolombia.vercel.app";
const TAGS = "#DreamTeamColombia #FutbolAmateur #Montería #LaF8 #CanchaF8";

export interface MatchPiece {
  id: string;
  week: number;
  label: string;
  eyebrow: string;
  when: string;
  venue: string;
  home: TeamSide;
  away: TeamSide;
  finished: boolean;
  homeScorers: ScorerLine[];
  awayScorers: ScorerLine[];
}

export interface TeamPiece {
  id: string;
  eyebrow: string;
  team: TeamSide;
  captain?: string;
  players: string[];
  cards: CardImageData[];
}

export interface MvpPiece {
  matchId: string;
  label: string;
  eyebrow: string;
  marker: string;
  card: CardImageData;
}

export interface PiecesData {
  matches: MatchPiece[];
  mvps: MvpPiece[];
  standings: { eyebrow: string; rows: StandingLite[] };
  scorers: { eyebrow: string; rows: RankLite[] };
  assists: { eyebrow: string; rows: RankLite[] };
  penalties: { eyebrow: string; rows: RankLite[] };
  teams: TeamPiece[];
}

interface Rendered {
  key: string;
  url: string;
  blob: Blob;
}

const KINDS: { value: StudioKind; label: string; hint: string }[] = [
  { value: "anuncio", label: "Anuncio", hint: "Antes del partido" },
  { value: "resultado", label: "Resultado", hint: "Después del partido" },
  { value: "posiciones", label: "Posiciones", hint: "La tabla al día" },
  { value: "goleadores", label: "Goleadores", hint: "Los que la rompen" },
  { value: "asistencias", label: "Asistencias", hint: "Los que la sirven" },
  { value: "figura", label: "Figura", hint: "El mejor del partido" },
  { value: "duelo", label: "Duelo", hint: "Las fotos de los dos equipos" },
  { value: "equipo", label: "Equipo", hint: "Escudo y nómina" },
  { value: "penales", label: "Penales", hint: "Ranking del reto" },
];

const FORMATS: { value: PieceFormat; label: string; hint: string }[] = [
  { value: "feed", label: "Feed", hint: "1080 × 1350" },
  { value: "story", label: "Story", hint: "1080 × 1920" },
];

/** Los rankings dejan escoger cuántos entran en la pieza. */
function esRanking(kind: StudioKind) {
  return kind === "goleadores" || kind === "asistencias" || kind === "penales";
}

/** Los tipos que dependen de escoger algo más en un selector. */
function needsPicker(kind: StudioKind) {
  return (
    kind === "anuncio" ||
    kind === "resultado" ||
    kind === "equipo" ||
    kind === "figura" ||
    kind === "duelo"
  );
}

export function PiecesStudio({ data }: { data: PiecesData }) {
  const firstPending = Math.max(
    0,
    data.matches.findIndex((m) => !m.finished),
  );

  const [kind, setKind] = useState<StudioKind>("anuncio");
  const [format, setFormat] = useState<PieceFormat>("feed");
  const [matchId, setMatchId] = useState(data.matches[firstPending]?.id ?? "");
  const [teamId, setTeamId] = useState(data.teams[0]?.id ?? "");
  const [mvpId, setMvpId] = useState(data.mvps[0]?.matchId ?? "");
  // Fotos del duelo: las sube el admin, no salen de la base.
  const [fotos, setFotos] = useState<{ home: string | null; away: string | null }>({
    home: null,
    away: null,
  });
  // Encuadre por foto: zoom y posición dentro del panel.
  const [encuadre, setEncuadre] = useState<
    Record<"home" | "away", { zoom: number; x: number; y: number }>
  >({
    home: { zoom: 1, x: 0, y: 0 },
    away: { zoom: 1, x: 0, y: 0 },
  });
  // 0 = todos. Seis alcanza cuando el torneo avanza y hay diferencias;
  // al principio, con muchos empatados, conviene mostrarlos a todos.
  const [cuantos, setCuantos] = useState(6);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [copied, setCopied] = useState(false);
  const latest = useRef<string | null>(null);

  const match = useMemo(
    () => data.matches.find((m) => m.id === matchId),
    [data.matches, matchId],
  );
  const team = useMemo(
    () => data.teams.find((t) => t.id === teamId),
    [data.teams, teamId],
  );
  const mvp = useMemo(
    () => data.mvps.find((m) => m.matchId === mvpId),
    [data.mvps, mvpId],
  );

  // Un tipo sin datos no se puede dibujar; el aviso explica qué falta.
  const missing = useMemo(() => {
    if ((kind === "anuncio" || kind === "resultado") && !match)
      return "Todavía no hay partidos con los dos equipos definidos. Ármalos en Calendario.";
    if (kind === "posiciones" && data.standings.rows.length === 0)
      return "La tabla está vacía. Aparece cuando haya equipos y resultados.";
    if (kind === "goleadores" && data.scorers.rows.length === 0)
      return "Todavía no hay goles cargados. Anótalos en Resultados.";
    if (kind === "asistencias" && data.assists.rows.length === 0)
      return "Todavía no hay asistencias cargadas. Anótalas en Resultados.";
    if (kind === "penales" && data.penalties.rows.length === 0)
      return "Nadie ha jugado el reto de penales todavía.";
    if (kind === "equipo" && !team)
      return "Todavía no hay equipos. Ármalos en Equipos.";
    if (kind === "figura" && !mvp)
      return "Todavía no has elegido ninguna figura. Se escoge en Resultados.";
    if (kind === "duelo" && !match)
      return "Escoge el partido del duelo.";
    if (kind === "duelo" && !fotos.home && !fotos.away)
      return "Sube la foto de cada equipo para armar el duelo.";
    return null;
  }, [kind, match, team, mvp, data, fotos]);

  const piece = useMemo<PostImageData | null>(() => {
    if (missing) return null;
    const common = { format };

    // El número elegido se respeta tal cual. Antes se estiraba el corte
    // hasta el final del empate, y con nueve jugadores empatados en un
    // gol pedir "los 5" devolvía los 9: el control no servía de nada.
    // Ahora, si el corte parte un empate, se dice al pie de la pieza.
    const recortar = (rows: RankLite[], unidad: string) => {
      if (cuantos === 0 || rows.length <= cuantos) {
        return { rows, footnote: undefined as string | undefined };
      }
      const visibles = rows.slice(0, cuantos);
      const corte = visibles[visibles.length - 1].value;
      const empatadosFuera = rows
        .slice(cuantos)
        .filter((r) => r.value === corte).length;
      return {
        rows: visibles,
        footnote:
          empatadosFuera > 0
            ? `+${empatadosFuera} más con ${corte} ${unidad}`
            : undefined,
      };
    };

    switch (kind) {
      case "anuncio":
      case "resultado":
        if (!match) return null;
        return {
          ...common,
          kind,
          eyebrow: match.eyebrow,
          headline: kind === "anuncio" ? "Hoy jugamos" : "Resultado",
          home: match.home,
          away: match.away,
          when: match.when,
          venue: match.venue,
          homeScorers: kind === "resultado" ? match.homeScorers : undefined,
          awayScorers: kind === "resultado" ? match.awayScorers : undefined,
        };
      case "posiciones":
        return {
          ...common,
          kind,
          eyebrow: data.standings.eyebrow,
          headline: "Tabla de posiciones",
          rows: data.standings.rows,
        };
      case "goleadores": {
        const { rows, footnote } = recortar(data.scorers.rows, "gol");
        return {
          ...common,
          kind,
          eyebrow: data.scorers.eyebrow,
          headline: "Goleadores",
          rows,
          unit: "goles",
          footnote,
        };
      }
      case "asistencias": {
        const { rows, footnote } = recortar(data.assists.rows, "asistencia");
        return {
          ...common,
          kind,
          eyebrow: data.assists.eyebrow,
          headline: "Asistencias",
          rows,
          unit: "asist.",
          footnote,
        };
      }
      case "penales": {
        const { rows, footnote } = recortar(data.penalties.rows, "de 5");
        return {
          ...common,
          kind,
          eyebrow: data.penalties.eyebrow,
          headline: "Ranking de penales",
          rows,
          unit: "de 5",
          footnote,
        };
      }
      case "duelo": {
        if (!match) return null;
        return {
          ...common,
          kind,
          home: {
            ...match.home,
            photoUrl: fotos.home,
            photoZoom: encuadre.home.zoom,
            photoX: encuadre.home.x,
            photoY: encuadre.home.y,
          },
          away: {
            ...match.away,
            photoUrl: fotos.away,
            photoZoom: encuadre.away.zoom,
            photoX: encuadre.away.x,
            photoY: encuadre.away.y,
          },
          footer: match.finished
            ? `Semana ${match.week} · ${match.home.score ?? 0} - ${match.away.score ?? 0}`
            : `Semana ${match.week} · 1er Torneo Amistoso`,
        };
      }
      case "equipo":
        if (!team) return null;
        return {
          ...common,
          kind,
          eyebrow: team.eyebrow,
          headline: team.team.name,
          team: team.team,
          captain: team.captain,
          players: team.players,
        };
      default:
        // "alineacion" se arma desde /admin/alineaciones, y "figura" se
        // dibuja en dos pasos (carta y luego marco), fuera de este switch.
        return null;
    }
  }, [kind, format, match, team, data, missing, cuantos, fotos, encuadre]);

  const caption = useMemo(() => {
    switch (kind) {
      case "resultado": {
        if (!match) return "";
        const marker = `${match.home.name} ${match.home.score ?? 0} — ${match.away.score ?? 0} ${match.away.name}`;
        const lista = (rows: ScorerLine[]) =>
          rows.map((r) => (r.goals > 1 ? `${r.name} ×${r.goals}` : r.name)).join(", ");
        const goals =
          match.homeScorers.length + match.awayScorers.length > 0
            ? `\n\n⚽ ${match.home.name}: ${lista(match.homeScorers) || "—"}\n⚽ ${match.away.name}: ${lista(match.awayScorers) || "—"}`
            : "";
        return `🔥 ¡SE JUGÓ Y QUEDÓ ASÍ!\n\n${marker}${goals}\n\nLa tabla de posiciones ya está actualizada en vivo en la web 👇\n\n🔗 ${SITE} (Link en la bio)\n\n💬 ¿Qué te pareció el partido? Cuéntanos abajo 👇\n\n${TAGS}`;
      }
      case "anuncio": {
        if (!match) return "";
        return `⚽ ¡HOY SE JUEGA!\n\n${match.home.name} 🆚 ${match.away.name}\n\n🗓️ ${match.when}\n📍 ${match.venue}\n\nVenga y acompáñenos, que esto se pone bueno. Planteles, cartas de jugadores y tabla en vivo en la web 👇\n\n🔗 ${SITE} (Link en la bio)\n\n💬 ¿Quién gana este? 👇\n\n${TAGS}`;
      }
      case "posiciones": {
        const top = data.standings.rows[0];
        const lider = top ? `\n\nPor ahora manda ${top.teamName} con ${top.points} ${top.points === 1 ? "punto" : "puntos"}. 👑` : "";
        return `📊 ASÍ VA LA TABLA\n\n${data.standings.eyebrow}.${lider}\n\nEsto está apretado y todavía queda torneo. Mira la tabla completa, con diferencia de gol y todo, en la web 👇\n\n🔗 ${SITE} (Link en la bio)\n\n💬 ¿Tu equipo va a remontar? 👇\n\n${TAGS}`;
      }
      case "goleadores": {
        const top = data.scorers.rows[0];
        const lider = top
          ? `\n\nEl pichichi por ahora es ${top.name} (${top.detail}) con ${top.value} ${top.value === 1 ? "gol" : "goles"}. 🔥`
          : "";
        return `⚽ LOS QUE LA ESTÁN ROMPIENDO\n\nTabla de goleadores del torneo.${lider}\n\nLa lista completa y las cartas de cada jugador están en la web 👇\n\n🔗 ${SITE} (Link en la bio)\n\n💬 ¿Quién se lleva la bota de oro? 👇\n\n${TAGS}`;
      }
      case "duelo": {
        if (!match) return "";
        if (match.finished) {
          return `⚔️ ${match.home.name} ${match.home.score ?? 0} - ${match.away.score ?? 0} ${match.away.name}\n\nAsí quedaron parados los dos equipos en la Cancha F8.\n\nTabla y goleadores en la web, link en la bio.\n\n${TAGS}`;
        }
        return `⚔️ ${match.home.name} 🆚 ${match.away.name}\n\n🗓️ ${match.when}\n📍 ${match.venue}\n\nSe viene el duelo. ¿Quién se lo lleva?\n\n🔗 ${SITE} (Link en la bio)\n\n${TAGS}`;
      }
      case "figura": {
        if (!mvp) return "";
        return `🏆 FIGURA DEL PARTIDO\n\n${mvp.card.name}${mvp.card.teamName ? ` (${mvp.card.teamName})` : ""} se llevó los aplausos en el ${mvp.marker}.\n\nSu carta y sus números están en la web 👇\n\n🔗 ${SITE} (Link en la bio)\n\n💬 ¿De acuerdo con la elección? 👇\n\n${TAGS}`;
      }
      case "asistencias": {
        const top = data.assists.rows[0];
        const lider = top
          ? `\n\nEl que más la sirve es ${top.name} (${top.detail}) con ${top.value} ${top.value === 1 ? "asistencia" : "asistencias"}. 🎯`
          : "";
        return `🎯 LOS QUE PONEN EL PASE\n\nNo todo es meterla: alguien la tuvo que servir.${lider}\n\nLa tabla completa está en la web 👇\n\n🔗 ${SITE} (Link en la bio)\n\n💬 ¿Quién es el mejor asistidor del parche? 👇\n\n${TAGS}`;
      }
      case "penales": {
        return `🥅 ¿CUÁNTOS LE METES AL ARQUERO?\n\nEste es el ranking del reto de penales. Son 5 tiros y el arquero te va aprendiendo las mañas: si repites palo, te la ataja.\n\n¿Te crees capaz de meter los 5? Entra y compite 👇\n\n🔗 ${SITE}/penales (Link en la bio)\n\n💬 Comenta tu puntaje 👇\n\n${TAGS}`;
      }
      case "equipo": {
        if (!team) return "";
        const cap = team.captain ? `\n\n🎖️ Capitán: ${team.captain}` : "";
        const nomina =
          team.players.length > 0
            ? `\n\n👥 Nómina:\n${team.players.map((p) => `• ${p}`).join("\n")}`
            : "";
        return `⚽ CONOCE A ${team.team.name.toUpperCase()}\n\nEstos son los que van a dejar el alma en la cancha por el primer título del Dream Team.${cap}${nomina}\n\nLas cartas tipo FIFA de cada uno están en la web 👇\n\n🔗 ${SITE} (Link en la bio)\n\n💬 ¿Le tienes fe a este combo? 👇\n\n${TAGS}`;
      }
      default:
        return "";
    }
  }, [kind, match, team, mvp, data]);

  // La edición se guarda junto a la selección que la produjo: al cambiar
  // de pieza el texto vuelve solo al sugerido, sin efectos ni refs.
  const captionKey = `${kind}:${matchId}:${teamId}:${mvpId}`;
  const [edited, setEdited] = useState<{ key: string; text: string } | null>(null);
  const text = edited?.key === captionKey ? edited.text : caption;

  // "Está ocupado" se deduce de si lo dibujado corresponde a lo
  // seleccionado, en vez de setearlo dentro del efecto: React 19 marca
  // como error el setState síncrono en el cuerpo de un efecto.
  const esFigura = kind === "figura" && Boolean(mvp) && !missing;
  const dibujable = Boolean(piece) || esFigura;
  const key = dibujable
    ? `${kind}:${format}:${matchId}:${teamId}:${mvpId}:${cuantos}:${fotos.home ?? ""}:${fotos.away ?? ""}:${JSON.stringify(encuadre)}`
    : "";
  const busy = dibujable && rendered?.key !== key;
  const preview = dibujable && rendered?.key === key ? rendered.url : null;
  const blob = dibujable && rendered?.key === key ? rendered.blob : null;

  // Redibuja cuando cambia la selección. El objeto URL anterior se libera
  // justo cuando lo reemplaza el nuevo, para no dejar blobs colgando.
  useEffect(() => {
    if (!dibujable) return;
    let cancelled = false;

    // La figura son dos pasos: primero su carta FIFA, después el marco de
    // Instagram con el encabezado encima.
    const dibujar = async () => {
      if (esFigura && mvp) {
        const carta = await renderCardImage(mvp.card);
        return renderPlayerPost(carta, mvp.card.teamColor ?? null, {
          eyebrow: mvp.eyebrow,
          headline: "Figura del partido",
          format,
        });
      }
      return renderPostImage(piece!);
    };

    dibujar()
      .then((result) => {
        if (cancelled) return;
        const url = URL.createObjectURL(result);
        latest.current = url;
        setRendered((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { key, url, blob: result };
        });
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo dibujar la pieza");
      });

    return () => {
      cancelled = true;
    };
  }, [piece, key, dibujable, esFigura, mvp, format]);

  // Suelta el último blob al salir de la página.
  useEffect(() => {
    return () => {
      if (latest.current) URL.revokeObjectURL(latest.current);
    };
  }, []);

  function selectKind(next: StudioKind) {
    setKind(next);
    // Un partido ya jugado casi siempre se quiere como resultado, y al revés.
    if (next === "resultado" && match && !match.finished) {
      const played = data.matches.filter((m) => m.finished);
      if (played.length > 0) setMatchId(played[played.length - 1].id);
    }
    if (next === "anuncio" && match?.finished) {
      const pending = data.matches.find((m) => !m.finished);
      if (pending) setMatchId(pending.id);
    }
  }

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  async function download() {
    if (!blob) return;
    const nombre =
      esFigura && mvp
        ? `dt-figura-${mvp.card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${format}.png`
        : piece
          ? postFileName(piece)
          : "dt-pieza.png";
    const file = new File([blob], nombre, { type: "image/png" });

    if (canShareFiles && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        // Si compartir falla, cae a la descarga de siempre.
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Pieza descargada");
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto a mano.");
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Vista previa */}
      <div className="lg:order-2">
        <Card className="overflow-hidden border-border/60 bg-card/70 py-0">
          <CardContent className="p-3">
            <div
              className={cn(
                "relative w-full overflow-hidden rounded-md bg-[#0a0a0a]",
                format === "feed" ? "aspect-[1080/1350]" : "aspect-[1080/1920]",
              )}
            >
              {preview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={preview}
                  alt="Vista previa de la pieza"
                  className="size-full object-contain"
                />
              ) : null}
              {busy ? (
                <div className="absolute inset-0 grid place-items-center bg-black/50">
                  <Loader2 className="size-8 animate-spin text-volt" aria-hidden />
                </div>
              ) : null}
              {missing ? (
                <p className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted-foreground">
                  {missing}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {format === "feed" ? "1080 × 1350 · feed" : "1080 × 1920 · story"}
        </p>
      </div>

      {/* Controles */}
      <div className="space-y-6 lg:order-1">
        <div className="space-y-2">
          <Label>Tipo de pieza</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => selectKind(k.value)}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-left transition-colors",
                  kind === k.value
                    ? "border-dt-blue bg-dt-blue/10"
                    : "border-border/60 hover:border-border",
                )}
              >
                <span className="block font-display text-xl tracking-wide">
                  {k.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {k.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {needsPicker(kind) ? (
          <div className="space-y-2">
            <Label htmlFor="objetivo">
              {kind === "equipo"
                ? "Equipo"
                : kind === "figura"
                  ? "Figura"
                  : "Partido"}
            </Label>
            {kind === "figura" ? (
              <select
                id="objetivo"
                className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover"
                value={mvpId}
                onChange={(e) => setMvpId(e.target.value)}
              >
                {data.mvps.map((m) => (
                  <option key={m.matchId} value={m.matchId}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : kind === "equipo" ? (
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger id="objetivo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={matchId} onValueChange={setMatchId}>
                <SelectTrigger id="objetivo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.matches.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                      {m.finished ? " ✓" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {kind === "duelo" && match ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {(["home", "away"] as const).map((lado) => {
                  const equipo = lado === "home" ? match.home : match.away;
                  return (
                    <div key={lado} className="space-y-1.5">
                      <Label
                        htmlFor={`foto-${lado}`}
                        className="text-xs text-muted-foreground"
                      >
                        Foto de {equipo.name}
                      </Label>
                      <input
                        id={`foto-${lado}`}
                        type="file"
                        accept="image/*"
                        className="w-full text-xs file:mr-2 file:rounded-md file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-xs"
                        onChange={(e) => {
                          const archivo = e.target.files?.[0];
                          if (!archivo?.type.startsWith("image/")) return;
                          const url = URL.createObjectURL(archivo);
                          setFotos((prev) => {
                            // Se suelta la anterior al reemplazarla, para no
                            // dejar blobs colgando en memoria.
                            if (prev[lado]) URL.revokeObjectURL(prev[lado]!);
                            return { ...prev, [lado]: url };
                          });
                        }}
                      />
                      {fotos[lado] ? (
                        <div className="space-y-1 rounded-md border border-border/60 p-2">
                          {(
                            [
                              { k: "zoom", label: "Zoom", min: 1, max: 3, step: 0.05 },
                              { k: "x", label: "Izq/Der", min: -1, max: 1, step: 0.02 },
                              { k: "y", label: "Arr/Aba", min: -1, max: 1, step: 0.02 },
                            ] as const
                          ).map((c) => (
                            <label
                              key={c.k}
                              className="flex items-center gap-2 text-[11px] text-muted-foreground"
                            >
                              <span className="w-14 shrink-0">{c.label}</span>
                              <input
                                type="range"
                                min={c.min}
                                max={c.max}
                                step={c.step}
                                value={encuadre[lado][c.k]}
                                className="h-1 w-full accent-[var(--dt-blue)]"
                                onChange={(e) =>
                                  setEncuadre((prev) => ({
                                    ...prev,
                                    [lado]: {
                                      ...prev[lado],
                                      [c.k]: Number(e.target.value),
                                    },
                                  }))
                                }
                              />
                            </label>
                          ))}
                          <button
                            type="button"
                            className="text-[11px] text-dt-blue underline-offset-2 hover:underline"
                            onClick={() =>
                              setEncuadre((prev) => ({
                                ...prev,
                                [lado]: { zoom: 1, x: 0, y: 0 },
                              }))
                            }
                          >
                            Reiniciar encuadre
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {kind === "resultado" && match && !match.finished ? (
              <p className="text-xs text-muted-foreground">
                Este partido todavía no tiene marcador cargado: la pieza saldrá
                en 0-0. Cárgalo en Resultados primero.
              </p>
            ) : null}
          </div>
        ) : null}

        {esRanking(kind) ? (
          <div className="space-y-2">
            <Label htmlFor="cuantos">Cuántos mostrar</Label>
            <select
              id="cuantos"
              className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover"
              value={cuantos}
              onChange={(e) => setCuantos(Number(e.target.value))}
            >
              <option value={5}>Los 5 primeros</option>
              <option value={6}>Los 6 primeros</option>
              <option value={8}>Los 8 primeros</option>
              <option value={10}>Los 10 primeros</option>
              <option value={0}>Todos</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Si el corte parte un empate, la pieza lo dice al pie.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Formato</Label>
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-left transition-colors",
                  format === f.value
                    ? "border-dt-blue bg-dt-blue/10"
                    : "border-border/60 hover:border-border",
                )}
              >
                <span className="block font-display text-xl tracking-wide">
                  {f.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {f.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {kind === "equipo" && team ? (
          <TeamCardsButton
            teamName={team.team.name}
            teamColor={team.team.color}
            cards={team.cards}
          />
        ) : null}

        <Button onClick={download} disabled={!blob || busy} className="w-full">
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : canShareFiles ? (
            <Share2 aria-hidden />
          ) : (
            <Download aria-hidden />
          )}
          {canShareFiles ? "Compartir pieza" : "Descargar pieza"}
        </Button>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="caption">Texto del post</Label>
            <Button variant="ghost" size="sm" onClick={copyCaption}>
              {copied ? (
                <Check className="text-volt" aria-hidden />
              ) : (
                <Copy aria-hidden />
              )}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <Textarea
            id="caption"
            value={text}
            onChange={(e) => setEdited({ key: captionKey, text: e.target.value })}
            rows={14}
            className="font-sans text-sm"
          />
        </div>
      </div>
    </div>
  );
}
