"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Megaphone, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShareTextButton } from "@/components/share-text-button";
import { LineupPieceButton } from "@/components/lineup-piece-button";
import {
  FORMATIONS,
  formationLines,
  LINE_LABELS,
  type LineupLine,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  publishTeamOfWeek,
  saveTeamOfWeek,
  unpublishTeamOfWeek,
} from "./actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

const SIN_ASIGNAR = "";

export interface TotwCandidate {
  playerId: string;
  name: string;
  teamName: string;
  isGoalkeeper: boolean;
}

export interface TotwSeed {
  id: string;
  formation: string;
  notes: string | null;
  publishedAt: string | null;
  slots: Record<string, { line: LineupLine; slot: number }>;
}

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

export function TotwEditor({
  week,
  candidates,
  seed,
}: {
  week: number;
  candidates: TotwCandidate[];
  seed: TotwSeed | null;
}) {
  const [formation, setFormation] = useState(seed?.formation ?? FORMATIONS[0]);
  const [notes, setNotes] = useState(seed?.notes ?? "");
  const [pending, startTransition] = useTransition();

  const [asignados, setAsignados] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const [playerId, pos] of Object.entries(seed?.slots ?? {})) {
      inicial[`${pos.line}:${pos.slot}`] = playerId;
    }
    return inicial;
  });

  const casillas = useMemo(() => casillasDe(formation), [formation]);
  const completo = casillas.every((c) => asignados[`${c.line}:${c.slot}`]);
  const puestos = Object.values(asignados).filter(Boolean).length;

  function asignar(key: string, playerId: string) {
    setAsignados((prev) => {
      const next = { ...prev };
      if (playerId === SIN_ASIGNAR) {
        delete next[key];
        return next;
      }
      // Nadie puede estar en dos casillas del mismo once.
      for (const [k, v] of Object.entries(next)) {
        if (v === playerId) delete next[k];
      }
      next[key] = playerId;
      return next;
    });
  }

  const lines = formationLines(formation);
  const filas = useMemo(() => {
    const porLinea = (line: LineupLine, count: number) =>
      Array.from({ length: count }, (_, i) => {
        const playerId = asignados[`${line}:${i}`];
        if (!playerId) return null;
        const p = candidates.find((c) => c.playerId === playerId);
        return { name: p?.name ?? "—" };
      });
    return [
      { width: 1, players: porLinea("gk", 1) },
      { width: lines.def, players: porLinea("def", lines.def) },
      { width: lines.mid, players: porLinea("mid", lines.mid) },
      { width: lines.fwd, players: porLinea("fwd", lines.fwd) },
    ];
  }, [asignados, lines, candidates]);

  const nombreDe = (line: LineupLine, i: number) => {
    const id = asignados[`${line}:${i}`];
    return candidates.find((c) => c.playerId === id)?.name;
  };

  const textoWhatsapp = useMemo(() => {
    const linea = (line: LineupLine, count: number, etiqueta: string) => {
      const nombres = Array.from({ length: count }, (_, i) => nombreDe(line, i))
        .filter(Boolean)
        .join(", ");
      return nombres ? `${etiqueta}: ${nombres}` : null;
    };
    const partes = [
      `ONCE IDEAL - SEMANA ${week}`,
      "",
      `Formacion: ${formation}`,
      "",
      linea("gk", 1, "Arquero"),
      linea("def", lines.def, "Defensa"),
      linea("mid", lines.mid, "Mediocampo"),
      linea("fwd", lines.fwd, "Delantera"),
    ].filter((x): x is string => x !== null);
    if (notes.trim()) partes.push("", notes.trim());
    partes.push("", "Mas info: dreamteamcolombia.vercel.app");
    return partes.join("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignados, formation, lines, notes, week, candidates]);

  function guardar(despues?: (id: string) => Promise<void>) {
    startTransition(async () => {
      try {
        const id = await saveTeamOfWeek({
          week,
          formation,
          notes: notes.trim() || null,
          entries: casillas
            .map((c) => {
              const playerId = asignados[`${c.line}:${c.slot}`];
              return playerId
                ? { player_id: playerId, line: c.line, slot: c.slot }
                : null;
            })
            .filter((e): e is NonNullable<typeof e> => e !== null),
        });
        if (despues) await despues(id);
        else toast.success("Once ideal guardado");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo guardar. ¿Corriste la migración 00011?",
        );
      }
    });
  }

  const publicado = Boolean(seed?.publishedAt);

  return (
    <Card className="border-border/60 bg-card/70">
      <CardContent className="space-y-6 px-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`formacion-${week}`}>Formación</Label>
            <select
              id={`formacion-${week}`}
              className={selectClass}
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
            >
              {FORMATIONS.map((f) => (
                <option key={f} value={f}>
                  {f} · {formationLines(f).def} def, {formationLines(f).mid} med,{" "}
                  {formationLines(f).fwd} del
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`notas-${week}`}>Nota (opcional)</Label>
            <Textarea
              id={`notas-${week}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={280}
              placeholder="El que la rompió, el gol de la fecha…"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Los nueve</Label>
            <span
              className={cn(
                "text-xs",
                completo ? "text-volt" : "text-muted-foreground",
              )}
            >
              {puestos}/{casillas.length}
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
                    // Para el arco solo se ofrecen arqueros; en el resto de
                    // líneas juega cualquiera, que en fútbol amateur pasa.
                    const opciones =
                      c.line === "gk"
                        ? candidates.filter((p) => p.isGoalkeeper)
                        : candidates;
                    return (
                      <select
                        key={key}
                        className={selectClass}
                        value={asignados[key] ?? SIN_ASIGNAR}
                        aria-label={c.label}
                        onChange={(e) => asignar(key, e.target.value)}
                      >
                        <option value={SIN_ASIGNAR}>— {c.label} —</option>
                        {opciones.map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {p.name} ({p.teamName})
                          </option>
                        ))}
                      </select>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

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
            disabled={pending || !completo}
            title={completo ? "Guardar, publicar y avisar" : "Faltan jugadores"}
            onClick={() =>
              guardar(async (id) => {
                const enviados = await publishTeamOfWeek(id, week);
                if (enviados > 0) {
                  toast.success(
                    `Publicado y avisado a ${enviados} ${enviados === 1 ? "persona" : "personas"}`,
                  );
                } else {
                  toast.warning("Publicado, pero no salió ningún aviso");
                }
              })
            }
          >
            <Megaphone aria-hidden />
            {publicado ? "Republicar y avisar" : "Publicar y avisar"}
          </Button>

          <ShareTextButton text={textoWhatsapp} title="Compartir por WhatsApp" />

          <LineupPieceButton
            eyebrow={`Once ideal · Semana ${week}`}
            team={{ name: `Once ideal · Semana ${week}`, color: "#CCFF00", crestUrl: null }}
            formation={formation}
            rows={filas}
            bench={[]}
          />

          {publicado && seed ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await unpublishTeamOfWeek(seed.id);
                    toast.success("Vuelto a borrador");
                  } catch {
                    toast.error("No se pudo despublicar");
                  }
                })
              }
            >
              <Undo2 aria-hidden /> Borrador
            </Button>
          ) : null}
        </div>

        {publicado ? (
          <p className="flex items-center gap-1.5 text-xs text-volt">
            <Check className="size-3.5" aria-hidden />
            Publicado — ya se ve en la web y se avisó.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
