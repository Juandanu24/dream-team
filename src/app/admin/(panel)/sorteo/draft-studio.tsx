"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Dices,
  Loader2,
  Play,
  Plus,
  RotateCcw,

  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ShareTextButton } from "@/components/share-text-button";
import { TeamCrest } from "@/components/team-crest";
import { PlayerPhoto } from "@/components/player-photo";
import { nombreDeBombo } from "@/lib/draft-turn";
import type { DraftData, JugadorDelSorteo } from "@/lib/draft";
import {
  DRAFT_MODE_LABELS,
  DRAFT_ORDER_LABELS,
  POSITION_SHORT,
  type DraftMode,
  type DraftOrderMode,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  alternarParticipacion,
  arrancarSorteo,
  asignarBombo,
  avisarSorteo,
  borrarSorteo,
  cerrarSorteo,
  deshacerUltima,
  elegirJugador,
  reiniciarSorteo,
  guardarConfiguracion,
  siguienteRonda,
  sortearOrden,
} from "./actions";

const MAX_BOMBOS = 6;

export function DraftStudio({ data }: { data: DraftData }) {
  const [pending, startTransition] = useTransition();
  const { draft, equipos, disponibles, disponiblesEnLaRonda, picks } = data;
  const enSetup = draft.status === "setup";
  const corriendo = draft.status === "running";

  // El sorteo del orden y la elección se animan: el resultado ya viene
  // decidido del servidor y acá solo se revela.
  const [ruleta, setRuleta] = useState<string[] | null>(null);
  const [recienElegido, setRecienElegido] = useState<JugadorDelSorteo | null>(null);

  const correr = (fn: () => Promise<unknown>, exito?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (exito) toast.success(exito);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo");
      }
    });

  return (
    <div className="space-y-5">
      {ruleta ? (
        <RuletaDeOrden nombres={ruleta} onFin={() => setRuleta(null)} />
      ) : null}
      {recienElegido ? (
        <CartaElegido
          jugador={recienElegido}
          onFin={() => setRecienElegido(null)}
        />
      ) : null}

      {enSetup ? (
        <Configuracion data={data} pending={pending} correr={correr} />
      ) : null}

      <OrdenDeEleccion
        data={data}
        pending={pending}
        onSortear={() =>
          startTransition(async () => {
            try {
              const orden = await sortearOrden();
              const porId = new Map(equipos.map((e) => [e.teamId, e.name]));
              setRuleta(
                [...orden]
                  .sort((a, b) => a.position - b.position)
                  .map((o) => porId.get(o.teamId) ?? "—"),
              );
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "No se pudo");
            }
          })
        }
      />

      {enSetup && equipos.some((e) => e.position) ? (
        <Button
          size="lg"
          className="h-12 w-full rounded-full text-base font-semibold"
          disabled={pending}
          onClick={() => correr(arrancarSorteo, "¡Arrancó el sorteo!")}
        >
          <Play aria-hidden /> Arrancar el sorteo
        </Button>
      ) : null}

      {draft.mode === "pots" && enSetup ? (
        <Bombos data={data} pending={pending} correr={correr} />
      ) : null}

      {corriendo ? (
        <EnCurso
          data={data}
          pending={pending}
          correr={correr}
          onElegir={(j) =>
            startTransition(async () => {
              try {
                await elegirJugador(j.id);
                setRecienElegido(j);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "No se pudo elegir",
                );
              }
            })
          }
          onSiguienteRonda={() =>
            startTransition(async () => {
              try {
                const orden = await siguienteRonda();
                if (orden) {
                  const porId = new Map(equipos.map((e) => [e.teamId, e.name]));
                  setRuleta(
                    [...orden]
                      .sort((a, b) => a.position - b.position)
                      .map((o) => porId.get(o.teamId) ?? "—"),
                  );
                }
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "No se pudo");
              }
            })
          }
        />
      ) : null}

      {picks.length > 0 ? <Historial data={data} /> : null}

      <Avisos data={data} pending={pending} />

      <Card className="bg-card shadow-card ring-0">
        <CardContent className="flex flex-wrap items-center gap-2 px-4 sm:px-5">
          {corriendo ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => correr(cerrarSorteo, "Sorteo cerrado")}
            >
              Cerrar el sorteo
            </Button>
          ) : null}
          {picks.length > 0 ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    `¿Reiniciar? Vuelven al bombo los ${picks.length} jugadores elegidos en este sorteo. La nómina con la que cada equipo llegó NO se toca, y los bombos se conservan.`,
                  )
                )
                  return;
                startTransition(async () => {
                  try {
                    const n = await reiniciarSorteo();
                    toast.success(`${n} jugador(es) de vuelta al bombo`);
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "No se pudo",
                    );
                  }
                });
              }}
            >
              <RotateCcw aria-hidden /> Reiniciar (ensayo)
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  "¿Borrar el sorteo? Los jugadores ya repartidos se quedan en su equipo; se borra solo el proceso.",
                )
              )
                return;
              correr(borrarSorteo, "Sorteo borrado");
            }}
          >
            <Trash2 aria-hidden /> Borrar el sorteo
          </Button>
          <p className="text-xs text-muted-foreground">
            Quedan {disponibles.length} sin equipo
            {draft.mode === "pots"
              ? ` · ${disponiblesEnLaRonda.length} en el ${nombreDeBombo(draft.current_round)}`
              : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Configuración ----------

function Configuracion({
  data,
  pending,
  correr,
}: {
  data: DraftData;
  pending: boolean;
  correr: (fn: () => Promise<unknown>, exito?: string) => void;
}) {
  const { draft, equipos } = data;

  const guardar = (mode: DraftMode, order: DraftOrderMode) =>
    correr(() => guardarConfiguracion({ mode, order_mode: order }));

  return (
    <Card className="bg-card shadow-card ring-0">
      <CardContent className="space-y-5 px-4 sm:px-5">
        <div>
          <p className="font-display text-xl tracking-wide">CÓMO SE SORTEA</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(["pool", "pots"] as DraftMode[]).map((m) => (
              <button
                key={m}
                type="button"
                disabled={pending}
                onClick={() => guardar(m, draft.order_mode)}
                className={cn(
                  "rounded-xl p-4 text-left transition-colors",
                  draft.mode === m
                    ? "bg-volt text-volt-ink"
                    : "bg-surface-2 hover:bg-accent",
                )}
              >
                <span className="font-display text-lg tracking-wide">
                  {DRAFT_MODE_LABELS[m]}
                </span>
                <span className="mt-0.5 block text-xs opacity-80">
                  {m === "pool"
                    ? "Se elige de todos los que no tienen equipo"
                    : "Bombos armados antes, como en la Champions"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {draft.mode === "pots" ? (
          <div>
            <p className="font-display text-xl tracking-wide">EL ORDEN</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(["once", "per_round"] as DraftOrderMode[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  disabled={pending}
                  onClick={() => guardar(draft.mode, o)}
                  className={cn(
                    "rounded-xl p-4 text-left text-sm transition-colors",
                    draft.order_mode === o
                      ? "bg-dt-blue text-background"
                      : "bg-surface-2 hover:bg-accent",
                  )}
                >
                  {DRAFT_ORDER_LABELS[o]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="font-display text-xl tracking-wide">QUIÉN PARTICIPA</p>
          <p className="text-xs text-muted-foreground">
            Un equipo conforme con su nómina se puede quedar por fuera y volver
            a entrar antes de arrancar.
          </p>
          <div className="mt-3 space-y-2">
            {equipos.map((e) => (
              <label
                key={e.teamId}
                className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--volt)]"
                  checked={e.participates}
                  disabled={pending}
                  onChange={(ev) =>
                    correr(() =>
                      alternarParticipacion(e.teamId, ev.target.checked),
                    )
                  }
                />
                <TeamCrest
                  name={e.name}
                  color={e.color}
                  crestUrl={e.crestUrl}
                  className="size-6 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {e.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {e.jugadores} jugadores
                </span>
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Orden ----------

function OrdenDeEleccion({
  data,
  pending,
  onSortear,
}: {
  data: DraftData;
  pending: boolean;
  onSortear: () => void;
}) {
  const conPuesto = data.equipos.filter((e) => e.participates && e.position);

  return (
    <Card className="bg-card shadow-card ring-0">
      <CardContent className="px-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-xl tracking-wide">ORDEN DE ELECCIÓN</p>
          <Button
            variant={conPuesto.length ? "outline" : "default"}
            className={conPuesto.length ? "" : "rounded-full"}
            disabled={pending || data.draft.status === "finished"}
            onClick={onSortear}
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Dices aria-hidden />
            )}
            {conPuesto.length ? "Volver a sortear" : "Sortear el orden"}
          </Button>
        </div>

        {conPuesto.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía sin sortear. El orden se decide en el servidor y queda
            guardado: recargar no vuelve a tirar los dados.
          </p>
        ) : (
          <ol className="mt-3 flex flex-wrap gap-2">
            {conPuesto.map((e) => (
              <li
                key={e.teamId}
                className="flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pr-4 pl-2"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-volt font-display text-sm text-volt-ink tabular-nums">
                  {e.position}
                </span>
                <TeamCrest
                  name={e.name}
                  color={e.color}
                  crestUrl={e.crestUrl}
                  className="size-5 shrink-0"
                />
                <span className="text-sm font-medium">{e.name}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Bombos ----------

function Bombos({
  data,
  pending,
  correr,
}: {
  data: DraftData;
  pending: boolean;
  correr: (fn: () => Promise<unknown>, exito?: string) => void;
}) {
  const usados = [...new Set(data.disponibles.map((j) => j.pot ?? 0))].filter(
    (p) => p > 0,
  );
  const cuantos = Math.max(1, ...usados);
  const sinBombo = data.disponibles.filter((j) => !j.pot);

  return (
    <Card className="bg-card shadow-card ring-0">
      <CardContent className="space-y-4 px-4 sm:px-5">
        <div>
          <p className="font-display text-xl tracking-wide">LOS BOMBOS</p>
          <p className="text-xs text-muted-foreground">
            Arma los bombos antes de empezar: en el A los que más juegan, y así
            hasta el último. Cada vuelta se elige de un bombo.
          </p>
        </div>

        {sinBombo.length > 0 ? (
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs tracking-widest text-yellow-500 uppercase">
              Sin bombo · {sinBombo.length}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sinBombo.map((j) => (
                <ChipJugador
                  key={j.id}
                  jugador={j}
                  pending={pending}
                  bombos={cuantos}
                  onMover={(pot) => correr(() => asignarBombo(j.id, pot))}
                />
              ))}
            </div>
          </div>
        ) : null}

        {Array.from({ length: cuantos }, (_, i) => i + 1).map((pot) => {
          const dentro = data.disponibles.filter((j) => j.pot === pot);
          return (
            <div key={pot} className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs tracking-widest text-dt-blue uppercase">
                {nombreDeBombo(pot)} · {dentro.length}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {dentro.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Vacío</span>
                ) : (
                  dentro.map((j) => (
                    <ChipJugador
                      key={j.id}
                      jugador={j}
                      pending={pending}
                      bombos={cuantos}
                      onMover={(p) => correr(() => asignarBombo(j.id, p))}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}

        {cuantos < MAX_BOMBOS && sinBombo.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              correr(() => asignarBombo(sinBombo[0].id, cuantos + 1))
            }
          >
            <Plus aria-hidden /> Abrir {nombreDeBombo(cuantos + 1)}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ChipJugador({
  jugador,
  bombos,
  pending,
  onMover,
}: {
  jugador: JugadorDelSorteo;
  bombos: number;
  pending: boolean;
  onMover: (pot: number | null) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-card py-1 pr-1 pl-2.5 text-xs">
      {jugador.nombre}
      <select
        aria-label={`Bombo de ${jugador.nombre}`}
        className="rounded-full bg-transparent px-1 text-[11px] text-muted-foreground outline-none [&>option]:bg-popover"
        value={jugador.pot ?? ""}
        disabled={pending}
        onChange={(e) => onMover(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">—</option>
        {Array.from({ length: bombos }, (_, i) => i + 1).map((p) => (
          <option key={p} value={p}>
            {String.fromCharCode(64 + p)}
          </option>
        ))}
      </select>
    </span>
  );
}

// ---------- En curso ----------

function EnCurso({
  data,
  pending,
  correr,
  onElegir,
  onSiguienteRonda,
}: {
  data: DraftData;
  pending: boolean;
  correr: (fn: () => Promise<unknown>, exito?: string) => void;
  onElegir: (j: JugadorDelSorteo) => void;
  onSiguienteRonda: () => void;
}) {
  const { draft, turno, equipoEnTurno, disponiblesEnLaRonda, picks } = data;

  return (
    <Card className="sticky top-16 z-20 border border-volt/40 bg-card shadow-card ring-0 lg:top-4">
      <CardContent className="space-y-4 px-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              {draft.mode === "pots"
                ? nombreDeBombo(draft.current_round)
                : `Vuelta ${draft.current_round}`}
            </p>
            {equipoEnTurno ? (
              <>
                <p className="flex items-center gap-2 font-display text-3xl tracking-wide">
                  <TeamCrest
                    name={equipoEnTurno.name}
                    color={equipoEnTurno.color}
                    crestUrl={equipoEnTurno.crestUrl}
                    className="size-8 shrink-0"
                  />
                  {equipoEnTurno.name.toUpperCase()}
                </p>
                {equipoEnTurno.capitan ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Elige {equipoEnTurno.capitan}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="font-display text-2xl tracking-wide text-muted-foreground">
                RONDA COMPLETA
              </p>
            )}
          </div>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            {picks.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-11"
                disabled={pending}
                onClick={() => correr(deshacerUltima, "Elección deshecha")}
              >
                <Undo2 aria-hidden /> Deshacer
              </Button>
            ) : null}
            {turno.rondaCompleta ? (
              <Button
                className="h-11 flex-1 rounded-full sm:flex-none"
                disabled={pending}
                onClick={onSiguienteRonda}
              >
                <RotateCcw aria-hidden />
                {draft.mode === "pots" ? "Siguiente bombo" : "Siguiente vuelta"}
              </Button>
            ) : null}
          </div>
        </div>

        {turno.rondaCompleta ? (
          <p className="text-sm text-muted-foreground">
            {disponiblesEnLaRonda.length === 0
              ? "No quedan jugadores en esta ronda."
              : "Ya eligieron todos."}{" "}
            {data.disponibles.length === 0
              ? "El bombo quedó vacío: puedes cerrar el sorteo."
              : null}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Faltan {turno.faltanEnRonda} por elegir en esta ronda. Toca un
              jugador para asignarlo.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {disponiblesEnLaRonda.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  disabled={pending}
                  onClick={() => onElegir(j)}
                  className="flex min-h-14 items-center gap-3 rounded-xl bg-surface-2 p-2.5 text-left transition-transform active:scale-[0.98] disabled:opacity-50 sm:hover:-translate-y-0.5"
                >
                  <PlayerPhoto
                    src={j.photoUrl}
                    alt={j.nombre}
                    offsetY={0.16}
                    fallback={j.nombre.slice(0, 2).toUpperCase()}
                    className="size-12 shrink-0 rounded-lg"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium">
                      {j.nombre}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {POSITION_SHORT[j.position]} · {j.memberSince}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Historial ----------

function Historial({ data }: { data: DraftData }) {
  return (
    <Card className="bg-card shadow-card ring-0">
      <CardContent className="px-4 sm:px-5">
        <p className="font-display text-xl tracking-wide">
          LO QUE VA ({data.picks.length})
        </p>
        <ol className="mt-3 space-y-1.5">
          {[...data.picks].reverse().map((p) => (
            <li key={p.pickNumber} className="flex items-center gap-2.5 text-sm">
              <span className="w-6 shrink-0 text-right font-display text-muted-foreground tabular-nums">
                {p.pickNumber}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {p.jugador.nombre}
              </span>
              <span className="shrink-0 truncate text-xs text-muted-foreground">
                → {p.teamName}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ---------- Avisos ----------

function Avisos({ data, pending }: { data: DraftData; pending: boolean }) {
  const equiposEnJuego = data.equipos.filter((e) => e.participates);
  const [mensaje, setMensaje] = useState(
    `🎲 ¡Arranca el sorteo del Dream Team!\n\n${data.disponibles.length} jugadores al bombo y ${equiposEnJuego.length} equipos eligiendo.\n\nSíguelo en vivo acá 👇\nhttps://dreamteamcolombia.vercel.app/sorteo`,
  );
  const [enviando, setEnviando] = useState(false);

  return (
    <Card className="bg-card shadow-card ring-0">
      <CardContent className="space-y-3 px-4 sm:px-5">
        <div>
          <p className="font-display text-xl tracking-wide">AVISAR</p>
          <p className="text-xs text-muted-foreground">
            El push lleva solo la primera línea; WhatsApp lleva el mensaje
            completo. Puedes editarlo antes de mandarlo.
          </p>
        </div>
        <Textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          rows={6}
          className="text-sm"
          aria-label="Mensaje del aviso"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending || enviando}
            onClick={async () => {
              if (!confirm("¿Mandar el push a todos los suscritos?")) return;
              setEnviando(true);
              try {
                const n = await avisarSorteo(mensaje.split("\n")[0]);
                toast.success(`Aviso enviado a ${n} dispositivo(s)`);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "No se pudo enviar",
                );
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Mandar push
          </Button>
          <ShareTextButton text={mensaje} label="Compartir por WhatsApp" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Animaciones ----------

/** La ruleta del orden: los nombres pasan rápido y se van clavando de
 *  arriba hacia abajo. El resultado ya viene del servidor; esto solo lo
 *  revela, que es lo que lo hace un sorteo y no una tragamonedas. */
function RuletaDeOrden({
  nombres,
  onFin,
}: {
  nombres: string[];
  onFin: () => void;
}) {
  const [revelados, setRevelados] = useState(0);
  const [ruleta, setRuleta] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const giro = window.setInterval(
      () => setRuleta((n) => (n + 1) % nombres.length),
      70,
    );
    timers.current.push(giro);
    nombres.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => setRevelados(i + 1), 700 + i * 650),
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        window.clearInterval(giro);
        onFin();
      }, 900 + nombres.length * 650),
    );
    return () => {
      timers.current.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      timers.current = [];
    };
  }, [nombres, onFin]);

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/92 p-6">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs tracking-[0.3em] text-dt-blue uppercase">
          Orden de elección
        </p>
        <ol className="mt-5 space-y-2">
          {nombres.map((nombre, i) => {
            const listo = i < revelados;
            return (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300",
                  listo
                    ? "bg-volt text-volt-ink"
                    : "bg-surface-2 text-muted-foreground",
                )}
                style={{
                  transform: listo ? "scale(1)" : "scale(0.97)",
                  opacity: listo ? 1 : 0.65,
                }}
              >
                <span className="font-display text-2xl tabular-nums">
                  {i + 1}
                </span>
                <span className="font-display text-xl tracking-wide">
                  {listo ? nombre : nombres[(ruleta + i) % nombres.length]}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** El jugador elegido, en grande. La carta entra girando y se asienta,
 *  que es el momento que la gente quiere ver en un sorteo en vivo. */
function CartaElegido({
  jugador,
  onFin,
}: {
  jugador: JugadorDelSorteo;
  onFin: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onFin, 2600);
    return () => window.clearTimeout(t);
  }, [onFin]);

  return (
    <button
      type="button"
      onClick={onFin}
      aria-label="Cerrar"
      className="fixed inset-0 z-100 flex items-center justify-center bg-background/92 p-6"
    >
      <div className="animate-pop text-center">
        <PlayerPhoto
          src={jugador.photoUrl}
          alt={jugador.nombre}
          offsetY={0.16}
          fallback={jugador.nombre.slice(0, 2).toUpperCase()}
          className="mx-auto size-44 rounded-2xl shadow-card ring-2 ring-volt"
        />
        <p className="mt-5 font-display text-5xl tracking-wide text-volt-text">
          {jugador.nombre.toUpperCase()}
        </p>
        <p className="mt-1 text-sm tracking-widest text-muted-foreground uppercase">
          {POSITION_SHORT[jugador.position]} · elegido
        </p>
      </div>
    </button>
  );
}
