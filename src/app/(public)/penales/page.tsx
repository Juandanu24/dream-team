import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenaltyLeaderboard } from "@/components/penalty-leaderboard";
import { getPenaltyData } from "@/lib/data";
import { PenaltyGame } from "./penalty-game";

export const metadata: Metadata = {
  title: "Reto de penales",
};

export const dynamic = "force-dynamic";

export default async function PenaltiesPage() {
  const { players, leaderboard } = await getPenaltyData();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
        RETO DE <span className="text-volt">PENALES</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Cinco penales contra el arquero. El que más meta manda en el ranking del
        Dream Team.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <PenaltyGame players={players} leaderboard={leaderboard} />

        <aside>
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="font-display text-2xl tracking-wide">
                RANKING
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PenaltyLeaderboard rows={leaderboard} limit={10} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
