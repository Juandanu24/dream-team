import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/supabase/server";
import { logout } from "../actions";

const nav = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/inscripciones", label: "Inscripciones" },
  { href: "/admin/equipos", label: "Equipos" },
  { href: "/admin/partidos", label: "Partidos" },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link
            href="/admin"
            className="shrink-0 font-display text-xl tracking-wide whitespace-nowrap"
          >
            ADMIN <span className="text-volt">DT</span>
          </Link>
          <nav className="scrollbar-none flex flex-1 items-center gap-1 overflow-x-auto">
            {nav.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link href="/">
                <ExternalLink aria-hidden /> Ver sitio
              </Link>
            </Button>
          </nav>
          <form action={logout} className="shrink-0">
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              className="text-muted-foreground hover:text-destructive"
              title="Cerrar sesión"
            >
              <LogOut aria-hidden />
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
