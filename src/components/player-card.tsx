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
// Colores fijos (no dependen del tema): la carta es "física", siempre
// noche de estadio con neón, en light y dark.
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
        "w-full max-w-[280px] bg-gradient-to-b from-[#ccff00] via-[#ccff00]/35 to-[#ccff00]/10 p-[2px]",
        "[clip-path:polygon(0_3%,50%_0,100%_3%,100%_90%,50%_100%,0_90%)]",
        "drop-shadow-[0_0_25px_rgba(204,255,0,0.2)]",
        className,
      )}
    >
      <div className="flex h-full flex-col bg-gradient-to-b from-[#1c2205] via-[#111403] to-[#0a0b02] px-5 pt-6 pb-10 [clip-path:polygon(0_3%,50%_0,100%_3%,100%_90%,50%_100%,0_90%)]">
        <div className="flex items-start justify-between">
          <div className="text-center">
            <p className="font-display text-4xl leading-none text-[#ccff00]">
              {positionShort || "—"}
            </p>
            <p className="mt-1 text-[10px] tracking-widest text-[#ccff00]/60 uppercase">
              {footLabel || "Pie"}
            </p>
          </div>
          <p className="font-display text-sm leading-tight tracking-widest text-white/50">
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
              className="size-28 rounded-full border-2 border-[#ccff00]/40 object-cover"
            />
          ) : (
            <div className="flex size-28 items-center justify-center rounded-full border-2 border-dashed border-[#ccff00]/30 bg-neutral-900/60">
              <UserRound className="size-12 text-neutral-500" aria-hidden />
            </div>
          )}
        </div>

        <p className="mt-4 truncate text-center font-display text-2xl tracking-wide text-neutral-50 uppercase">
          {name || "Tu nombre"}
        </p>

        <div className="mx-auto mt-2 h-px w-3/4 bg-[#ccff00]/30" />

        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div>
            <p className="font-display text-xl text-neutral-50">{age || "—"}</p>
            <p className="text-[10px] tracking-widest text-neutral-400 uppercase">
              Edad
            </p>
          </div>
          <div>
            <p className="truncate font-display text-xl text-neutral-50">
              {memberSince || "—"}
            </p>
            <p className="text-[10px] tracking-widest text-neutral-400 uppercase">
              En el DT
            </p>
          </div>
        </div>

        {teamName ? (
          <p className="mt-auto pt-3 text-center font-display text-sm tracking-widest text-[#ccff00]/80 uppercase">
            {teamName}
          </p>
        ) : null}
      </div>
    </div>
  );
}
