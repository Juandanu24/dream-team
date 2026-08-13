import Link from "next/link";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/torneo", label: "Torneo" },
];

export function SiteHeader() {
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

        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          <Button size="sm" className="ml-1 font-semibold" asChild>
            <Link href="/inscripcion">Inscríbete</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
