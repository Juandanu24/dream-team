import { Card, CardContent } from "@/components/ui/card";

export default function AdminMatchesPage() {
  return (
    <div>
      <h1 className="font-display text-4xl tracking-wide">PARTIDOS</h1>
      <Card className="mt-6 border-dashed border-border/60 bg-card/40">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Próxima fase: generar el fixture (semanas 1 a 5), cargar marcadores y
          registrar goles y tarjetas por jugador.
        </CardContent>
      </Card>
    </div>
  );
}
