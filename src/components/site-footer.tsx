import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="font-display text-lg tracking-wide">
            DREAM <span className="text-volt">TEAM</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Pasión, amistad y buen fútbol. Montería, Colombia.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        >
          Admin
        </Link>
      </div>
    </footer>
  );
}
