import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getFriendliesData, type FriendlySideWithPlayers } from "@/lib/friendlies";
import { formatPieceWhen, PIECE_VENUE } from "@/lib/match-summary";
import { readableAccent } from "@/lib/team-color";
import type { LineupLine } from "@/lib/types";
import { DeleteFriendlyButton } from "./delete-friendly-button";
import { FriendlyEditor, type LadoSeed, type Persona } from "./friendly-editor";
import { NewFriendlyForm } from "./new-friendly-form";

export const dynamic = "force-dynamic";

/** La clave lleva prefijo porque conviven dos orígenes: de la base y
 *  invitado. El editor solo maneja claves, no le importa cuál era. */
function seedFrom(side: FriendlySideWithPlayers): LadoSeed {
  const slots: LadoSeed["slots"] = {};
  const invitados: Persona[] = [];

  for (const entry of side.entries) {
    const key = entry.player_id ? `p:${entry.player_id}` : `g:${entry.id}`;
    slots[key] = {
      line: entry.line as LineupLine,
      slot: entry.slot,
      isStarter: entry.is_starter,
    };
    if (!entry.player_id) {
      invitados.push({ key, name: entry.full_name, photoUrl: null });
    }
  }

  return {
    sideId: side.id,
    friendlyId: side.friendly_id,
    name: side.name,
    color: side.color,
    formation: side.formation,
    notes: side.notes,
    slots,
    invitados,
  };
}

function clavesDe(side: FriendlySideWithPlayers | undefined): string[] {
  if (!side) return [];
  return side.entries
    .filter((e) => e.player_id)
    .map((e) => `p:${e.player_id}`);
}

export default async function AmistososPage() {
  const result = await getFriendliesData();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-4xl tracking-wide">
          PARTIDOS <span className="text-dt-blue">AMISTOSOS</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {result.reason === "sin-migrar"
            ? "Falta correr la migración 00013 (amistosos) en Supabase. Está en supabase/migrations/."
            : "No pudimos leer los amistosos. Revisa la conexión con Supabase."}
        </p>
      </div>
    );
  }

  const { friendlies, convocables } = result.data;

  // Los de la base van con prefijo para no chocar con los invitados.
  const personas: Persona[] = convocables.map((p) => ({
    key: `p:${p.id}`,
    name: p.full_name,
    photoUrl: p.photo_url,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-4xl tracking-wide sm:text-5xl">
        PARTIDOS <span className="text-dt-blue">AMISTOSOS</span>
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Los picados por fuera del torneo. Arma los dos lados —puedes meter
        gente que no está inscrita—, y mándalos al grupo por WhatsApp o como
        imagen. No se publican en la web ni avisan por push.
      </p>

      <div className="mt-6">
        <NewFriendlyForm />
      </div>

      {friendlies.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Todavía no hay amistosos. Crea el primero ahí arriba.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {friendlies.map((friendly, i) => {
            const when = formatPieceWhen(friendly.kickoff_at);
            const venue = friendly.venue ?? PIECE_VENUE;
            const [uno, dos] = friendly.sides;

            return (
              <Card key={friendly.id} className="border-border/60 bg-card/70 py-0">
                <details open={i === 0} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 p-5">
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                    <span className="font-display text-2xl tracking-wide text-volt">
                      {friendly.title.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {when}
                    </span>
                  </summary>

                  <CardContent className="space-y-4 px-5 pb-5">
                    {friendly.sides.length < 2 ? (
                      <p className="text-sm text-muted-foreground">
                        A este amistoso le faltan lados. Bórralo y créalo de
                        nuevo.
                      </p>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {friendly.sides.map((side) => {
                          const otro = side.id === uno.id ? dos : uno;
                          return (
                            <Card
                              key={side.id}
                              className="border-border/60 bg-background/40"
                            >
                              <CardContent className="space-y-4 px-5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="size-3 shrink-0 rounded-full"
                                    style={{
                                      background: readableAccent(side.color),
                                    }}
                                    aria-hidden
                                  />
                                  <h3 className="font-display text-2xl tracking-wide">
                                    {side.name}
                                  </h3>
                                </div>
                                <FriendlyEditor
                                  seed={seedFrom(side)}
                                  convocables={personas}
                                  rivalName={otro.name}
                                  when={when}
                                  venue={venue}
                                  ocupadosEnElOtroLado={clavesDe(otro)}
                                />
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}

                    <div className="border-t border-border/60 pt-3">
                      <DeleteFriendlyButton
                        friendlyId={friendly.id}
                        title={friendly.title}
                      />
                    </div>
                  </CardContent>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
