"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  ListChecks,
  Image as ImageIcon,
  ClipboardCheck,
  Star,
  LayoutDashboard,
  Swords,
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
  { href: "/admin/amistosos", label: "Amistosos", icon: Swords },
  { href: "/admin/resultados", label: "Resultados", icon: ListChecks },
  { href: "/admin/once-ideal", label: "Once ideal", icon: Star },
  { href: "/admin/piezas", label: "Piezas", icon: ImageIcon },
];

export function esRutaActiva(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

// Las nueve secciones, una debajo de otra en la barra lateral.
//
// Antes iban en el encabezado, en fila. Nueve botones no caben en una
// barra de 14 de alto: en pantallas medianas el último quedaba cortado y
// había que descubrir que la fila se deslizaba. Apiladas se leen todas de
// una, y la sección en la que estás se ve sin buscarla.
export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {ADMIN_NAV.map((item) => (
        <Button
          key={item.href}
          variant="ghost"
          size="sm"
          className={cn(
            "justify-start text-muted-foreground hover:text-foreground",
            esRutaActiva(pathname, item.href) &&
              "bg-secondary text-foreground",
          )}
          asChild
        >
          <Link href={item.href}>
            <item.icon aria-hidden /> {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
