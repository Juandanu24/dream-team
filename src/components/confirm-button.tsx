"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ConfirmButtonProps {
  action: () => Promise<void>;
  message: string;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  title?: string;
  className?: string;
}

// Botón que pide confirmación antes de ejecutar una server action.
export function ConfirmButton({
  action,
  message,
  children,
  variant = "destructive",
  size = "sm",
  title,
  className,
}: ConfirmButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size={size}
      title={title}
      className={className}
      disabled={pending}
      onClick={() => {
        if (!confirm(message)) return;
        startTransition(async () => {
          try {
            await action();
          } catch {
            toast.error("No se pudo completar la acción");
          }
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : children}
    </Button>
  );
}
