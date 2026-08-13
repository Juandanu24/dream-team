import { Card, CardContent } from "@/components/ui/card";

export default function AdminTeamsPage() {
  return (
    <div>
      <h1 className="font-display text-4xl tracking-wide">EQUIPOS</h1>
      <Card className="mt-6 border-dashed border-border/60 bg-card/40">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Próxima fase: crear los 4 equipos, ponerles nombre y color, y asignar
          los jugadores aprobados a cada plantilla.
        </CardContent>
      </Card>
    </div>
  );
}
