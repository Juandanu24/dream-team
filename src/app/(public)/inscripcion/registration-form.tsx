"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlayerCard } from "@/components/player-card";
import { TiltCard } from "@/components/tilt-card";
import {
  FOOT_LABELS,
  POSITION_LABELS,
  POSITION_SHORT,
  type DominantFoot,
  type PlayerPosition,
} from "@/lib/types";
import { submitRegistration } from "./actions";

export function RegistrationForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [foot, setFoot] = useState<DominantFoot | "">("");
  const [position, setPosition] = useState<PlayerPosition | "">("");
  const [memberSince, setMemberSince] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      const imageCompression = (await import("browser-image-compression")).default;
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.25,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: "image/webp",
      });
      setPhoto(compressed);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressed);
      });
    } catch {
      toast.error("No pudimos procesar esa foto, intenta con otra");
    } finally {
      setCompressing(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo) {
      toast.error("Sube tu foto para la carta");
      return;
    }
    if (!foot || !position) {
      toast.error("Elige tu pie dominante y tu posición");
      return;
    }

    const formData = new FormData();
    formData.set("full_name", fullName);
    formData.set("email", email);
    formData.set("age", age);
    formData.set("dominant_foot", foot);
    formData.set("position", position);
    formData.set("member_since", memberSince);
    formData.set("photo", photo, "foto.webp");

    startTransition(async () => {
      const result = await submitRegistration(formData);
      if (result.ok) {
        setDone(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  const card = (
    <TiltCard className="w-full max-w-[280px]">
      <PlayerCard
        name={fullName}
        age={age}
        positionShort={position ? POSITION_SHORT[position] : ""}
        footLabel={foot ? FOOT_LABELS[foot] : ""}
        memberSince={memberSince}
        photoUrl={photoPreview}
        className="max-w-none"
      />
    </TiltCard>
  );

  if (done) {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <CheckCircle2 className="size-12 text-volt" aria-hidden />
        <div>
          <h2 className="font-display text-4xl tracking-wide">
            ¡QUEDASTE <span className="text-volt">INSCRITO!</span>
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Tu inscripción quedó <strong>pendiente de aprobación</strong>. Los
            organizadores la confirman y luego sabrás en qué equipo juegas.
          </p>
        </div>
        {card}
        <Button variant="outline" asChild>
          <Link href="/torneo">Ver el torneo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Como quieres salir en tu carta"
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Edad</Label>
            <Input
              id="age"
              type="number"
              min={10}
              max={80}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member_since">Tiempo en el Dream Team</Label>
            <Input
              id="member_since"
              value={memberSince}
              onChange={(e) => setMemberSince(e.target.value)}
              placeholder='"2 años", "6 meses", "fundador"…'
              maxLength={40}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Pie dominante</Label>
            <Select value={foot} onValueChange={(v) => setFoot(v as DominantFoot)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige tu pie" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FOOT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Posición</Label>
            <Select
              value={position}
              onValueChange={(v) => setPosition(v as PlayerPosition)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="¿Dónde juegas?" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(POSITION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="photo">Tu foto</Label>
          <input
            ref={fileInputRef}
            id="photo"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={compressing}
            onClick={() => fileInputRef.current?.click()}
          >
            {compressing ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Camera aria-hidden />
            )}
            {photo ? "Cambiar foto" : "Subir foto"}
          </Button>
          <p className="text-xs text-muted-foreground">
            De frente y bien iluminada, tipo carné pero con flow. La comprimimos
            automáticamente antes de subirla.
          </p>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full font-display text-xl tracking-wide sm:w-auto"
          disabled={pending || compressing}
        >
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden /> ENVIANDO…
            </>
          ) : (
            "QUIERO JUGAR"
          )}
        </Button>
      </form>

      <aside className="order-first lg:order-none">
        <Card className="border-border/60 bg-card/50">
          <CardContent className="flex flex-col items-center gap-3 px-4 py-2">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              Así va tu carta
            </p>
            {card}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
