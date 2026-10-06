import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnvBadge } from "@/components/env-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { getActiveTournamentName, getTournamentStatus } from "@/lib/data";
import { getAdminUser } from "@/lib/supabase/server";
import { logout } from "../actions";
import { AdminMobileMenu } from "./admin-mobile-menu";
import { AdminSidebarNav } from "./admin-nav";
import { AdminTournamentBadge } from "./admin-tournament-badge";

// El admin vive en una barra lateral fija, no en el encabezado.
//
// Con nueve secciones la fila horizontal se desbordaba: en pantallas
// medianas la última salía cortada y el scroll lateral ni se notaba.
// Apiladas caben todas sin esconder nada, y arriba queda siempre a la
// vista qué torneo se está tocando. Debajo de lg manda el menú de
// hamburguesa, que ya existía.
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const [nombreTorneo, status] = await Promise.all([
    getActiveTournamentName(),
    getTournamentStatus(),
  ]);

  const marca = (
    <Link
      href="/admin"
      className="shrink-0 font-display text-xl tracking-wide whitespace-nowrap"
    >
      ADMIN <span className="text-volt">DT</span>
    </Link>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border/60 bg-card/30 lg:flex">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4">
          {marca}
          <EnvBadge />
        </div>

        <AdminTournamentBadge nombre={nombreTorneo} status={status} />

        <AdminSidebarNav />

        <div className="shrink-0 space-y-1 border-t border-border/60 p-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/">
              <ExternalLink aria-hidden /> Ver sitio
            </Link>
          </Button>
          <ThemeToggle withLabel />
          <form action={logout}>
            <Button
              variant="ghost"
              type="submit"
              className="w-full justify-start text-muted-foreground hover:text-destructive"
            >
              <LogOut aria-hidden /> Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            {marca}
            <EnvBadge />
            <span className="ml-auto flex items-center gap-1">
              <AdminMobileMenu />
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
