import { Trophy } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { matchWinner } from "@/lib/match-summary";
import { readableAccent } from "@/lib/team-color";
import type { Match, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

/** La llave: las dos semifinales conectadas a la final.
 *
 *  La lista por fechas sirve para la fase de grupos, donde lo que importa
 *  es cuándo se juega. En el playoff lo que importa es OTRA cosa —quién
 *  sale de dónde— y eso una lista no lo muestra. Por eso acá se dibuja la
 *  estructura: de qué semifinal salió cada finalista se ve sin leer.
 *
 *  Las líneas se trazan al entrar en pantalla y son `div` con borde, no un
 *  `<svg>`: así siguen al layout cuando las tarjetas cambian de alto. */
export function PlayoffBracket({
  matches,
  teams,
}: {
  matches: Match[];
  teams: Team[];
}) {
  const semis = matches
    .filter((m) => m.stage === "semifinal")
    .sort((a, b) => (a.kickoff_at ?? "").localeCompare(b.kickoff_at ?? ""));
  const final = matches.find((m) => m.stage === "final");
  const tercero = matches.find((m) => m.stage === "third_place");

  if (semis.length === 0 && !final) return null;

  return (
    <div>
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_72px_1fr]">
        {/* Semifinales */}
        <div className="space-y-4">
          <Rotulo>Semifinales</Rotulo>
          {semis.length > 0 ? (
            semis.map((m) => <Llave key={m.id} match={m} teams={teams} />)
          ) : (
            <Pendiente texto="Las semifinales se arman cuando termine la fase de grupos." />
          )}
        </div>

        {/* Los conectores. Solo en pantallas anchas: apilado no conectan
            nada y serían una línea al aire. */}
        <div
          className="relative hidden self-stretch lg:block"
          aria-hidden
        >
          <Linea className="top-[25%] left-0 h-px w-1/2 origin-left" />
          <Linea className="bottom-[25%] left-0 h-px w-1/2 origin-left" />
          <Linea className="top-[25%] bottom-[25%] left-1/2 w-px origin-top" />
          <Linea className="top-1/2 left-1/2 h-px w-1/2 origin-left" />
        </div>

        {/* Final */}
        <div className="space-y-4">
          <Rotulo>Gran final</Rotulo>
          {final ? (
            <Llave match={final} teams={teams} esFinal />
          ) : (
            <Pendiente texto="La final llega en la última fecha." />
          )}
        </div>
      </div>

      {tercero ? (
        <div className="mt-6 lg:max-w-[calc(50%-36px)]">
          <Rotulo>Tercer puesto</Rotulo>
          <div className="mt-4">
            <Llave match={tercero} teams={teams} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function Linea({ className }: { className: string }) {
  return (
    <span
      className={cn("animate-draw absolute bg-separator-strong", className)}
    />
  );
}

function Pendiente({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-separator-strong p-5 text-sm text-muted-foreground">
      {texto}
    </div>
  );
}

/** Un cruce: los dos equipos, el marcador y quién pasó. */
function Llave({
  match,
  teams,
  esFinal = false,
}: {
  match: Match;
  teams: Team[];
  esFinal?: boolean;
}) {
  const equipo = (id: string | null) => teams.find((t) => t.id === id);
  const gana = matchWinner(match);
  const jugado = match.status === "finished";
  const porPenales =
    match.home_penalties != null && match.away_penalties != null;

  const campeon = esFinal && gana ? equipo(gana === "home" ? match.home_team_id : match.away_team_id) : undefined;
  const acento = readableAccent(campeon?.color);

  const lados = [
    {
      team: equipo(match.home_team_id),
      goles: match.home_score,
      penales: match.home_penalties,
      pasa: gana === "home",
    },
    {
      team: equipo(match.away_team_id),
      goles: match.away_score,
      penales: match.away_penalties,
      pasa: gana === "away",
    },
  ];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-card shadow-card",
        esFinal && campeon && "border",
      )}
      style={
        esFinal && campeon
          ? { borderColor: `${acento}66` }
          : undefined
      }
    >
      {/* El destello solo lo lleva la final ya jugada: es el remate. */}
      {esFinal && campeon ? (
        <span
          aria-hidden
          className="animate-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-foreground/8 to-transparent"
        />
      ) : null}

      <div className="relative">
        {lados.map((lado, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              i === 1 && "border-t border-separator",
              lado.pasa && "bg-surface-2",
            )}
          >
            <TeamCrest
              name={lado.team?.name ?? "Por definir"}
              color={lado.team?.color}
              crestUrl={lado.team?.crest_url}
              className="size-7 shrink-0"
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                lado.pasa ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {lado.team?.name ?? "Por definir"}
            </span>
            <span
              className={cn(
                "shrink-0 font-display text-2xl leading-none tabular-nums",
                jugado
                  ? lado.pasa
                    ? "text-dt-blue"
                    : "text-muted-foreground"
                  : "text-muted-foreground/50",
              )}
            >
              {jugado ? (lado.goles ?? 0) : "–"}
            </span>
            {porPenales ? (
              <span className="w-6 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                ({lado.penales})
              </span>
            ) : null}
            {esFinal && lado.pasa ? (
              <Trophy
                className="size-4 shrink-0"
                style={{ color: acento }}
                aria-label="Campeón"
              />
            ) : null}
          </div>
        ))}
      </div>

      {porPenales ? (
        <p className="border-t border-separator px-4 py-1.5 text-[11px] text-muted-foreground">
          Se definió por penales
        </p>
      ) : null}
    </div>
  );
}
