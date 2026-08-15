import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnvBadge } from "@/components/env-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAdminUser } from "@/lib/supabase/server";
import { logout } from "../actions";
import { AdminMobileMenu } from "./admin-mobile-menu";
import { AdminNav } from "./admin-nav";

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
          <EnvBadge />
          <AdminNav />
          <div className="ml-auto hidden items-center gap-1 sm:flex">
            <ThemeToggle />
            <form action={logout}>
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
          <div className="ml-auto sm:hidden">
            <AdminMobileMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
