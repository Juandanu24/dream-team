import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Goal, Handshake, RectangleVertical, Target, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CardShareButton } from "@/components/card-share-button";
import { PlayerCard } from "@/components/player-card";
import { TeamCrest } from "@/components/team-crest";
import { TiltCard } from "@/components/tilt-card";
import { getPlayerProfile } from "@/lib/player-profile";
import { FOOT_LABELS, POSITION_LABELS, POSITION_SHORT } from "@/lib/types";

export const dynamic = "force-dynamic";

// La página es pública y se comparte por WhatsApp: el título y la
// descripción llevan el nombre y los números del jugador, que es lo que
// se ve en la vista previa del enlace.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const perfil = await getPlayerProfile(id);
  if (!perfil) return { title: "Jugador" };

  const { player, team, goals, assists } = perfil;
  const partes = [POSITION_LABELS[player.position]];
  if (team) partes.push(team.name);
  if (goals > 0) partes.push(`${goals} ${goals === 1 ? "gol" : "goles"}`);
  if (assists > 0) partes.push(`${assists} ${assists === 1 ? "asistencia" : "asistencias"}`);

  return {
    title: player.full_name,
    description: `${partes.join(" · ")} — 1er Torneo Amistoso del Dream Team.`,
    openGraph: {
      title: `${player.full_name} · Dream Team`,
      description: partes.join(" · "),
    },
  };
}

function Stat({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: typeof Goal;
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <Card className="border-border/60 bg-card/70 py-0">
      <CardContent className="flex flex-col items-center gap-1 px-3 py-4">
        <Icon
          className={accent ? "size-5 text-volt" : "size-5 text-dt-blue"}
          aria-hidden
        />
        <span className="font-display text-3xl tracking-wide">{value}</span>
        <span className="text-center text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getPlayerProfile(id);
  if (!perfil) notFound();

  const {
    player,
    team,
    isCaptain,
    goals,
    assists,
    yellowCards,
    redCards,
    penaltyBest,
    mvpCount,
  } = perfil;

  const card = {
    name: player.full_name,
    age: player.age,
    positionShort: POSITION_SHORT[player.position],
    footLabel: FOOT_LABELS[player.dominant_foot],
    memberSince: player.member_since,
    photoUrl: player.photo_url,
    teamName: team?.name ?? null,
    teamColor: team?.color ?? null,
    crestUrl: team?.crest_url ?? null,
    isCaptain,
  };

  return (
    <div className="bg-stadium">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          href="/torneo?tab=jugadores"
          className="inline-flex items-center gap-1.5 text-sm text-dt-blue underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Todos los jugadores
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[300px_1fr] lg:items-start">
          <div className="flex flex-col items-center gap-3">
            <TiltCard className="w-full max-w-[280px] min-w-0">
              <PlayerCard {...card} className="max-w-none" />
            </TiltCard>
            <CardShareButton card={card} />
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-4xl tracking-wide sm:text-5xl">
              {player.full_name.toUpperCase()}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{POSITION_LABELS[player.position]}</span>
              <span aria-hidden>·</span>
              <span>Pie {FOOT_LABELS[player.dominant_foot].toLowerCase()}</span>
              <span aria-hidden>·</span>
              <span>{player.age} años</span>
              {isCaptain ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-volt">Capitán</span>
                </>
              ) : null}
            </div>

            {team ? (
              <div className="mt-4 flex items-center gap-2">
                <TeamCrest
                  name={team.name}
                  color={team.color}
                  crestUrl={team.crest_url}
                  className="size-8"
                />
                <span className="font-display text-2xl tracking-wide">
                  {team.name}
                </span>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Todavía sin equipo asignado.
              </p>
            )}

            <p className="mt-4 text-sm text-muted-foreground">
              En el Dream Team hace{" "}
              <span className="text-foreground">{player.member_since}</span>.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat icon={Goal} value={goals} label="Goles" accent />
              <Stat icon={Handshake} value={assists} label="Asistencias" />
              {mvpCount > 0 ? (
                <Stat
                  icon={Trophy}
                  value={mvpCount}
                  label={mvpCount === 1 ? "Figura del partido" : "Veces figura"}
                  accent
                />
              ) : null}
              {penaltyBest !== null ? (
                <Stat icon={Target} value={`${penaltyBest}/5`} label="Récord en penales" />
              ) : null}
              {yellowCards > 0 ? (
                <Stat icon={RectangleVertical} value={yellowCards} label="Amarillas" />
              ) : null}
              {redCards > 0 ? (
                <Stat icon={RectangleVertical} value={redCards} label="Rojas" />
              ) : null}
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Comparte tu carta con el botón que está debajo de ella, o pasa
              este enlace a quien quieras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
