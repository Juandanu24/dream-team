"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { borrarAmistoso } from "./actions";

export function DeleteFriendlyButton({
  friendlyId,
  title,
}: {
  friendlyId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm(`¿Borrar "${title}" con sus dos alineaciones?`)) return;
        startTransition(async () => {
          try {
            await borrarAmistoso(friendlyId);
            toast.success("Amistoso borrado");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "No se pudo borrar",
            );
          }
        });
      }}
    >
      <Trash2 aria-hidden /> Borrar amistoso
    </Button>
  );
}
