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
  type StandingLite,
  type TeamSide,
} from "@/lib/post-image";
import { cn } from "@/lib/utils";

const SITE = "dreamteamcolombia.vercel.app";
const TAGS = "#DreamTeamColombia #FutbolAmateur #Montería #LaF8 #CanchaF8";

export interface MatchPiece {
  id: string;
  label: string;
  eyebrow: string;
  when: string;
  venue: string;
  home: TeamSide;
  away: TeamSide;
  finished: boolean;
  note?: string;
}

export interface TeamPiece {
  id: string;
  eyebrow: string;
  team: TeamSide;
  captain?: string;
  players: string[];
}

export interface PiecesData {
  matches: MatchPiece[];
  standings: { eyebrow: string; rows: StandingLite[] };
  scorers: { eyebrow: string; rows: RankLite[] };
  penalties: { eyebrow: string; rows: RankLite[] };
  teams: TeamPiece[];
}

interface Rendered {
  key: string;
  url: string;
  blob: Blob;
}

const KINDS: { value: PieceKind; label: string; hint: string }[] = [
  { value: "anuncio", label: "Anuncio", hint: "Antes del partido" },
  { value: "resultado", label: "Resultado", hint: "Después del partido" },
  { value: "posiciones", label: "Posiciones", hint: "La tabla al día" },
  { value: "goleadores", label: "Goleadores", hint: "Los que la rompen" },
  { value: "equipo", label: "Equipo", hint: "Escudo y nómina" },
  { value: "penales", label: "Penales", hint: "Ranking del reto" },
];

const FORMATS: { value: PieceFormat; label: string; hint: string }[] = [
  { value: "feed", label: "Feed", hint: "1080 × 1350" },
  { value: "story", label: "Story", hint: "1080 × 1920" },
];

/** Los tipos que dependen de escoger algo más en un selector. */
function needsPicker(kind: PieceKind) {
  return kind === "anuncio" || kind === "resultado" || kind === "equipo";
}

export function PiecesStudio({ data }: { data: PiecesData }) {
  const firstPending = Math.max(
    0,
    data.matches.findIndex((m) => !m.finished),
  );

  const [kind, setKind] = useState<PieceKind>("anuncio");
  const [format, setFormat] = useState<PieceFormat>("feed");
  const [matchId, setMatchId] = useState(data.matches[firstPending]?.id ?? "");
  const [teamId, setTeamId] = useState(data.teams[0]?.id ?? "");
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

  // Un tipo sin datos no se puede dibujar; el aviso explica qué falta.
  const missing = useMemo(() => {
    if ((kind === "anuncio" || kind === "resultado") && !match)
      return "Todavía no hay partidos con los dos equipos definidos. Ármalos en Calendario.";
    if (kind === "posiciones" && data.standings.rows.length === 0)
      return "La tabla está vacía. Aparece cuando haya equipos y resultados.";
    if (kind === "goleadores" && data.scorers.rows.length === 0)
      return "Todavía no hay goles cargados. Anótalos en Resultados.";
    if (kind === "penales" && data.penalties.rows.length === 0)
      return "Nadie ha jugado el reto de penales todavía.";
    if (kind === "equipo" && !team)
      return "Todavía no hay equipos. Ármalos en Equipos.";
    return null;
  }, [kind, match, team, data]);

  const piece = useMemo<PostImageData | null>(() => {
    if (missing) return null;
    const common = { format };
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
          note: kind === "resultado" ? match.note : undefined,
        };
      case "posiciones":
        return {
          ...common,
          kind,
          eyebrow: data.standings.eyebrow,
          headline: "Tabla de posiciones",
          rows: data.standings.rows,
        };
      case "goleadores":
        return {
          ...common,
          kind,
          eyebrow: data.scorers.eyebrow,
          headline: "Goleadores",
          rows: data.scorers.rows,
          unit: "goles",
        };
      case "penales":
        return {
          ...common,
          kind,
          eyebrow: data.penalties.eyebrow,
          headline: "Ranking de penales",
          rows: data.penalties.rows,
          unit: "de 5",
        };
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
    }
  }, [kind, format, match, team, data, missing]);

  const caption = useMemo(() => {
    switch (kind) {
      case "resultado": {
        if (!match) return "";
        const marker = `${match.home.name} ${match.home.score ?? 0} — ${match.away.score ?? 0} ${match.away.name}`;
        const goals = match.note ? `\n\n⚽ Goles: ${match.note}` : "";
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
    }
  }, [kind, match, team, data]);

  // La edición se guarda junto a la selección que la produjo: al cambiar
  // de pieza el texto vuelve solo al sugerido, sin efectos ni refs.
  const captionKey = `${kind}:${matchId}:${teamId}`;
  const [edited, setEdited] = useState<{ key: string; text: string } | null>(null);
  const text = edited?.key === captionKey ? edited.text : caption;

  // "Está ocupado" se deduce de si lo dibujado corresponde a lo
  // seleccionado, en vez de setearlo dentro del efecto: React 19 marca
  // como error el setState síncrono en el cuerpo de un efecto.
  const key = piece ? `${kind}:${format}:${matchId}:${teamId}` : "";
  const busy = Boolean(piece) && rendered?.key !== key;
  const preview = piece && rendered?.key === key ? rendered.url : null;
  const blob = piece && rendered?.key === key ? rendered.blob : null;

  // Redibuja cuando cambia la selección. El objeto URL anterior se libera
  // justo cuando lo reemplaza el nuevo, para no dejar blobs colgando.
  useEffect(() => {
    if (!piece) return;
    let cancelled = false;

    renderPostImage(piece)
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
  }, [piece, key]);

  // Suelta el último blob al salir de la página.
  useEffect(() => {
    return () => {
      if (latest.current) URL.revokeObjectURL(latest.current);
    };
  }, []);

  function selectKind(next: PieceKind) {
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
    if (!blob || !piece) return;
    const file = new File([blob], postFileName(piece), { type: "image/png" });

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
              {kind === "equipo" ? "Equipo" : "Partido"}
            </Label>
            {kind === "equipo" ? (
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
            {kind === "resultado" && match && !match.finished ? (
              <p className="text-xs text-muted-foreground">
                Este partido todavía no tiene marcador cargado: la pieza saldrá
                en 0-0. Cárgalo en Resultados primero.
              </p>
            ) : null}
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
