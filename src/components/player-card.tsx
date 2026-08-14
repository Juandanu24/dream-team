import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerCardProps {
  name: string;
  age: number | string;
  positionShort: string;
  footLabel: string;
  memberSince: string;
  photoUrl?: string | null;
  teamName?: string | null;
  className?: string;
}

// Carta de jugador estilo FIFA. Componente puramente presentacional:
// sirve igual para el preview en vivo de la inscripción (data URL)
// que para los planteles (URL de Supabase Storage).
// Respeta el tema: dorada-clara en light, neón nocturna en dark.
export function PlayerCard({
  name,
  age,
  positionShort,
  footLabel,
  memberSince,
  photoUrl,
  teamName,
  className,
}: PlayerCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-[280px] bg-gradient-to-b from-volt via-volt/35 to-volt/10 p-[2px]",
        "[clip-path:polygon(0_3%,50%_0,100%_3%,100%_90%,50%_100%,0_90%)]",
        "drop-shadow-[0_8px_18px_rgba(60,80,0,0.25)] dark:drop-shadow-[0_0_25px_rgba(204,255,0,0.2)]",
        className,
      )}
    >
      <div className="flex h-full flex-col bg-gradient-to-b from-[#f3f7dd] via-[#fbfcf4] to-[#e9eecf] px-5 pt-6 pb-10 [clip-path:polygon(0_3%,50%_0,100%_3%,100%_90%,50%_100%,0_90%)] dark:from-[#1c2205] dark:via-[#111403] dark:to-[#0a0b02]">
        <div className="flex items-start justify-between">
          <div className="text-center">
            <p className="font-display text-4xl leading-none text-volt">
              {positionShort || "—"}
            </p>
            <p className="mt-1 text-[10px] tracking-widest text-volt/70 uppercase">
              {footLabel || "Pie"}
            </p>
          </div>
          <p className="font-display text-sm leading-tight tracking-widest text-foreground/40">
            DREAM
            <br />
            TEAM
          </p>
        </div>

        <div className="mt-3 flex justify-center">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Foto de ${name || "jugador"}`}
              className="size-28 rounded-full border-2 border-volt/40 object-cover"
            />
          ) : (
            <div className="flex size-28 items-center justify-center rounded-full border-2 border-dashed border-volt/40 bg-secondary/60">
              <UserRound className="size-12 text-muted-foreground/60" aria-hidden />
            </div>
          )}
        </div>

        <p className="mt-4 truncate text-center font-display text-2xl tracking-wide text-foreground uppercase">
          {name || "Tu nombre"}
        </p>

        <div className="mx-auto mt-2 h-px w-3/4 bg-volt/40" />

        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div>
            <p className="font-display text-xl text-foreground">{age || "—"}</p>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              Edad
            </p>
          </div>
          <div>
            <p className="truncate font-display text-xl text-foreground">
              {memberSince || "—"}
            </p>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              En el DT
            </p>
          </div>
        </div>

        {teamName ? (
          <p className="mt-auto pt-3 text-center font-display text-sm tracking-widest text-volt uppercase">
            {teamName}
          </p>
        ) : null}
      </div>
    </div>
  );
}
