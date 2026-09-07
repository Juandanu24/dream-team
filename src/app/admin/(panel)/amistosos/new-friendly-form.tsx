"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearAmistoso } from "./actions";

export function NewFriendlyForm() {
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);

  function onSubmit(formData: FormData) {
    const leer = (k: string) => String(formData.get(k) ?? "").trim();
    startTransition(async () => {
      try {
        await crearAmistoso({
          title: leer("title") || "Amistoso",
          kickoffAt: leer("kickoff_at") || null,
          venue: leer("venue") || null,
          homeName: leer("home_name") || "Claros",
          awayName: leer("away_name") || "Oscuros",
          homeColor: leer("home_color") || null,
          awayColor: leer("away_color") || null,
        });
        toast.success("Amistoso creado");
        setAbierto(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo crear",
        );
      }
    });
  }

  if (!abierto) {
    return (
      <Button onClick={() => setAbierto(true)}>
        <CalendarPlus aria-hidden /> Nuevo amistoso
      </Button>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4 rounded-md border border-border/60 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="title">Nombre</Label>
          <Input id="title" name="title" defaultValue="Amistoso" maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kickoff_at">Cuándo</Label>
          <Input id="kickoff_at" name="kickoff_at" type="datetime-local" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="venue">Dónde</Label>
          <Input
            id="venue"
            name="venue"
            maxLength={80}
            placeholder="Cancha F8 · Montería"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { k: "home", label: "Lado 1", name: "Claros", color: "#4FA8FF" },
            { k: "away", label: "Lado 2", name: "Oscuros", color: "#CCFF00" },
          ] as const
        ).map((lado) => (
          <div key={lado.k} className="space-y-1.5">
            <Label htmlFor={`${lado.k}_name`}>{lado.label}</Label>
            <div className="flex gap-2">
              <Input
                id={`${lado.k}_name`}
                name={`${lado.k}_name`}
                defaultValue={lado.name}
                maxLength={40}
              />
              <input
                type="color"
                name={`${lado.k}_color`}
                defaultValue={lado.color}
                aria-label={`Color de ${lado.label}`}
                className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Crear
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setAbierto(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
