"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  Dices,
  Loader2,
  Play,
  Plus,
  RotateCcw,

  Trash2,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ShareTextButton } from "@/components/share-text-button";
import { TeamCrest } from "@/components/team-crest";
import { readableAccent } from "@/lib/team-color";
import { PlayerPhoto } from "@/components/player-photo";
import { nombreDeBombo } from "@/lib/draft-turn";
import {
  cambiarSonido,
  sonarEleccion,
  sonidoActivo,
  suscribirSonido,
} from "@/lib/draft-sound";
import type {
  DraftData,
  EquipoDelSorteo,
  JugadorDelSorteo,
} from "@/lib/draft";
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
  const [recienElegido, setRecienElegido] = useState<{
    jugador: JugadorDelSorteo;
    equipo: EquipoDelSorteo;
  } | null>(null);

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
        <FichaElegido
          jugador={recienElegido.jugador}
          equipo={recienElegido.equipo}
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
                const destino = data.equipoEnTurno;
                await elegirJugador(j.id);
                sonarEleccion();
                if (destino) setRecienElegido({ jugador: j, equipo: destino });
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
        <CardContent className="space-y-3 px-4 sm:px-5">
          <p className="text-xs text-muted-foreground">
            Quedan {disponibles.length} sin equipo
            {draft.mode === "pots"
              ? ` · ${disponiblesEnLaRonda.length} en el ${nombreDeBombo(draft.current_round)}`
              : ""}
          </p>

          {corriendo ? (
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto"
              disabled={pending}
              onClick={() => correr(cerrarSorteo, "Sorteo cerrado")}
            >
              Cerrar el sorteo
            </Button>
          ) : null}

          {/* Los dos destruyen cosas distintas, así que cada uno dice en
              una línea qué pasa con los JUGADORES, que es lo único que
              de verdad los diferencia. */}
          <div className="grid gap-2 sm:grid-cols-2">
            {picks.length > 0 ? (
              <div className="rounded-xl bg-surface-2 p-3">
                <Button
                  variant="outline"
                  className="h-11 w-full"
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
                  <RotateCcw aria-hidden /> Reiniciar
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="text-foreground">
                    Los {picks.length} elegidos vuelven al bombo.
                  </span>{" "}
                  Se conservan los bombos y quién participa; se borra el orden.
                  Es lo que quieres después de un ensayo.
                </p>
              </div>
            ) : null}

            <div className="rounded-xl bg-surface-2 p-3">
              <Button
                variant="ghost"
                className="h-11 w-full text-muted-foreground hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  if (
                    !confirm(
                      picks.length > 0
                        ? `¿Borrar el sorteo? OJO: los ${picks.length} jugadores ya elegidos SE QUEDAN en su equipo. Si lo que quieres es deshacer un ensayo, usa Reiniciar.`
                        : "¿Borrar el sorteo? Se pierde la configuración y los bombos.",
                    )
                  )
                    return;
                  correr(borrarSorteo, "Sorteo borrado");
                }}
              >
                <Trash2 aria-hidden /> Borrar el sorteo
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="text-foreground">
                  Los jugadores se quedan donde quedaron.
                </span>{" "}
                Borra el proceso entero: configuración, bombos, orden e
                historial. Para cuando el sorteo real ya terminó.
              </p>
            </div>
          </div>
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
  // En el servidor no hay localStorage: el valor inicial es "con
  // sonido" y el real llega al hidratar, sin efectos ni parpadeo.
  const conSonido = useSyncExternalStore(
    suscribirSonido,
    sonidoActivo,
    () => true,
  );

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
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-11"
              title={conSonido ? "Silenciar" : "Activar sonido"}
              aria-pressed={conSonido}
              onClick={() => {
                const nuevo = !conSonido;
                cambiarSonido(nuevo);
                if (nuevo) sonarEleccion();
              }}
            >
              {conSonido ? (
                <Volume2 aria-label="Sonido activado" />
              ) : (
                <VolumeX aria-label="Sonido silenciado" />
              )}
            </Button>
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
            {/* Cuadrados en rejilla, no una lista.
                En una columna los veintiún nombres son mil cuatrocientos
                píxeles de scroll y para escoger hay que comparar, no
                leer en fila. A tres columnas se ven nueve de un golpe en
                un celular y cada cuadro sigue midiendo 114px de lado,
                muy por encima del mínimo táctil. Las cartas FIFA que ya
                existen se descartaron acá: son altas (proporción 0,7) y
                la rejilla quedaría MÁS larga que la lista. */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {disponiblesEnLaRonda.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  disabled={pending}
                  title={j.nombreCompleto}
                  onClick={() => onElegir(j)}
                  className="group/sel relative aspect-square overflow-hidden rounded-xl bg-surface-2 text-left transition-transform active:scale-[0.97] disabled:opacity-50 sm:hover:-translate-y-0.5"
                >
                  <PlayerPhoto
                    src={j.photoUrl}
                    alt=""
                    offsetY={0.16}
                    fallback={j.nombre.slice(0, 2).toUpperCase()}
                    className="absolute inset-0 size-full"
                  />
                  {/* Degradado para que el nombre se lea sobre cualquier
                      foto, clara u oscura. */}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-1.5 pt-5 pb-1.5">
                    <span className="block truncate text-[11px] leading-tight font-semibold text-white">
                      {j.nombre}
                    </span>
                  </span>
                  <span className="absolute top-1 left-1 rounded bg-black/55 px-1 text-[9px] font-semibold tracking-wider text-white uppercase">
                    {POSITION_SHORT[j.position]}
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
  // Agrupado por equipo y no en orden de elección: la pregunta que uno
  // se hace mirando esto es "¿a quién tiene cada uno?", y en una lista
  // corrida hay que leerla entera para responderla. El número de ronda
  // va al lado de cada nombre, que es lo que se pierde al agrupar.
  const porEquipo = data.equipos
    .map((e) => ({
      equipo: e,
      picks: data.picks.filter((p) => p.teamId === e.teamId),
    }))
    .filter((x) => x.picks.length > 0);

  return (
    <Card className="bg-card shadow-card ring-0">
      <CardContent className="px-4 sm:px-5">
        <p className="font-display text-xl tracking-wide">
          LO QUE VA ({data.picks.length})
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {porEquipo.map(({ equipo, picks }) => (
            <div key={equipo.teamId} className="rounded-xl bg-surface-2 p-3">
              <p className="flex items-center gap-2">
                <TeamCrest
                  name={equipo.name}
                  color={equipo.color}
                  crestUrl={equipo.crestUrl}
                  className="size-5 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate font-display text-base tracking-wide">
                  {equipo.name.toUpperCase()}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  +{picks.length}
                </span>
              </p>
              <ul className="mt-2 space-y-1">
                {picks.map((p) => (
                  <li
                    key={p.pickNumber}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {p.jugador.nombre}
                    </span>
                    <span className="shrink-0 rounded bg-card px-1.5 text-[10px] tracking-wider text-muted-foreground uppercase tabular-nums">
                      {data.draft.mode === "pots"
                        ? `Bombo ${String.fromCharCode(64 + p.round)}`
                        : `Ronda ${p.round}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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

/** La revelación del elegido, al estilo de abrir un sobre.
 *
 *  El orden es lo que la hace: primero el equipo arriba —a quién se lo
 *  llevan—, después la carta girando sobre su eje con los rayos detrás,
 *  el destello cruzándola, y al final el nombre subiendo. Si llegara
 *  todo junto sería un cartel; escalonado es un momento.
 *
 *  Los rayos toman el color del equipo, que es lo que amarra la
 *  animación al sorteo y no a una plantilla cualquiera. */
function FichaElegido({
  jugador,
  equipo,
  onFin,
}: {
  jugador: JugadorDelSorteo;
  equipo: EquipoDelSorteo;
  onFin: () => void;
}) {
  const acento = readableAccent(equipo.color);

  useEffect(() => {
    const t = window.setTimeout(onFin, 3400);
    return () => window.clearTimeout(t);
  }, [onFin]);

  return (
    <button
      type="button"
      onClick={onFin}
      aria-label="Cerrar"
      className="fixed inset-0 z-100 flex flex-col items-center justify-center gap-5 bg-background/95 p-6"
    >
      {/* El equipo, arriba */}
      <div className="animate-ficha-equipo text-center">
        <p className="text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
          Ficha para
        </p>
        <p className="mt-1 flex items-center justify-center gap-2">
          <TeamCrest
            name={equipo.name}
            color={equipo.color}
            crestUrl={equipo.crestUrl}
            className="size-7 shrink-0"
          />
          <span
            className="font-display text-2xl tracking-wide"
            style={{ color: acento }}
          >
            {equipo.name.toUpperCase()}
          </span>
        </p>
      </div>

      {/* La carta, con los rayos detrás */}
      <div className="relative flex items-center justify-center">
        <span
          aria-hidden
          className="animate-ficha-rayos pointer-events-none absolute size-[22rem] rounded-full"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, ${acento}55 18deg, transparent 36deg, transparent 90deg, ${acento}44 108deg, transparent 126deg, transparent 180deg, ${acento}55 198deg, transparent 216deg, transparent 270deg, ${acento}44 288deg, transparent 306deg)`,
            maskImage:
              "radial-gradient(circle, transparent 28%, black 42%, transparent 72%)",
          }}
        />
        <div
          className="animate-ficha-carta relative overflow-hidden rounded-2xl"
          style={{ boxShadow: `0 0 60px -10px ${acento}aa` }}
        >
          <PlayerPhoto
            src={jugador.photoUrl}
            alt={jugador.nombre}
            offsetY={0.16}
            fallback={jugador.nombre.slice(0, 2).toUpperCase()}
            className="size-48 rounded-2xl ring-2 sm:size-56"
          />
          <span
            aria-hidden
            className="animate-ficha-destello pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent"
          />
        </div>
      </div>

      {/* El nombre, al final */}
      <div className="animate-ficha-nombre text-center">
        <p className="mx-auto max-w-[90vw] text-balance font-display text-3xl leading-none tracking-wide text-volt-text sm:text-5xl">
          {jugador.nombre.toUpperCase()}
        </p>
        <p className="mt-2 text-xs tracking-[0.25em] text-muted-foreground uppercase">
          {POSITION_SHORT[jugador.position]} · {jugador.memberSince} en el DT
        </p>
      </div>
    </button>
  );
}
