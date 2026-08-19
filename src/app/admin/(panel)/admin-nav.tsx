"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  ListChecks,
  ExternalLink,
  Image as ImageIcon,
  ClipboardCheck,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ADMIN_NAV = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/inscripciones", label: "Inscripciones", icon: ClipboardList },
  { href: "/admin/equipos", label: "Equipos", icon: Users },
  { href: "/admin/partidos", label: "Calendario", icon: CalendarDays },
  { href: "/admin/alineaciones", label: "Alineaciones", icon: ClipboardCheck },
  { href: "/admin/resultados", label: "Resultados", icon: ListChecks },
  { href: "/admin/piezas", label: "Piezas", icon: ImageIcon },
];

// Nav de escritorio del admin; en mobile se usa AdminMobileMenu.
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="scrollbar-none hidden flex-1 items-center gap-1 overflow-x-auto sm:flex">
      {ADMIN_NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Button
            key={item.href}
            variant="ghost"
            size="sm"
            className={cn(
              "shrink-0 text-muted-foreground hover:text-foreground",
              active && "bg-secondary text-foreground",
            )}
            asChild
          >
            <Link href={item.href}>
              <item.icon aria-hidden /> {item.label}
            </Link>
          </Button>
        );
      })}
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
  );
}
