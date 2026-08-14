import { Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PenaltyLeaderboardRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

export function PenaltyLeaderboard({
  rows,
  limit,
}: {
  rows: PenaltyLeaderboardRow[];
  limit?: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía nadie ha pateado. Sé el primero en el ranking ⚽
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {(limit ? rows.slice(0, limit) : rows).map((row, i) => (
        <div key={row.player_id} className="flex items-center gap-3">
          <span
            className={cn(
              "w-6 text-center font-display text-lg",
              i < 3 ? "text-base" : "text-volt",
            )}
          >
            {MEDALS[i] ?? i + 1}
          </span>
          <Avatar className="size-8">
            <AvatarImage src={row.photo_url ?? undefined} alt="" />
            <AvatarFallback>
              {row.full_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-sm">
            {row.full_name}
            <span className="block text-xs text-muted-foreground">
              {row.attempts} {row.attempts === 1 ? "intento" : "intentos"}
            </span>
          </span>
          <span className="flex items-center gap-1 font-display text-2xl text-volt">
            {row.best_score}
            <Trophy className="size-4" aria-hidden />
          </span>
        </div>
      ))}
    </div>
  );
}
