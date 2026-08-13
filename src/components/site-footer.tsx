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
        <div className="flex flex-col items-center gap-1 sm:items-end">
          <p className="text-xs text-muted-foreground">
            Desarrollado por{" "}
            <a
              href="https://github.com/Juandanu24"
              target="_blank"
              rel="noopener noreferrer"
              className="text-volt underline-offset-4 hover:underline"
            >
              Juan David
            </a>{" "}
            ⚡
          </p>
          <Link
            href="/admin"
            className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
