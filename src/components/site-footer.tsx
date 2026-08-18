import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          {/* El monograma + el nombre como texto: el "DREAM TEAM" que trae el
              logo es blanco con contorno negro y se pierde sobre el fondo
              hueso del tema claro. Como texto se lee en los dos temas. */}
          <div className="flex items-center justify-center gap-2.5 sm:justify-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-dt.webp"
              alt=""
              width={480}
              height={259}
              className="h-9 w-auto"
            />
            <span className="font-display text-2xl tracking-wide">
              DREAM <span className="text-volt">TEAM</span>
            </span>
          </div>
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
              className="text-dt-blue underline-offset-4 hover:underline"
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
