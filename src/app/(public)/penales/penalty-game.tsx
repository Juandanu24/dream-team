"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Goalkeeper } from "@/components/goalkeeper";
import { SoccerBall } from "@/components/soccer-ball";
import { celebrate } from "@/lib/confetti";
import {
  GOAL,
  SHOTS_PER_ROUND,
  ZONES,
  zoneRect,
  chooseKeeperZone,
  emptyTendencies,
  outcomeLabel,
  resolveShot,
  scoreComment,
  type ShotOutcome,
  type Tendencies,
  type Zone,
} from "@/lib/penalty-game";
import type { PenaltyLeaderboardRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { savePenaltyScore } from "./actions";

// El arquero se mueve de lado a lado; el pateador puede aprovechar
// el momento en que queda abierto de un palo.
const SHUFFLE_PERIOD_MS = 1650;
const SHUFFLE_RANGE = 19; // % de la escena a cada lado del centro
const BALL_FLIGHT_MS = 500;
const RESULT_MS = 850;

// El arquero se para sobre la línea de gol y se estira hacia arriba al
// volar. Las posiciones salen de la geometría del arco para que su
// vuelo termine justo sobre la zona a la que se lanza.
const KEEPER_HOME_Y = GOAL.top + GOAL.height * 0.77;
// Al volar arriba sube, pero no tanto que se salga del travesaño.
const KEEPER_DIVE_Y = [
  GOAL.top + GOAL.height * 0.58,
  GOAL.top + GOAL.height * 0.87,
];

function keeperXAt(time: number) {
  const phase = (time % SHUFFLE_PERIOD_MS) / SHUFFLE_PERIOD_MS;
  return 50 + Math.sin(phase * Math.PI * 2) * SHUFFLE_RANGE;
}

export interface GamePlayer {
  id: string;
  name: string;
  photoUrl: string | null;
}

type Phase = "aiming" | "shooting" | "result" | "finished";

export function PenaltyGame({
  players,
  leaderboard,
}: {
  players: GamePlayer[];
  leaderboard: PenaltyLeaderboardRow[];
}) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [phase, setPhase] = useState<Phase>("aiming");
  const [results, setResults] = useState<ShotOutcome[]>([]);
  const [lastOutcome, setLastOutcome] = useState<ShotOutcome | null>(null);
  const [ballZone, setBallZone] = useState<Zone | null>(null);
  const [saving, setSaving] = useState(false);

  const tendencies = useRef<Tendencies>(emptyTendencies());
  const keeperRef = useRef<HTMLDivElement>(null);
  const netRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const player = players.find((p) => p.id === playerId) ?? null;
  const personalBest =
    leaderboard.find((row) => row.player_id === playerId)?.best_score ?? null;
  const score = results.filter((r) => r === "goal").length;

  // Vaivén del arquero: se escribe directo en el DOM para no
  // re-renderizar 60 veces por segundo.
  useEffect(() => {
    if (phase !== "aiming") return;
    let frame = 0;
    const loop = (time: number) => {
      const el = keeperRef.current;
      if (el) {
        el.style.transition = "none";
        el.style.left = `${keeperXAt(time)}%`;
        el.style.top = `${KEEPER_HOME_Y}%`;
        el.style.transform = "translate(-50%, -50%) rotate(0deg)";
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  function shoot(zone: Zone) {
    if (phase !== "aiming") return;

    // La posición que vale es la que el jugador está viendo.
    const keeperX = parseFloat(keeperRef.current?.style.left ?? "50") || 50;
    const keeperZone = chooseKeeperZone(keeperX, tendencies.current);
    const outcome = resolveShot(zone, keeperZone);
    tendencies.current[zone.id] += 1;

    setPhase("shooting");
    setBallZone(zone);

    // El arquero se lanza a la zona que eligió.
    const keeper = keeperRef.current;
    if (keeper) {
      const dive = keeperZone.col === 1 ? 0 : keeperZone.col === 0 ? -55 : 55;
      keeper.style.transition =
        "left 300ms cubic-bezier(.2,.9,.3,1), top 300ms ease-out, transform 300ms ease-out";
      keeper.style.left = `${keeperZone.x}%`;
      keeper.style.top = `${KEEPER_DIVE_Y[keeperZone.row]}%`;
      keeper.style.transform = `translate(-50%, -50%) rotate(${dive}deg)`;
    }

    timers.current.push(
      window.setTimeout(() => {
        setLastOutcome(outcome);
        setPhase("result");
        if (outcome === "goal" && netRef.current) {
          netRef.current.classList.remove("animate-net-shake");
          void netRef.current.offsetWidth; // reinicia la animación
          netRef.current.classList.add("animate-net-shake");
        }
      }, BALL_FLIGHT_MS),
    );

    timers.current.push(
      window.setTimeout(() => {
        const nextResults = [...results, outcome];
        setResults(nextResults);
        setLastOutcome(null);
        setBallZone(null);
        if (nextResults.length >= SHOTS_PER_ROUND) {
          finish(nextResults);
        } else {
          setPhase("aiming");
        }
      }, BALL_FLIGHT_MS + RESULT_MS),
    );
  }

  function finish(finalResults: ShotOutcome[]) {
    const finalScore = finalResults.filter((r) => r === "goal").length;
    setPhase("finished");
    if (finalScore >= 4) celebrate();

    if (!playerId) return;

    setSaving(true);
    savePenaltyScore(playerId, finalScore)
      .then((result) => {
        if (result.ok) {
          toast.success("Puntaje guardado en el ranking");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      })
      .catch(() => toast.error("No pudimos guardar tu puntaje"))
      .finally(() => setSaving(false));
  }

  function reset() {
    clearTimers();
    tendencies.current = emptyTendencies();
    setResults([]);
    setLastOutcome(null);
    setBallZone(null);
    setPhase("aiming");
  }

  const ballLeft = ballZone ? ballZone.x : 50;
  const ballTop = ballZone ? ballZone.y : 88;

  return (
    <div className="space-y-4">
      {/* Quién patea */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1 space-y-2">
          <Label htmlFor="penal-jugador">¿Quién patea?</Label>
          <select
            id="penal-jugador"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            disabled={phase !== "aiming" || results.length > 0}
            className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 [&>option]:bg-popover"
          >
            <option value="">Invitado (no guarda ranking)</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {personalBest !== null ? (
          <p className="flex items-center gap-1.5 pb-2 text-sm text-muted-foreground">
            <Trophy className="size-4 text-volt" aria-hidden />
            Tu récord:{" "}
            <span className="font-display text-lg text-volt">{personalBest}</span>
            /{SHOTS_PER_ROUND}
          </p>
        ) : null}
      </div>

      {/* Escena */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-[#0b1626] via-[#123021] to-[#1c4a2c] select-none sm:aspect-[16/10]">
        {/* Césped */}
        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-b from-[#1f5c33] to-[#0f3a20]" />
        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[repeating-linear-gradient(90deg,rgb(255_255_255/4%)_0_8%,transparent_8%_16%)]" />

        {/* Arco */}
        <div
          ref={netRef}
          className="bg-net absolute top-[8%] left-1/2 h-[48%] w-[84%] -translate-x-1/2 rounded-t-sm border-4 border-b-0 border-white/85 bg-black/25"
        />

        {/* Arquero */}
        <div
          ref={keeperRef}
          style={{ top: `${KEEPER_HOME_Y}%` }}
          className="absolute left-1/2 h-[42%] w-[21%] -translate-x-1/2 -translate-y-1/2 text-white/90"
        >
          <Goalkeeper />
        </div>

        {/* Zonas para apuntar: se dibujan sobre el rectángulo exacto de
            cada celda y se ven siempre, para poder apuntar en el celular */}
        {ZONES.map((zone) => {
          const rect = zoneRect(zone);
          return (
            <button
              key={zone.id}
              type="button"
              disabled={phase !== "aiming"}
              onClick={() => shoot(zone)}
              aria-label={`Patear: ${zone.label}`}
              style={{
                left: `${rect.left}%`,
                top: `${rect.top}%`,
                width: `${rect.width}%`,
                height: `${rect.height}%`,
              }}
              className={cn(
                "absolute rounded-sm border transition",
                phase === "aiming"
                  ? "border-white/25 hover:border-volt hover:bg-volt/20 focus-visible:border-volt focus-visible:bg-volt/20 focus-visible:outline-none active:bg-volt/35"
                  : "pointer-events-none border-transparent",
              )}
            />
          );
        })}

        {/* Balón */}
        <div
          className="absolute z-10 text-white"
          style={{
            left: `${ballLeft}%`,
            top: `${ballTop}%`,
            width: ballZone ? "7%" : "12%",
            transform: "translate(-50%, -50%)",
            transition: ballZone
              ? `left ${BALL_FLIGHT_MS}ms cubic-bezier(.3,.1,.5,1), top ${BALL_FLIGHT_MS}ms cubic-bezier(.3,0,.6,.9), width ${BALL_FLIGHT_MS}ms ease-out`
              : "none",
          }}
        >
          <SoccerBall
            className={cn(
              "size-full drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]",
              phase === "shooting" && "animate-[spin_0.5s_linear_infinite]",
            )}
          />
        </div>

        {/* Punto penal */}
        <div className="absolute bottom-[6%] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-white/70" />

        {/* Resultado del disparo */}
        {lastOutcome ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <p
              className={cn(
                "animate-pop font-display text-6xl tracking-wide drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] sm:text-8xl",
                lastOutcome === "goal" ? "text-volt" : "text-white",
              )}
            >
              {outcomeLabel(lastOutcome)}
            </p>
          </div>
        ) : null}

        {/* Marcador de la tanda */}
        <div className="absolute top-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {Array.from({ length: SHOTS_PER_ROUND }, (_, i) => {
            const result = results[i];
            return (
              <span
                key={i}
                className={cn(
                  "size-3 rounded-full border",
                  result === "goal"
                    ? "border-volt bg-volt"
                    : result
                      ? "border-white/60 bg-white/25"
                      : "border-white/40 bg-transparent",
                )}
                title={result ? outcomeLabel(result) : "Por patear"}
              />
            );
          })}
        </div>

        {/* Pantalla final */}
        {phase === "finished" ? (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-center backdrop-blur-sm">
            <p className="font-display text-7xl text-volt sm:text-8xl">
              {score}/{SHOTS_PER_ROUND}
            </p>
            <p className="max-w-sm text-sm text-white/90">{scoreComment(score)}</p>
            {player ? (
              <p className="flex items-center gap-2 text-xs text-white/70">
                <Avatar className="size-6">
                  <AvatarImage src={player.photoUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {player.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {saving ? "Guardando…" : `Guardado como ${player.name}`}
              </p>
            ) : (
              <p className="text-xs text-white/70">
                Elige tu nombre antes de patear para entrar al ranking.
              </p>
            )}
            <Button onClick={reset} className="mt-1">
              <RotateCcw aria-hidden /> Patear de nuevo
            </Button>
          </div>
        ) : null}
      </div>

      <Card className="border-border/60 bg-card/70">
        <CardContent className="px-5 py-2 text-sm text-muted-foreground">
          Toca la zona del arco a la que quieres patear. El arquero se mueve de
          lado a lado: aprovecha cuando se abra de un palo. Ojo, que{" "}
          <span className="text-volt">te va aprendiendo las mañas</span> — si
          siempre tiras al mismo lado, te la va a adivinar. Los ángulos altos
          son más difíciles de atajar, pero también más fáciles de mandar afuera.
        </CardContent>
      </Card>
    </div>
  );
}
