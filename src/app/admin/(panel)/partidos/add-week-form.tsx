"use client";

import { useId, useState, useTransition } from "react";
import { CalendarPlus, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STAGE_LABELS, type MatchStage, type Team } from "@/lib/types";
import { addWeek } from "./actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

const STAGES: MatchStage[] = ["group", "semifinal", "third_place", "final"];

interface Fila {
  id: string;
  stage: MatchStage;
  date: string;
  time: string;
  home: string;
  away: string;
}

/** Suma una hora a un "HH:mm", sin pasar de las 23. */
function masUnaHora(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h)) return "20:00";
  return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(
    Number.isFinite(m) ? m : 0,
  ).padStart(2, "0")}`;
}

/** Suma días a un "YYYY-MM-DD" por calendario, no por instante: a las
 *  8 PM de Colombia el martes ya es miércoles en UTC y daría un día
 *  corrido. */
function masDias(date: string, dias: number): string {
  if (!date) return "";
  const [y, mo, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d));
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
}

function filaNueva(previa?: Fila): Fila {
  return {
    id: crypto.randomUUID(),
    stage: previa?.stage ?? "group",
    date: previa?.date ?? "",
    time: previa ? masUnaHora(previa.time) : "20:00",
    home: "",
    away: "",
  };
}

/** Las dos filas de arranque: lo de siempre, martes 8 y jueves 9. */
function filasIniciales(): Fila[] {
  const primera = filaNueva();
  return [primera, { ...filaNueva(primera), time: "21:00" }];
}

// Programa una fecha con los partidos que haga falta, cada uno con su
// fase, su día y su hora.
//
// Antes eran dos casillas fijas —martes y jueves— porque con cuatro
// equipos eso era exactamente una vuelta. Con seis son tres partidos, y
// así la forma del formulario dejaba de ser una comodidad para volverse
// el límite del torneo.
export function AddWeekForm({
  teams,
  nextWeek,
  matchesByWeek,
  onSaved,
}: {
  teams: Team[];
  nextWeek: number;
  /** Cuántos partidos tiene ya cada semana, para avisar si se le suman. */
  matchesByWeek: Record<number, number>;
  onSaved?: () => void;
}) {
  const uid = useId();
  const [week, setWeek] = useState(String(nextWeek));
  const [filas, setFilas] = useState<Fila[]>(filasIniciales);
  const [pending, startTransition] = useTransition();

  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? "";

  function editar(id: string, cambio: Partial<Fila>) {
    setFilas((prev) => {
      const siguiente = prev.map((f) => (f.id === id ? { ...f, ...cambio } : f));
      // Poner el día del primero llena los que sigan vacíos, dos días
      // después: el segundo partido casi siempre es el jueves de esa
      // misma semana. Si no, se corrige a mano.
      if (cambio.date && prev[0]?.id === id) {
        return siguiente.map((f, j) =>
          j > 0 && !f.date ? { ...f, date: masDias(cambio.date!, 2) } : f,
        );
      }
      return siguiente;
    });
  }

  // ---- Avisos en vivo ----
  const elegidos = filas.flatMap((f) => [f.home, f.away].filter(Boolean));
  const repetidos = [
    ...new Set(elegidos.filter((id, i) => elegidos.indexOf(id) !== i)),
  ];
  const problemas: string[] = [];
  if (repetidos.length > 0) {
    problemas.push(`repetido: ${repetidos.map(nameOf).join(", ")}`);
  }
  if (filas.some((f) => f.home && f.home === f.away)) {
    problemas.push("un equipo quedó contra sí mismo");
  }
  // Media llave deja un partido a medias; los dos vacíos es el cruce
  // "Por definir", que es válido y se llena después.
  if (filas.some((f) => Boolean(f.home) !== Boolean(f.away))) {
    problemas.push("hay un partido con un solo equipo");
  }
  if (filas.some((f) => !f.date || !f.time)) {
    problemas.push("falta día u hora en algún partido");
  }

  const listo = problemas.length === 0 && elegidos.length > 0;
  const descansan = teams.filter((t) => !elegidos.includes(t.id));
  const yaProgramados = matchesByWeek[Number(week)] ?? 0;

  function guardar() {
    startTransition(async () => {
      try {
        await addWeek({
          week: Number(week),
          matches: filas.map((f) => ({
            stage: f.stage,
            date: f.date,
            time: f.time,
            home_team_id: f.home || null,
            away_team_id: f.away || null,
          })),
        });
        setFilas(filasIniciales());
        toast.success(
          filas.length === 1 ? "Partido programado" : "Fecha programada",
        );
        onSaved?.();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo programar",
        );
      }
    });
  }

  const teamSelect = (fila: Fila, lado: "home" | "away", etiqueta: string) => (
    <div className="min-w-0 flex-1 space-y-1">
      <Label
        htmlFor={`${uid}-${fila.id}-${lado}`}
        className="text-xs text-muted-foreground"
      >
        {etiqueta}
      </Label>
      <select
        id={`${uid}-${fila.id}-${lado}`}
        value={fila[lado]}
        onChange={(e) => editar(fila.id, { [lado]: e.target.value })}
        className={selectClass}
      >
        <option value="">Por definir</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor={`${uid}-week`} className="text-xs">
            Semana
          </Label>
          <Input
            id={`${uid}-week`}
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="w-24"
          />
        </div>
        {yaProgramados > 0 ? (
          <p className="pb-2 text-xs text-yellow-500">
            La semana {week} ya tiene {yaProgramados} partido
            {yaProgramados > 1 ? "s" : ""}: estos se le suman.
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {filas.map((fila, i) => (
          <div key={fila.id} className="rounded-lg border border-border/60 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <span className="pb-2 font-display text-lg tracking-wide text-volt">
                {i + 1}
              </span>
              <div className="min-w-40 flex-1 space-y-1">
                <Label
                  htmlFor={`${uid}-${fila.id}-stage`}
                  className="text-xs text-muted-foreground"
                >
                  Fase
                </Label>
                <select
                  id={`${uid}-${fila.id}-stage`}
                  value={fila.stage}
                  onChange={(e) =>
                    editar(fila.id, { stage: e.target.value as MatchStage })
                  }
                  className={selectClass}
                >
                  {STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {STAGE_LABELS[stage]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor={`${uid}-${fila.id}-date`}
                  className="text-xs text-muted-foreground"
                >
                  Día
                </Label>
                <Input
                  id={`${uid}-${fila.id}-date`}
                  type="date"
                  value={fila.date}
                  onChange={(e) => editar(fila.id, { date: e.target.value })}
                  className="w-fit"
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor={`${uid}-${fila.id}-time`}
                  className="text-xs text-muted-foreground"
                >
                  Hora
                </Label>
                <Input
                  id={`${uid}-${fila.id}-time`}
                  type="time"
                  value={fila.time}
                  onChange={(e) => editar(fila.id, { time: e.target.value })}
                  className="w-fit"
                />
              </div>
              {filas.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title="Quitar este partido"
                  onClick={() =>
                    setFilas((prev) => prev.filter((f) => f.id !== fila.id))
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {teamSelect(fila, "home", "Local")}
              <span className="pb-2 text-xs text-muted-foreground">vs</span>
              {teamSelect(fila, "away", "Visitante")}
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setFilas((prev) => [...prev, filaNueva(prev[prev.length - 1])])
        }
        disabled={filas.length >= 8}
      >
        <Plus aria-hidden /> Agregar partido
      </Button>

      {/* Estado del armado. Que alguien descanse no es un error cuando
          los partidos de la fecha no alcanzan para todos: con seis
          equipos y dos partidos es lo normal, así que se informa quién
          queda por fuera en vez de avisar como si fuera un descuadre. */}
      {problemas.length > 0 ? (
        <p className="text-sm text-yellow-500">⚠️ {problemas.join(" · ")}</p>
      ) : listo ? (
        <p className="text-sm text-volt">
          {descansan.length === 0
            ? "✓ Todos los equipos juegan una vez esta fecha"
            : `✓ Listo · descansan: ${descansan.map((t) => t.name).join(", ")}`}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        onClick={guardar}
        className="w-full font-display text-lg tracking-wide"
        disabled={pending || problemas.length > 0}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <CalendarPlus aria-hidden />
        )}
        GUARDAR {filas.length} PARTIDO{filas.length > 1 ? "S" : ""}
      </Button>
    </div>
  );
}
