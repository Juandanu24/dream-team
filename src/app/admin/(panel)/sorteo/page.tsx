import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDraftData } from "@/lib/draft";
import { DraftStudio } from "./draft-studio";
import { crearSorteo } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSorteoPage() {
  const data = await getDraftData();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl tracking-wide">
          SOR<span className="text-volt-text">TEO</span>
        </h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sorteo">
            <ExternalLink aria-hidden /> Ver la pública
          </Link>
        </Button>
      </div>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Los capitanes eligen por turnos. Lo único al azar es el orden.
      </p>

      {data ? (
        <div className="mt-6">
          <DraftStudio data={data} />
        </div>
      ) : (
        <Card className="mt-6 bg-card shadow-card ring-0">
          <CardContent className="space-y-3 px-5">
            <p className="text-sm text-muted-foreground">
              Todavía no hay sorteo para este torneo. Al crearlo entran todos
              los equipos; después sacas a los que no vayan a elegir.
            </p>
            <form action={crearSorteo}>
              <Button type="submit" className="rounded-full">
                Crear el sorteo
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
