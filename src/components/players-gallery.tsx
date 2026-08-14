"use client";

import { useState } from "react";
import { GalleryHorizontal, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardShareButton } from "@/components/card-share-button";
import { MotionButton } from "@/components/motion-button";
import { PlayerCard } from "@/components/player-card";
import { PlayerCarousel } from "@/components/player-carousel";
import { TiltCard } from "@/components/tilt-card";
import { cn } from "@/lib/utils";

export interface GalleryPlayer {
  id: string;
  name: string;
  age: number;
  positionShort: string;
  footLabel: string;
  memberSince: string;
  photoUrl: string | null;
  teamName: string;
  teamColor: string | null;
  crestUrl: string | null;
  isCaptain: boolean;
}

// Galería pública de cartas: carrusel (una grande al centro) o
// grilla compacta para ver todos de un vistazo.
export function PlayersGallery({ players }: { players: GalleryPlayer[] }) {
  const [view, setView] = useState<"carousel" | "grid">("carousel");

  const card = (player: GalleryPlayer, compact = false) => (
    <PlayerCard
      name={player.name}
      age={player.age}
      positionShort={player.positionShort}
      footLabel={player.footLabel}
      memberSince={player.memberSince}
      photoUrl={player.photoUrl}
      teamName={player.teamName}
      teamColor={player.teamColor}
      crestUrl={player.crestUrl}
      isCaptain={player.isCaptain}
      compact={compact}
      className="max-w-none"
    />
  );

  const tilted = (player: GalleryPlayer, compact = false) => (
    <TiltCard
      key={player.id}
      className={compact ? "w-full" : "w-full max-w-[280px]"}
    >
      {card(player, compact)}
    </TiltCard>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Toggle de vista: solo aplica en pantallas chicas */}
        <div className="flex gap-1 lg:hidden">
          <Button
            variant={view === "carousel" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("carousel")}
            className={cn(view === "carousel" && "text-foreground")}
          >
            <GalleryHorizontal aria-hidden /> Carrusel
          </Button>
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("grid")}
            className={cn(view === "grid" && "text-foreground")}
          >
            <LayoutGrid aria-hidden /> Todos ({players.length})
          </Button>
        </div>
        <MotionButton />
      </div>

      {/* Mobile/tablet */}
      <div className="mt-4 lg:hidden">
        {view === "carousel" ? (
          <PlayerCarousel>
            {players.map((player) => (
              <div key={player.id} className="flex flex-col items-center gap-2">
                <TiltCard className="w-full">{card(player)}</TiltCard>
                <CardShareButton card={player} />
              </div>
            ))}
          </PlayerCarousel>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {players.map((player) => tilted(player, true))}
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="mt-4 hidden grid-cols-3 justify-items-center gap-6 lg:grid xl:grid-cols-4">
        {players.map((player) => (
          <div key={player.id} className="flex flex-col items-center gap-2">
            <TiltCard className="w-full max-w-[280px]">{card(player)}</TiltCard>
            <CardShareButton card={player} />
          </div>
        ))}
      </div>
    </div>
  );
}
