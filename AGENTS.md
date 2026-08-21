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
  equipos, partidos, `alineaciones`, resultados y `piezas` (generador de
  imágenes para redes).
- Las fotos van al bucket público `player-photos`, comprimidas en el cliente
  (webp ≤ 250 KB) antes de la server action.

## Estado del proyecto

Construido: landing, inscripción, `/torneo`, login admin, cola de aprobación,
equipos (CRUD + escudos + asignación de aprobados), partidos (fixture, marcadores,
goles/asistencias/tarjetas por jugador), PWA, `/penales` (reto arcade con
ranking) y `/admin/piezas` (generador de imágenes para Instagram: anuncio,
resultado, posiciones, goleadores, equipo y penales, en feed 1080×1350 y
story 1080×1920, con el texto del post sugerido y editable) y
`/admin/alineaciones` (titular por equipo y partido, con push, WhatsApp e
imagen de cancha). Desplegado en Vercel: dreamteamcolombia.vercel.app.

Las alineaciones no guardan coordenadas: guardan la línea (`gk`/`def`/`mid`/
`fwd`) más el `slot` dentro de la línea, de izquierda a derecha. Con eso la
cancha se dibuja sin ambigüedad y cambiar de formación no obliga a recolocar
a nadie. `published_at` en null = borrador: no sale en la web pública ni
dispara push. Republicar una alineación editada NO vuelve a notificar, para
no sonarle el teléfono a todos dos veces.

El reto de penales tiene la lógica pura en `src/lib/penalty-game.ts` (zonas,
arquero adaptativo, resolución del disparo) separada de la UI: se puede simular
con `node --experimental-strip-types` para rebalancear sin abrir el navegador.

El entorno se configura siguiendo `SETUP.md` (crear proyecto Supabase, migración,
`.env.local`, usuario admin). Sin `.env.local` el sitio compila y muestra estados vacíos.

## Convenciones

- Commits en español. No hacer push ni crear ramas remotas sin confirmación explícita.
- Diseño en dos temas anclados al OS, con tokens en `globals.css`:
  **dark** = noche de estadio (negro #0A0A0A, volt #CCFF00, azul #4FA8FF);
  **light** = día de cancha (hueso #F1EDE4, oliva #55700A, turquesa #0E6E75).
  Fuentes Bebas Neue/Archivo vía `font-display`/`font-sans`.
- **Dos acentos con roles fijos**, para que no compitan: `--volt` es ACCIÓN y
  presente (inscríbete, gol, en vivo, campeón); `--dt-blue` es INFORMACIÓN y
  navegación (enlaces, tabs, fechas, asistencias, datos secundarios).
  Los colores del logo no se usan literales: el azul #015EF8 da 3.73:1 sobre el
  negro y 4.90:1 sobre el claro, o sea que no pasa AA en ninguno de los dos.
- Las imágenes para redes se dibujan en canvas en el navegador
  (`src/lib/post-image.ts`, igual que `card-image.ts`) porque así usan las
  fuentes reales de next/font; un script de Node no las tiene. Los bloques
  se posicionan contra `L.footerY` (espacio disponible), no con offsets
  fijos: una nómina de 22 nombres o un panel con goleadores se montaban
  sobre el pie en formato feed. En la pieza de resultado los goleadores
  van en dos columnas, una por equipo, con el alto de fila calculado y
  un "+N más" cuando la lista no cabe: como una sola línea, en un
  partido de muchos goles se salía del panel. El autogol aparece en la
  columna del equipo que se benefició, marcado (e.c.), para que los
  nombres de cada columna cuadren con su marcador. En la cancha de
  alineaciones cada jugador va con su foto recortada en círculo; las
  iniciales quedan solo de respaldo para quien no tenga. Las fotos se
  cargan una vez por URL, no una por jugador.
- En los editores de alineación y once ideal, el que ya está puesto en una
  casilla NO aparece en las otras listas: así se ve de un vistazo quién
  falta y no hay forma de moverlo de posición sin querer.
- La figura del partido es POR PARTIDO (columna en `matches`), no por
  semana: en una semana hay dos partidos y por tanto dos figuras.
- La pieza `duelo` es la única que NO usa `drawChrome`: va a sangre, con
  las fotos ocupando el lienzo. Por eso `PostImageData` separa `Common`
  (solo el formato) de `ConMarco` (encabezado y titular), y el duelo no
  lleva el segundo: pedirle un eyebrow sería un campo muerto. Sus fotos
  las sube el admin, no salen de la base.
- `public/marco-duelo.webp` es un marco generado con IA, en BLANCO Y
  NEGRO a propósito: `tintarMarco()` lo multiplica por el color de cada
  equipo (arriba el local, abajo el visitante), así una sola plantilla
  sirve para los seis cruces. Se dibuja encima de las fotos en modo
  `screen`, que vuelve invisible su negro — por eso no hay que recortar
  los huecos a mano ni acertar los píxeles del PNG. Las fracciones de
  `HUECO` se midieron analizando el brillo fila por fila del archivo: si
  se cambia el marco, hay que volver a medirlas. Y el lienzo toma la
  proporción del marco (2:3), porque estirarlo a 4:5 achataría el VS.
- `public/nombre-<slug-del-equipo>.webp` son los nombres en letra de
  brocha, también en BLANCO sobre transparente y teñidos por código. El
  slug sale del nombre del equipo, así que agregar un equipo es dejar
  caer el archivo. Si no existe, `loadImage` falla en silencio y se cae
  al texto en Bebas inclinada: por eso un equipo puede quedarse sin el
  suyo sin romper nada.
- Privacidad: el email de los jugadores no se muestra en ninguna vista pública;
  solo en el panel admin.
