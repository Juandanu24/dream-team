"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, ShieldCheck, Target, Trophy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/torneo", label: "Torneo", icon: Trophy },
  { href: "/penales", label: "Penales", icon: Target },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="font-display text-2xl tracking-wide text-foreground">
            DREAM
          </span>
          <span className="font-display text-2xl tracking-wide text-volt">
            TEAM
          </span>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              className={cn(
                "text-muted-foreground hover:text-foreground",
                isActive(pathname, link.href) &&
                  "bg-secondary text-foreground",
              )}
              asChild
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          <Button size="sm" className="ml-1 font-semibold" asChild>
            <Link href="/inscripcion">Inscríbete</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              pathname.startsWith("/admin") && "bg-secondary text-foreground",
            )}
            title="Panel de administración"
            asChild
          >
            <Link href="/admin">
              <ShieldCheck aria-hidden /> Admin
            </Link>
          </Button>
          <ThemeToggle />
        </nav>

        {/* Mobile: hamburguesa */}
        <div className="flex items-center gap-1 sm:hidden">
          <Button size="sm" className="font-semibold" asChild>
            <Link href="/inscripcion">Inscríbete</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" title="Menú">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="font-display text-2xl tracking-wide">
                  DREAM <span className="text-volt">TEAM</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {links.map((link) => (
                  <Button
                    key={link.href}
                    variant="ghost"
                    className={cn(
                      "justify-start text-muted-foreground",
                      isActive(pathname, link.href) &&
                        "bg-secondary text-foreground",
                    )}
                    asChild
                    onClick={() => setOpen(false)}
                  >
                    <Link href={link.href}>
                      <link.icon aria-hidden /> {link.label}
                    </Link>
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className={cn(
                    "justify-start text-muted-foreground",
                    pathname.startsWith("/inscripcion") &&
                      "bg-secondary text-foreground",
                  )}
                  asChild
                  onClick={() => setOpen(false)}
                >
                  <Link href="/inscripcion">
                    <UserPlus aria-hidden /> Inscripción
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  className={cn(
                    "justify-start text-muted-foreground",
                    pathname.startsWith("/admin") &&
                      "bg-secondary text-foreground",
                  )}
                  asChild
                  onClick={() => setOpen(false)}
                >
                  <Link href="/admin">
                    <ShieldCheck aria-hidden /> Admin
                  </Link>
                </Button>
                <div className="mt-2 border-t border-border/60 pt-2">
                  <ThemeToggle withLabel />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
