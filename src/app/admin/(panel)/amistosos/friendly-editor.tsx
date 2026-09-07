"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { guardarLado } from "./actions";

/** Alguien que se puede poner en la cancha. La clave lleva prefijo
 *  porque conviven dos orígenes: `p:` es de la base y trae foto, `g:`
 *  es un invitado que solo existe en este partido. */
export interface Persona {
  key: string;
  name: string;
  photoUrl: string | null;
}

export interface LadoSeed {
  sideId: string;
  friendlyId: string;
  name: string;
  color: string | null;
  formation: string;
  notes: string | null;
  /** key → { line, slot, isStarter } */
  slots: Record<string, { line: LineupLine; slot: number; isStarter: boolean }>;
  /** Invitados ya guardados en este lado. */
  invitados: Persona[];
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

const SIN_ASIGNAR = "";

// El <select> nativo abre el picker del sistema en el celular, que es
// donde esto se va a usar. Misma clase que el editor del torneo.
const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

export function FriendlyEditor({
  seed,
  convocables,
  rivalName,
  when,
  venue,
  /** Claves de gente ya puesta en el OTRO lado: nadie juega para los dos. */
  ocupadosEnElOtroLado,
}: {
  seed: LadoSeed;
  convocables: Persona[];
  rivalName: string;
  when: string;
  venue: string;
  ocupadosEnElOtroLado: string[];
}) {
  const [nombre, setNombre] = useState(seed.name);
  const [color, setColor] = useState(seed.color ?? "#4FA8FF");
  const [formation, setFormation] = useState(seed.formation);
  const [notes, setNotes] = useState(seed.notes ?? "");
  const [invitados, setInvitados] = useState<Persona[]>(seed.invitados);
  const [nuevoInvitado, setNuevoInvitado] = useState("");
  const [pending, startTransition] = useTransition();

  const [asignados, setAsignados] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const [key, pos] of Object.entries(seed.slots)) {
      if (pos.isStarter) inicial[`${pos.line}:${pos.slot}`] = key;
    }
    return inicial;
  });
  const [banca, setBanca] = useState<string[]>(() =>
    Object.entries(seed.slots)
      .filter(([, pos]) => !pos.isStarter)
      .map(([key]) => key),
  );

  const casillas = useMemo(() => casillasDe(formation), [formation]);

  // A diferencia del torneo, aquí el plantel no está dado: la gente se
  // convoca al ponerla. Por eso el "pool" son todos los de la base más
  // los invitados de este lado.
  const pool = useMemo(
    () => [...convocables, ...invitados],
    [convocables, invitados],
  );
  const nombreDe = (key: string) =>
    pool.find((p) => p.key === key)?.name ?? "—";

  const titulares = useMemo(
    () => new Set(Object.values(asignados).filter(Boolean)),
    [asignados],
  );
  const bloqueados = useMemo(
    () => new Set([...ocupadosEnElOtroLado, ...banca]),
    [ocupadosEnElOtroLado, banca],
  );

  function asignar(key: string, personaKey: string) {
    setAsignados((prev) => {
      const next = { ...prev };
      if (personaKey === SIN_ASIGNAR) {
        delete next[key];
        return next;
      }
      for (const [k, v] of Object.entries(next)) {
        if (v === personaKey) delete next[k];
      }
      next[key] = personaKey;
      return next;
    });
  }

  function agregarInvitado() {
    const name = nuevoInvitado.trim();
    if (!name) return;
    // El id solo vive en el navegador hasta que se guarda: en la base la
    // identidad del invitado es su nombre, no una fila de players.
    setInvitados((prev) => [
      ...prev,
      { key: `g:${crypto.randomUUID()}`, name, photoUrl: null },
    ]);
    setNuevoInvitado("");
  }

  const lines = formationLines(formation);
  const filas = useMemo(() => {
    // Las casillas vacías van como null: filtrarlas correría al resto y
    // dibujaría una formación que no es.
    const porLinea = (line: LineupLine, count: number) =>
      Array.from({ length: count }, (_, i) => {
        const key = asignados[`${line}:${i}`];
        if (!key) return null;
        const p = pool.find((x) => x.key === key);
        return { name: p?.name ?? "—", photoUrl: p?.photoUrl ?? null };
      });
    return [
      { width: 1, players: porLinea("gk", 1) },
      { width: lines.def, players: porLinea("def", lines.def) },
      { width: lines.mid, players: porLinea("mid", lines.mid) },
      { width: lines.fwd, players: porLinea("fwd", lines.fwd) },
    ];
  }, [asignados, lines, pool]);

  const nombresDe = (players: ({ name: string } | null)[]) =>
    players.filter((p): p is { name: string } => p !== null).map((p) => p.name);

  const whatsapp = buildLineupMessage({
    teamName: nombre,
    rivalName,
    when,
    venue,
    formation,
    lines: [
      { label: "Arquero", players: nombresDe(filas[0].players) },
      { label: "Defensa", players: nombresDe(filas[1].players) },
      { label: "Mediocampo", players: nombresDe(filas[2].players) },
      { label: "Delantera", players: nombresDe(filas[3].players) },
    ],
    bench: banca.map(nombreDe),
    notes: notes.trim() || null,
  });

  function entradas() {
    const deKey = (key: string, line: LineupLine, slot: number, starter: boolean) => {
      const esInvitado = key.startsWith("g:");
      return {
        player_id: esInvitado ? null : key.slice(2),
        guest_name: esInvitado ? nombreDe(key) : null,
        line,
        slot,
        is_starter: starter,
      };
    };
    const enCancha = casillas
      .map((c) => {
        const key = asignados[`${c.line}:${c.slot}`];
        return key ? deKey(key, c.line, c.slot, true) : null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
    const enBanca = banca.map((key) => deKey(key, "mid", 0, false));
    return [...enCancha, ...enBanca];
  }

  function guardar() {
    startTransition(async () => {
      try {
        await guardarLado({
          sideId: seed.sideId,
          friendlyId: seed.friendlyId,
          name: nombre.trim(),
          color,
          formation,
          notes: notes.trim() || null,
          entries: entradas(),
        });
        toast.success(`${nombre} guardado`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo guardar",
        );
      }
    });
  }

  const puestos = Object.values(asignados).filter(Boolean).length;
  const disponiblesBanca = pool.filter(
    (p) => !titulares.has(p.key) && !bloqueados.has(p.key),
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor={`nombre-${seed.sideId}`}>Nombre del lado</Label>
          <Input
            id={`nombre-${seed.sideId}`}
            value={nombre}
            maxLength={40}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`color-${seed.sideId}`}>Color</Label>
          <input
            id={`color-${seed.sideId}`}
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-full min-w-16 cursor-pointer rounded-md border border-input bg-transparent"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`formacion-${seed.sideId}`}>Formación</Label>
          <select
            id={`formacion-${seed.sideId}`}
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
        <div className="space-y-1.5">
          <Label htmlFor={`notas-${seed.sideId}`}>Nota (opcional)</Label>
          <Textarea
            id={`notas-${seed.sideId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="Llegar 15 minutos antes, camiseta oscura…"
          />
        </div>
      </div>

      {/* Invitado: el que no está inscrito y no tiene fila en players */}
      <div className="space-y-1.5">
        <Label htmlFor={`invitado-${seed.sideId}`}>Agregar invitado</Label>
        <div className="flex gap-2">
          <Input
            id={`invitado-${seed.sideId}`}
            value={nuevoInvitado}
            maxLength={40}
            placeholder="Nombre de quien no está inscrito"
            onChange={(e) => setNuevoInvitado(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregarInvitado();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={agregarInvitado}
            disabled={!nuevoInvitado.trim()}
          >
            <UserPlus aria-hidden />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Queda disponible en las listas de abajo. Sale con sus iniciales,
          porque no tiene foto en la base.
        </p>
      </div>

      {/* Casillas de la cancha, de delantera a arquero */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Titulares</Label>
          <span
            className={cn(
              "text-xs",
              puestos === casillas.length ? "text-volt" : "text-muted-foreground",
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
              <div className="grid gap-2 sm:grid-cols-2">
                {delLinea.map((c) => {
                  const key = `${c.line}:${c.slot}`;
                  const value = asignados[key] ?? SIN_ASIGNAR;
                  // El que ya está puesto sale de las otras listas: se ve
                  // de un vistazo quién falta y no se mueve sin querer.
                  const disponibles = pool.filter(
                    (p) =>
                      p.key === value ||
                      (!titulares.has(p.key) && !bloqueados.has(p.key)),
                  );
                  return (
                    <select
                      key={key}
                      className={selectClass}
                      value={value}
                      aria-label={c.label}
                      onChange={(e) => asignar(key, e.target.value)}
                    >
                      <option value={SIN_ASIGNAR}>— {c.label} —</option>
                      {disponibles.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.name}
                          {p.key.startsWith("g:") ? " (inv.)" : ""}
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

      {/* Suplentes: acá SÍ se eligen, porque el plantel no está dado */}
      <div className="space-y-1.5">
        <Label htmlFor={`banca-${seed.sideId}`}>Suplentes</Label>
        <select
          id={`banca-${seed.sideId}`}
          className={selectClass}
          value={SIN_ASIGNAR}
          onChange={(e) => {
            const key = e.target.value;
            if (key) setBanca((prev) => [...prev, key]);
          }}
        >
          <option value={SIN_ASIGNAR}>— Agregar a la banca —</option>
          {disponiblesBanca.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
              {p.key.startsWith("g:") ? " (inv.)" : ""}
            </option>
          ))}
        </select>
        {banca.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {banca.map((key) => (
              <span
                key={key}
                className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs"
              >
                {nombreDe(key)}
                <button
                  type="button"
                  aria-label={`Quitar a ${nombreDe(key)}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setBanca((prev) => prev.filter((k) => k !== key))
                  }
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Button onClick={guardar} disabled={pending || !nombre.trim()}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Save aria-hidden />
          )}
          Guardar
        </Button>

        <ShareTextButton text={whatsapp} title="Compartir por WhatsApp" />

        <LineupPieceButton
          eyebrow={`Amistoso · ${when}`}
          team={{ name: nombre, color, crestUrl: null }}
          formation={formation}
          rows={filas}
          bench={banca.map(nombreDe)}
        />
      </div>
    </div>
  );
}
