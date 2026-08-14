"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <Card className="w-full max-w-sm border-border/60 bg-card/80">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto size-8 text-volt" aria-hidden />
          <CardTitle className="font-display text-3xl tracking-wide">
            ADMIN <span className="text-volt">DREAM TEAM</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground"
        asChild
      >
        <Link href="/">
          <ArrowLeft aria-hidden /> Volver al inicio
        </Link>
      </Button>
    </div>
  );
}
