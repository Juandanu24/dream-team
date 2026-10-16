"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerCard } from "@/components/player-card";
import { nombreDeBombo } from "@/lib/draft-turn";
import type { JugadorDelSorteo } from "@/lib/draft";
import { FOOT_LABELS, POSITION_SHORT } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BOMBOS = 6;
/** Cuánto hay que sostener el dedo antes de que empiece a arrastrar.
 *  Sin esta espera, cualquier intento de bajar la página levantaría una
 *  carta. */
const ESPERA_TACTIL = 220;
/** Píxeles de movimiento antes de considerar que es un arrastre y no un
 *  toque mal dado. */
const UMBRAL = 7;

type Zona = number | "sin";

/** Armar los bombos arrastrando las cartas.
 *
 *  Funciona con mouse y con dedo usando Pointer Events, que es lo mismo
 *  para los dos, en vez del arrastre nativo de HTML5, que en táctil
 *  sencillamente no dispara. En el celular hay que SOSTENER un momento
 *  antes de que la carta se despegue: si empezara al primer movimiento,
 *  bajar la página sería imposible.
 *
 *  El `<select>` de cada carta se queda, y no es redundante: arrastrar
 *  no se puede hacer con teclado ni con lector de pantalla, así que
 *  tiene que existir el otro camino. */
export function PotsEditor({
  jugadores,
  pending,
  onMover,
}: {
  jugadores: JugadorDelSorteo[];
  pending: boolean;
  onMover: (playerId: string, pot: number | null) => void;
}) {
  const usados = jugadores.map((j) => j.pot ?? 0).filter((p) => p > 0);
  const [extra, setExtra] = useState(0);
  const cuantos = Math.min(MAX_BOMBOS, Math.max(1, ...usados, 1) + extra);

  const [arrastrando, setArrastrando] = useState<JugadorDelSorteo | null>(null);
  const [punto, setPunto] = useState<{ x: number; y: number } | null>(null);
  const [encima, setEncima] = useState<Zona | null>(null);
  const zonas = useRef(new Map<Zona, HTMLElement>());
  const inicio = useRef<{ x: number; y: number; listo: boolean } | null>(null);
  const espera = useRef<number | null>(null);

  // Mientras se arrastra con el dedo hay que bloquear el scroll, y eso
  // solo se puede desde un listener NO pasivo: React los registra como
  // pasivos y ahí `preventDefault()` no hace nada.
  useEffect(() => {
    if (!arrastrando) return;
    const frenar = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", frenar, { passive: false });
    return () => document.removeEventListener("touchmove", frenar);
  }, [arrastrando]);

  function zonaBajo(x: number, y: number): Zona | null {
    for (const [zona, el] of zonas.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return zona;
      }
    }
    return null;
  }

  function soltar() {
    if (espera.current) window.clearTimeout(espera.current);
    espera.current = null;
    if (arrastrando && encima !== null) {
      const destino = encima === "sin" ? null : encima;
      if ((arrastrando.pot ?? null) !== destino) {
        onMover(arrastrando.id, destino);
      }
    }
    inicio.current = null;
    setArrastrando(null);
    setPunto(null);
    setEncima(null);
  }

  const handlers = (j: JugadorDelSorteo) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (pending) return;
      inicio.current = { x: e.clientX, y: e.clientY, listo: e.pointerType === "mouse" };
      if (e.pointerType !== "mouse") {
        espera.current = window.setTimeout(() => {
          if (inicio.current) inicio.current.listo = true;
        }, ESPERA_TACTIL);
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const i = inicio.current;
      if (!i) return;
      const lejos =
        Math.hypot(e.clientX - i.x, e.clientY - i.y) > UMBRAL;
      if (!i.listo) {
        // Se movió antes de sostener: es un scroll, no un arrastre.
        if (lejos) {
          if (espera.current) window.clearTimeout(espera.current);
          inicio.current = null;
        }
        return;
      }
      if (!arrastrando && lejos) {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setArrastrando(j);
      }
      if (arrastrando || lejos) {
        setPunto({ x: e.clientX, y: e.clientY });
        setEncima(zonaBajo(e.clientX, e.clientY));
      }
    },
    onPointerUp: soltar,
    onPointerCancel: soltar,
  });

  const sinBombo = jugadores.filter((j) => !j.pot);

  const carta = (j: JugadorDelSorteo) => (
    <div
      key={j.id}
      {...handlers(j)}
      className={cn(
        "w-[104px] shrink-0 cursor-grab touch-manipulation select-none",
        arrastrando?.id === j.id && "opacity-35",
      )}
    >
      <PlayerCard
        name={j.nombre}
        age={j.age}
        positionShort={POSITION_SHORT[j.position]}
        footLabel={FOOT_LABELS[j.foot]}
        memberSince={j.memberSince}
        heightCm={j.heightCm}
        photoUrl={j.photoUrl}
        compact
        className="pointer-events-none max-w-none"
      />
      <select
        aria-label={`Bombo de ${j.nombre}`}
        className="mt-1 w-full rounded-md bg-surface-2 px-1 py-1 text-[11px] outline-none [&>option]:bg-popover"
        value={j.pot ?? ""}
        disabled={pending}
        onChange={(e) =>
          onMover(j.id, e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">Sin bombo</option>
        {Array.from({ length: cuantos }, (_, i) => i + 1).map((p) => (
          <option key={p} value={p}>
            {nombreDeBombo(p)}
          </option>
        ))}
      </select>
    </div>
  );

  const zona = (clave: Zona, titulo: string, dentro: JugadorDelSorteo[]) => (
    <div
      ref={(el) => {
        if (el) zonas.current.set(clave, el);
        else zonas.current.delete(clave);
      }}
      className={cn(
        "rounded-xl border-2 border-dashed p-3 transition-colors",
        encima === clave && arrastrando
          ? "border-volt bg-volt/10"
          : "border-separator-strong bg-surface-2",
      )}
    >
      <p className="text-xs tracking-widest text-dt-blue uppercase">
        {titulo} · {dentro.length}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {dentro.length === 0 ? (
          <span className="py-4 text-xs text-muted-foreground">
            {arrastrando ? "Suelta acá" : "Vacío"}
          </span>
        ) : (
          dentro.map(carta)
        )}
      </div>
    </div>
  );

  return (
    <Card className="bg-card shadow-card ring-0">
      <CardContent className="space-y-4 px-4 sm:px-5">
        <div>
          <p className="font-display text-xl tracking-wide">LOS BOMBOS</p>
          <p className="text-xs text-muted-foreground">
            Arrastra las cartas a los bombos de abajo. En el A los que más
            juegan, y así hasta el último. En el celular, sostén la carta un
            momento antes de moverla. También puedes usar el selector de cada
            carta.
          </p>
        </div>

        {zona("sin", "Sin bombo", sinBombo)}

        {Array.from({ length: cuantos }, (_, i) => i + 1).map((pot) =>
          zona(
            pot,
            nombreDeBombo(pot),
            jugadores.filter((j) => j.pot === pot),
          ),
        )}

        {cuantos < MAX_BOMBOS ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setExtra((n) => n + 1)}
          >
            <Plus aria-hidden /> Abrir {nombreDeBombo(cuantos + 1)}
          </Button>
        ) : null}
      </CardContent>

      {/* La carta que sigue al dedo. Va fuera del flujo y sin capturar
          eventos, para que el que está debajo sí reciba el puntero. */}
      {arrastrando && punto ? (
        <div
          className="pointer-events-none fixed z-100 w-[104px] -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{ left: punto.x, top: punto.y }}
        >
          <PlayerCard
            name={arrastrando.nombre}
            age={arrastrando.age}
            positionShort={POSITION_SHORT[arrastrando.position]}
            footLabel={FOOT_LABELS[arrastrando.foot]}
            memberSince={arrastrando.memberSince}
            heightCm={arrastrando.heightCm}
            photoUrl={arrastrando.photoUrl}
            compact
            className="max-w-none"
          />
        </div>
      ) : null}
    </Card>
  );
}
