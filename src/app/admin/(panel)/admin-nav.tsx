"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/inscripciones", label: "Inscripciones" },
  { href: "/admin/equipos", label: "Equipos" },
  { href: "/admin/partidos", label: "Partidos" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="scrollbar-none flex flex-1 items-center gap-1 overflow-x-auto">
      {nav.map((item) => {
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
            <Link href={item.href}>{item.label}</Link>
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
