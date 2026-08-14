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
  /** Versión mini para grillas con muchos jugadores. */
  compact?: boolean;
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
  compact = false,
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
      <div
        className={cn(
          "flex h-full flex-col bg-gradient-to-b from-[#f3f7dd] via-[#fbfcf4] to-[#e9eecf] [clip-path:polygon(0_3%,50%_0,100%_3%,100%_90%,50%_100%,0_90%)] dark:from-[#1c2205] dark:via-[#111403] dark:to-[#0a0b02]",
          compact ? "px-2.5 pt-3 pb-5" : "px-5 pt-6 pb-10",
        )}
      >
        <div className="flex items-start justify-between">
          <div className="text-center">
            <p
              className={cn(
                "font-display leading-none text-volt",
                compact ? "text-lg" : "text-4xl",
              )}
            >
              {positionShort || "—"}
            </p>
            {compact ? null : (
              <p className="mt-1 text-[10px] tracking-widest text-volt/70 uppercase">
                {footLabel || "Pie"}
              </p>
            )}
          </div>
          <p
            className={cn(
              "font-display leading-tight tracking-widest text-foreground/40",
              compact ? "text-[8px]" : "text-sm",
            )}
          >
            DREAM
            <br />
            TEAM
          </p>
        </div>

        <div className={cn("flex justify-center", compact ? "mt-1" : "mt-3")}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Foto de ${name || "jugador"}`}
              className={cn(
                "rounded-full border-2 border-volt/40 object-cover",
                compact ? "size-14" : "size-28",
              )}
            />
          ) : (
            <div
              className={cn(
                "flex items-center justify-center rounded-full border-2 border-dashed border-volt/40 bg-secondary/60",
                compact ? "size-14" : "size-28",
              )}
            >
              <UserRound
                className={cn(
                  "text-muted-foreground/60",
                  compact ? "size-6" : "size-12",
                )}
                aria-hidden
              />
            </div>
          )}
        </div>

        <p
          className={cn(
            "truncate text-center font-display tracking-wide text-foreground uppercase",
            compact ? "mt-1.5 text-xs" : "mt-4 text-2xl",
          )}
        >
          {name || "Tu nombre"}
        </p>

        <div
          className={cn(
            "mx-auto h-px w-3/4 bg-volt/40",
            compact ? "mt-1" : "mt-2",
          )}
        />

        <div
          className={cn(
            "grid grid-cols-2 gap-2 text-center",
            compact ? "mt-1.5" : "mt-3",
          )}
        >
          <div>
            <p
              className={cn(
                "font-display text-foreground",
                compact ? "text-sm" : "text-xl",
              )}
            >
              {age || "—"}
            </p>
            <p
              className={cn(
                "tracking-widest text-muted-foreground uppercase",
                compact ? "text-[7px]" : "text-[10px]",
              )}
            >
              Edad
            </p>
          </div>
          <div>
            <p
              className={cn(
                "truncate font-display text-foreground",
                compact ? "text-sm" : "text-xl",
              )}
            >
              {memberSince || "—"}
            </p>
            <p
              className={cn(
                "tracking-widest text-muted-foreground uppercase",
                compact ? "text-[7px]" : "text-[10px]",
              )}
            >
              En el DT
            </p>
          </div>
        </div>

        {teamName ? (
          <p
            className={cn(
              "mt-auto truncate text-center font-display tracking-widest text-volt uppercase",
              compact ? "pt-1.5 text-[8px]" : "pt-3 text-sm",
            )}
          >
            {teamName}
          </p>
        ) : null}
      </div>
    </div>
  );
}
