<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Dream Team

Web del 1er Torneo Amistoso del Dream Team (grupo de fútbol de Montería, +80 personas):
inscripción de jugadores con carta estilo FIFA, panel admin para aprobar inscritos,
armar equipos y cargar resultados, y vista pública del torneo. **Comunicarse en español;
todo el copy de cara al usuario va en español colombiano (tuteo, nunca voseo).**

## Stack

Next.js (App Router) + TypeScript + Tailwind 4 + shadcn/ui + Supabase (Postgres, Storage,
Auth). Deploy en Vercel. Gestor de paquetes: pnpm.

## Arquitectura de datos — la decisión que explica todo

**Todo acceso a datos pasa por el servidor.** RLS está habilitado sin políticas:
la anon key no puede leer ni escribir nada por la API pública.

- `src/lib/supabase/admin.ts` — cliente service role (`server-only`). Único camino a los
  datos: lecturas públicas, inscripción y mutaciones del admin.
- `src/lib/supabase/server.ts` — cliente SSR con cookies. Solo para la sesión de auth del
  admin (`getAdminUser()`). Toda server action de admin debe verificar `getAdminUser()`
  antes de mutar.
- `src/proxy.ts` — protege `/admin/*` (Next 16: `proxy.ts`, no `middleware.ts`).

Los jugadores **no tienen login**: la inscripción es pública y el filtro contra colados es
la aprobación del admin (`registrations.status`).

## Dominio

Schema en `supabase/migrations/` (fuente de verdad; espejo TS en `src/lib/types.ts`).
Todo cuelga de `tournaments` para reutilizar jugadores en torneos futuros; el torneo
activo se fija con `ACTIVE_TOURNAMENT_SLUG` en `src/lib/types.ts`.

Posiciones, goleadores y tarjetas **no se guardan**: son vistas SQL (`group_standings`,
`top_scorers`, `player_cards`) derivadas de `matches` y `match_events`. El admin solo
carga marcadores y eventos.

Identificadores en inglés (tablas, columnas, enums); etiquetas en español para la UI en
los mapas `*_LABELS` de `src/lib/types.ts`.

## Rutas

- `(public)/` — landing, `/inscripcion` (form + carta en vivo), `/torneo` (tabs:
  posiciones, calendario, equipos, goleadores). Páginas con datos usan
  `force-dynamic` y degradan a estados vacíos si Supabase no responde.
- `admin/login` + `admin/(panel)/` — panel, inscripciones (aprobar/rechazar),
  equipos y partidos (pendientes de construir, ver Estado).
- Las fotos van al bucket público `player-photos`, comprimidas en el cliente
  (webp ≤ 250 KB) antes de la server action.

## Estado del proyecto

Construido: landing, inscripción, `/torneo`, login admin, cola de aprobación,
equipos (CRUD + escudos + asignación de aprobados), partidos (fixture, marcadores,
goles/asistencias/tarjetas por jugador), PWA, y `/penales` (reto arcade con
ranking). Desplegado en Vercel: dreamteamcolombia.vercel.app.

El reto de penales tiene la lógica pura en `src/lib/penalty-game.ts` (zonas,
arquero adaptativo, resolución del disparo) separada de la UI: se puede simular
con `node --experimental-strip-types` para rebalancear sin abrir el navegador.

El entorno se configura siguiendo `SETUP.md` (crear proyecto Supabase, migración,
`.env.local`, usuario admin). Sin `.env.local` el sitio compila y muestra estados vacíos.

## Convenciones

- Commits en español. No hacer push ni crear ramas remotas sin confirmación explícita.
- Diseño dark-only calcado del flyer: tokens en `globals.css` (`--volt` #CCFF00,
  fuentes Bebas Neue/Archivo vía `font-display`/`font-sans`).
- Privacidad: el email de los jugadores no se muestra en ninguna vista pública;
  solo en el panel admin.
