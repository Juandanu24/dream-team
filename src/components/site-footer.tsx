import Link from "next/link";

/** El glifo de Instagram, dibujado acá: lucide sacó las marcas de su
 *  catálogo y `Instagram` ya no existe en el paquete. */
function IconoInstagram() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-dt-blue"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
              DREAM <span className="text-volt-text">TEAM</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Pasión, amistad y buen fútbol. Montería, Colombia.
          </p>
          {/* Instagram es donde se publica todo: la cuenta va acá como
              enlace de verdad, no como texto suelto. */}
          <a
            href="https://instagram.com/dreamteam_colombia"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <IconoInstagram />
            @dreamteam_colombia
          </a>
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
