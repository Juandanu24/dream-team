"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Loader2,
  Megaphone,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
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
import { ShareTextButton } from "@/components/share-text-button";
import { LineupPieceButton } from "@/components/lineup-piece-button";
import { buildLineupMessage } from "@/lib/match-summary";
import {
  FORMATIONS,
  formationLines,
  LINE_LABELS,
  type LineupLine,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  deleteLineup,
  publishLineup,
  saveLineup,
  unpublishLineup,
} from "./actions";

export interface SquadPlayer {
  playerId: string;
  name: string;
  isGoalkeeper: boolean;
  isCaptain: boolean;
}

export interface LineupSeed {
  id: string;
  formation: string;
  notes: string | null;
  publishedAt: string | null;
  /** playerId → { line, slot, isStarter } */
  slots: Record<string, { line: LineupLine; slot: number; isStarter: boolean }>;
}

export interface EditorTarget {
  matchId: string;
  teamId: string;
  teamName: string;
  teamColor: string | null;
  crestUrl: string | null;
  rivalName: string;
  when: string;
  venue: string;
  eyebrow: string;
  squad: SquadPlayer[];
  lineup: LineupSeed | null;
}

/** Casilla de la cancha: una línea y un lugar dentro de ella. */
interface Casilla {
  line: LineupLine;
  slot: number;
  label: string;
}

function casillasDe(formation: string): Casilla[] {
  const lines = formationLines(formation);
  const out: Casilla[] = [{ line: "gk", slot: 0, label: "ARQ" }];
  (["def", "mid", "fwd"] as const).forEach((line) => {
    for (let i = 0; i < lines[line]; i++) {
      out.push({
        line,
        slot: i,
        label: `${LINE_LABELS[line].slice(0, 3).toUpperCase()} ${i + 1}`,
      });
    }
  });
  return out;
}

const SIN_ASIGNAR = "__vacio__";

export function LineupEditor({ target }: { target: EditorTarget }) {
  const [formation, setFormation] = useState(
    target.lineup?.formation ?? FORMATIONS[0],
  );
  const [notes, setNotes] = useState(target.lineup?.notes ?? "");
  const [pending, startTransition] = useTransition();

  // asignaciones: clave "line:slot" → playerId
  const [asignados, setAsignados] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const [playerId, pos] of Object.entries(target.lineup?.slots ?? {})) {
      if (pos.isStarter) seed[`${pos.line}:${pos.slot}`] = playerId;
    }
    return seed;
  });

  const casillas = useMemo(() => casillasDe(formation), [formation]);

  // Los que no están en la cancha son suplentes: no hay que marcarlos.
  const titulares = useMemo(
    () => new Set(Object.values(asignados).filter(Boolean)),
    [asignados],
  );
  const suplentes = useMemo(
    () => target.squad.filter((p) => !titulares.has(p.playerId)),
    [target.squad, titulares],
  );

  function asignar(key: string, playerId: string) {
    setAsignados((prev) => {
      const next = { ...prev };
      if (playerId === SIN_ASIGNAR) {
        delete next[key];
        return next;
      }
      // Un jugador no puede estar en dos casillas: se quita de la anterior.
      for (const [k, v] of Object.entries(next)) {
        if (v === playerId) delete next[k];
      }
      next[key] = playerId;
      return next;
    });
  }

  const completa = casillas.every((c) => asignados[`${c.line}:${c.slot}`]);

  function entradas() {
    const titularesEntries = casillas
      .map((c) => {
        const playerId = asignados[`${c.line}:${c.slot}`];
        return playerId
          ? { player_id: playerId, line: c.line, slot: c.slot, is_starter: true }
          : null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const banca = suplentes.map((p) => ({
      player_id: p.playerId,
      line: (p.isGoalkeeper ? "gk" : "mid") as LineupLine,
      slot: 0,
      is_starter: false,
    }));

    return [...titularesEntries, ...banca];
  }

  function guardar(despues?: (lineupId: string) => Promise<void>) {
    startTransition(async () => {
      try {
        const lineupId = await saveLineup({
          matchId: target.matchId,
          teamId: target.teamId,
          formation,
          notes: notes.trim() || null,
          entries: entradas(),
        });
        if (despues) await despues(lineupId);
        else toast.success("Alineación guardada");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo guardar",
        );
      }
    });
  }

  // Datos para compartir e imagen, calculados de lo que hay en pantalla.
  const lines = formationLines(formation);
  const filas = useMemo(() => {
    const porLinea = (line: LineupLine, count: number) =>
      Array.from({ length: count }, (_, i) => asignados[`${line}:${i}`])
        .filter(Boolean)
        .map((playerId) => {
          const p = target.squad.find((s) => s.playerId === playerId);
          return { name: p?.name ?? "—", isCaptain: p?.isCaptain };
        });
    return [
      { players: porLinea("gk", 1) },
      { players: porLinea("def", lines.def) },
      { players: porLinea("mid", lines.mid) },
      { players: porLinea("fwd", lines.fwd) },
    ];
  }, [asignados, lines, target.squad]);

  const whatsapp = buildLineupMessage({
    teamName: target.teamName,
    rivalName: target.rivalName,
    when: target.when,
    venue: target.venue,
    formation,
    lines: [
      { label: "Arquero", players: filas[0].players.map((p) => p.name) },
      { label: "Defensa", players: filas[1].players.map((p) => p.name) },
      { label: "Mediocampo", players: filas[2].players.map((p) => p.name) },
      { label: "Delantera", players: filas[3].players.map((p) => p.name) },
    ],
    bench: suplentes.map((p) => p.name),
    notes: notes.trim() || null,
  });

  const publicada = Boolean(target.lineup?.publishedAt);

  return (
    <div className="space-y-6">
      {/* Formación */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`formacion-${target.teamId}`}>Formación</Label>
          <Select value={formation} onValueChange={setFormation}>
            <SelectTrigger id={`formacion-${target.teamId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATIONS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f} · {formationLines(f).def} defensas,{" "}
                  {formationLines(f).mid} medios, {formationLines(f).fwd} arriba
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`notas-${target.teamId}`}>Nota (opcional)</Label>
          <Textarea
            id={`notas-${target.teamId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="Llegar 15 minutos antes, camiseta oscura…"
          />
        </div>
      </div>

      {/* Casillas de la cancha, de delantera a arquero (como se ve) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Titulares</Label>
          <span
            className={cn(
              "text-xs",
              completa ? "text-volt" : "text-muted-foreground",
            )}
          >
            {Object.values(asignados).filter(Boolean).length}/{casillas.length}
          </span>
        </div>

        {(["fwd", "mid", "def", "gk"] as const).map((line) => {
          const delLinea = casillas.filter((c) => c.line === line);
          if (delLinea.length === 0) return null;
          return (
            <div key={line} className="space-y-1.5">
              <span className="text-xs tracking-widest text-dt-blue uppercase">
                {LINE_LABELS[line]}
              </span>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {delLinea.map((c) => {
                  const key = `${c.line}:${c.slot}`;
                  const value = asignados[key] ?? SIN_ASIGNAR;
                  return (
                    <Select
                      key={key}
                      value={value}
                      onValueChange={(v) => asignar(key, v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={c.label} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SIN_ASIGNAR}>
                          — {c.label} —
                        </SelectItem>
                        {target.squad.map((p) => (
                          <SelectItem key={p.playerId} value={p.playerId}>
                            {p.name}
                            {p.isCaptain ? " (C)" : ""}
                            {p.isGoalkeeper ? " 🧤" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Suplentes: se deducen, no se eligen */}
      <div className="space-y-1.5">
        <Label>Suplentes</Label>
        {suplentes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todos los del equipo quedaron de titulares.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {suplentes.map((p) => (
              <span
                key={p.playerId}
                className="rounded-md border border-border/60 px-2 py-1 text-xs"
              >
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Button onClick={() => guardar()} disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Save aria-hidden />
          )}
          Guardar
        </Button>

        <Button
          variant="outline"
          disabled={pending || !completa}
          title={
            completa
              ? "Guardar, publicar y notificar por push"
              : "Completa los titulares primero"
          }
          onClick={() =>
            guardar(async (lineupId) => {
              const enviados = await publishLineup(lineupId);
              toast.success(
                enviados > 0
                  ? `Publicada y notificada a ${enviados} ${enviados === 1 ? "persona" : "personas"}`
                  : "Alineación publicada",
              );
            })
          }
        >
          <Megaphone aria-hidden />
          {publicada ? "Republicar" : "Publicar y notificar"}
        </Button>

        <ShareTextButton text={whatsapp} title="Compartir por WhatsApp" />

        <LineupPieceButton
          eyebrow={target.eyebrow}
          team={{
            name: target.teamName,
            color: target.teamColor,
            crestUrl: target.crestUrl,
          }}
          formation={formation}
          rows={filas}
          bench={suplentes.map((p) => p.name)}
        />

        {target.lineup ? (
          <>
            {publicada ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await unpublishLineup(target.lineup!.id);
                      toast.success("Vuelta a borrador");
                    } catch {
                      toast.error("No se pudo despublicar");
                    }
                  })
                }
              >
                <Undo2 aria-hidden /> Borrador
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={() => {
                if (!confirm(`¿Borrar la alineación de ${target.teamName}?`)) return;
                startTransition(async () => {
                  try {
                    await deleteLineup(target.lineup!.id);
                    toast.success("Alineación borrada");
                  } catch {
                    toast.error("No se pudo borrar");
                  }
                });
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          </>
        ) : null}
      </div>

      {publicada ? (
        <p className="flex items-center gap-1.5 text-xs text-volt">
          <Check className="size-3.5" aria-hidden />
          Publicada — ya se ve en la web y se notificó.
        </p>
      ) : null}
    </div>
  );
}

export function LineupCard({
  target,
  accent,
}: {
  target: EditorTarget;
  accent: string;
}) {
  return (
    <Card className="border-border/60 bg-card/70">
      <CardContent className="space-y-4 px-5">
        <div className="flex items-center gap-2">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden
          />
          <h3 className="font-display text-2xl tracking-wide">
            {target.teamName}
          </h3>
        </div>
        {target.squad.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este equipo no tiene jugadores asignados. Ármalo en Equipos.
          </p>
        ) : (
          <LineupEditor target={target} />
        )}
      </CardContent>
    </Card>
  );
}
