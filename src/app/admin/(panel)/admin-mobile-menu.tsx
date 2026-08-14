"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut, Menu } from "lucide-react";
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
import { logout } from "../actions";
import { ADMIN_NAV } from "./admin-nav";

export function AdminMobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" title="Menú" className="sm:hidden">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-64">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl tracking-wide">
            ADMIN <span className="text-volt">DT</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          {ADMIN_NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "justify-start text-muted-foreground",
                  active && "bg-secondary text-foreground",
                )}
                asChild
                onClick={() => setOpen(false)}
              >
                <Link href={item.href}>
                  <item.icon aria-hidden /> {item.label}
                </Link>
              </Button>
            );
          })}
          <Button
            variant="ghost"
            className="justify-start text-muted-foreground"
            asChild
            onClick={() => setOpen(false)}
          >
            <Link href="/">
              <ExternalLink aria-hidden /> Ver sitio
            </Link>
          </Button>
          <div className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2">
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
        </nav>
      </SheetContent>
    </Sheet>
  );
}
