import { ChevronRight, Plus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeamCrest } from "@/components/team-crest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_TOURNAMENT_SLUG,
  POSITION_SHORT,
  type Player,
  type Team,
  type TeamPlayer,
} from "@/lib/types";
import { assignPlayer, createTeam, removePlayer } from "./actions";
import { ColorSwatches } from "./color-swatches";
import { DeleteTeamButton, EditTeamDialog } from "./team-dialogs";

export const dynamic = "force-dynamic";

interface RosterEntry extends TeamPlayer {
  players: Player;
}

interface TeamsData {
  teams: Team[];
  roster: RosterEntry[];
  approved: Player[];
}

async function getTeamsData(): Promise<TeamsData | null> {
  try {
    const supabase = createAdminClient();
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) return null;

    const [teams, roster, registrations] = await Promise.all([
      supabase
        .from("teams")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("created_at"),
      supabase
        .from("team_players")
        .select("*, players(*)")
        .eq("tournament_id", tournament.id),
      supabase
        .from("registrations")
        .select("players(*)")
        .eq("tournament_id", tournament.id)
        .eq("status", "approved"),
    ]);

    return {
      teams: (teams.data as Team[]) ?? [],
      roster: (roster.data as unknown as RosterEntry[]) ?? [],
      approved:
        (registrations.data as unknown as { players: Player }[] | null)?.map(
          (r) => r.players,
        ) ?? [],
    };
  } catch (error) {
    console.error("Error cargando equipos:", error);
    return null;
  }
}

function PlayerBadge({ player, isGk }: { player: Player; isGk: boolean }) {
  return (
    <Badge variant={isGk ? "default" : "secondary"} className="text-[10px]">
      {isGk ? "ARQ" : POSITION_SHORT[player.position]}
    </Badge>
  );
}

export default async function AdminTeamsPage() {
  const data = await getTeamsData();

  if (!data) {
    return (
      <div>
        <h1 className="font-display text-4xl tracking-wide">EQUIPOS</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No se pudo leer la base de datos. Revisa la configuración de Supabase.
        </p>
      </div>
    );
  }

  const { teams, roster, approved } = data;
  const assignedIds = new Set(roster.map((r) => r.player_id));
  const unassigned = approved
    .filter((p) => !assignedIds.has(p.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide">EQUIPOS</h1>
        <p className="text-sm text-muted-foreground">
          {approved.length} aprobados · {assignedIds.size} asignados ·{" "}
          {unassigned.length} sin equipo
        </p>
      </div>

      {/* Crear equipo */}
      <Card className="mt-6 border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="font-display text-xl tracking-wide">
            NUEVO EQUIPO
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={createTeam}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="new-team-name">Nombre</Label>
              <Input
                id="new-team-name"
                name="name"
                placeholder="Los Galácticos, La Naranja Mecánica…"
                maxLength={40}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorSwatches />
            </div>
            <Button type="submit">
              <Plus aria-hidden /> Crear
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Equipos */}
      {teams.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {teams.map((team) => {
            const players = roster
              .filter((r) => r.team_id === team.id)
              .sort(
                (a, b) =>
                  Number(b.is_goalkeeper) - Number(a.is_goalkeeper) ||
                  a.players.full_name.localeCompare(b.players.full_name),
              );
            return (
              <Card key={team.id} className="border-border/60 bg-card/70 py-0">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 p-5">
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                    <TeamCrest
                      name={team.name}
                      color={team.color}
                      crestUrl={team.crest_url}
                    />
                    <span className="flex-1 truncate font-display text-2xl tracking-wide">
                      {team.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {players.length} jug.
                    </span>
                  </summary>
                <CardContent className="space-y-2 px-5 pb-5">
                  <div className="flex justify-end gap-1">
                    <EditTeamDialog team={team} />
                    <DeleteTeamButton team={team} />
                  </div>
                  {players.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage
                          src={entry.players.photo_url ?? undefined}
                          alt=""
                        />
                        <AvatarFallback>
                          {entry.players.full_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate text-sm">
                        {entry.players.full_name}
                      </span>
                      <PlayerBadge
                        player={entry.players}
                        isGk={entry.is_goalkeeper}
                      />
                      <form action={removePlayer.bind(null, entry.id)}>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="submit"
                          title="Quitar del equipo"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X aria-hidden />
                        </Button>
                      </form>
                    </div>
                  ))}

                  {unassigned.length > 0 ? (
                    <form
                      action={assignPlayer.bind(null, team.id)}
                      className="flex gap-2 pt-2"
                    >
                      <select
                        name="player_id"
                        required
                        defaultValue=""
                        className="border-input h-9 flex-1 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover"
                      >
                        <option value="" disabled>
                          Agregar jugador…
                        </option>
                        {unassigned.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.full_name} (
                            {POSITION_SHORT[player.position]})
                          </option>
                        ))}
                      </select>
                      <Button size="sm" type="submit">
                        <Plus aria-hidden />
                      </Button>
                    </form>
                  ) : null}
                </CardContent>
                </details>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Crea los 4 equipos del torneo y luego asigna a los aprobados.
        </p>
      )}

      {/* Sin equipo */}
      {unassigned.length > 0 ? (
        <Card className="mt-6 border-dashed border-border/60 bg-card/40">
          <CardHeader>
            <CardTitle className="font-display text-xl tracking-wide">
              SIN EQUIPO ({unassigned.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {unassigned.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-2 py-1"
              >
                <Avatar className="size-6">
                  <AvatarImage src={player.photo_url ?? undefined} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {player.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{player.full_name}</span>
                <PlayerBadge
                  player={player}
                  isGk={player.position === "goalkeeper"}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
