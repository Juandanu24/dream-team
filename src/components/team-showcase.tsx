import { Card, CardContent } from "@/components/ui/card";
import { PlayerCard } from "@/components/player-card";
import { TeamCrest } from "@/components/team-crest";
import { readableAccent } from "@/lib/team-color";
import type { GalleryPlayer } from "@/components/players-gallery";

// Nota: GalleryPlayer viene de un componente cliente, pero se importa
// solo como tipo, así que no arrastra JS al servidor.

export interface ShowcaseTeam {
  id: string;
  name: string;
  color: string | null;
  crestUrl: string | null;
  players: GalleryPlayer[];
}

// Cada equipo con su escudo en grande, su color de fondo y la plantilla
// en cartas, no en lista de texto.
export function TeamShowcase({ team }: { team: ShowcaseTeam }) {
  const accent = readableAccent(team.color);
  const captain = team.players.find((p) => p.isCaptain);

  return (
    <Card
      className="overflow-hidden border-border/60 bg-card/70 py-0"
      style={{ borderColor: `${accent}55` }}
    >
      {/* Cabecera con el escudo grande */}
      <div
        className="flex items-center gap-4 px-5 py-6"
        style={{
          background: `linear-gradient(135deg, ${accent}26, transparent 60%)`,
        }}
      >
        <TeamCrest
          name={team.name}
          color={team.color}
          crestUrl={team.crestUrl}
          className="size-20 shrink-0 sm:size-28"
        />
        <div className="min-w-0">
          <h3
            className="font-display text-3xl tracking-wide sm:text-4xl"
            style={{ color: accent }}
          >
            {team.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {team.players.length}{" "}
            {team.players.length === 1 ? "jugador" : "jugadores"}
            {captain ? (
              <>
                {" · "}Capitán: <span className="text-foreground">{captain.name}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <CardContent className="px-4 pb-5">
        {team.players.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Plantilla por definir.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {team.players.map((player) => (
              <PlayerCard
                key={player.id}
                name={player.name}
                age={player.age}
                positionShort={player.positionShort}
                footLabel={player.footLabel}
                memberSince={player.memberSince}
                photoUrl={player.photoUrl}
                teamColor={player.teamColor}
                isCaptain={player.isCaptain}
                compact
                className="max-w-none"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
