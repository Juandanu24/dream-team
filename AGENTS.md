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

**Este archivo dice cómo está hecho el proyecto. Hay otros dos, y hay que
leerlos antes de implementar:**

- **`ORQUESTACION.md`** — cómo se trabaja y qué falta: la disciplina de
  verificación, el estado del torneo, los puertos, el render de piezas fuera
  del navegador y el backlog.
- **`CONTENIDO.md`** — para qué existe cada pieza: el criterio editorial, cómo
  se encadenan en una fecha, cómo se escriben los copys y de dónde salen los
  assets de marca.

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
  posiciones, calendario, equipos, goleadores), `/torneos/[slug]` (el mismo
  tablero para un torneo archivado) e `/historia` (palmarés). Páginas con
  datos usan `force-dynamic` y degradan a estados vacíos si Supabase no
  responde.
- `admin/login` + `admin/(panel)/` — panel, inscripciones (aprobar/rechazar),
  equipos, partidos, `alineaciones`, `amistosos`, `once-ideal`, resultados y
  `piezas` (generador de imágenes para redes).
- Las fotos van al bucket público `player-photos`, comprimidas en el cliente
  (webp ≤ 250 KB) antes de la server action.

## Estado del proyecto

Construido: landing, inscripción, `/torneo`, login admin, cola de aprobación,
equipos (CRUD + escudos + asignación de aprobados), partidos (fixture, marcadores,
goles/asistencias/tarjetas por jugador), PWA, `/penales` (reto arcade con
ranking) y `/admin/piezas` (generador de imágenes para Instagram: anuncio,
resultado, posiciones, goleadores, asistencias, figura, duelo, equipo,
perfil y penales, en feed 1080×1350 y story 1080×1920, con el texto del
post sugerido y editable — el catálogo y el criterio de cada una están en
`CONTENIDO.md`) y
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

`/admin/amistosos` arma los picados por fuera del torneo (migración 00013),
con la misma cancha, el mismo mensaje de WhatsApp y el mismo botón de imagen.

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
- **El lima y el cian son RELLENO, nunca texto.** `--volt` vale `#d4f000` en
  los dos temas porque siempre lleva tinta oscura encima (14.37:1). Como
  letra sobre blanco daría 1.29:1, así que para lima en texto está
  **`--volt-text`** (`#4f6600` en claro, 6.50:1; el mismo lima en oscuro).
  Usar `text-volt` en vez de `text-volt-text` deja el texto ilegible en el
  tema claro y el compilador no lo detecta: ya pasó.
- **Cada tema se queda con un extremo del trazo del logo.** El monograma va
  de azul a cian: oscuro usa el cian `#35D2E8` (10.82:1), claro usa el azul
  eléctrico `#0A3FE8` (7.27:1 sobre blanco), que es el color real de la D.
  El azul se había descartado entero por dar 3.71:1 sobre negro — el error
  era tratarlo como token único en vez de dejarlo cambiar de familia.
- **Las capas se separan por valor, no por borde.** `#FFFFFF` sobre
  `#EBEEF4` da 1.16:1, suficiente para que una tarjeta exista sin contorno.
  El fondo claro viejo (`#f1ede4` con tarjetas `#fbf9f5`) daba 1.06:1, y por
  eso había que ponerle borde a todo: no sobraba borde, faltaba escalón.
  Las tarjetas van `bg-card shadow-card` sin borde; `shadow-card` son dos
  sombras suaves en claro y un filo de luz interior en oscuro, que es como
  iOS levanta una superficie sobre negro. `--separator` es la línea capilar.
- **Las piezas de canvas NO leen los colores de `globals.css`** — solo las
  variables de fuente. Sus hexes son propios y viven en `post-image.ts`, así
  que cambiar el tema de la web no mueve lo ya publicado en Instagram.
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
  El bloque escudo+nombre se ajusta midiendo **lo que se va a dibujar**:
  si hay imagen de brocha, su ancho a partir de la proporción, no el
  texto en Bebas. Midiendo el texto, un nombre corto (COLOMBIA) no
  achicaba nada, dejaba un escudo enorme y a la imagen —de una sola
  línea, razón 3.1 contra 1.8 de las de dos— sin espacio, y se le metía
  debajo al VS. Los archivos van recortados y a 260 de alto.
- **El encuadre de la foto es del jugador, no de la pieza.** Las fotos las
  manda cada quien desde el celular —unas de cuerpo entero, otras primer
  plano, otras horizontales—, así que un recorte fijo que le sirve a una le
  corta la cabeza a la siguiente. `players.photo_zoom / photo_offset_x /
  photo_offset_y` (migración 00012) guardan cómo recortar ESA foto; se
  ajusta una vez en `/admin/piezas` y sirve para todas las piezas. Nulo =
  sin ajustar, y cada pieza aplica su valor de arranque.
  La convención es única: el zoom parte de 1 = la foto justo cubre el
  marco, y `x`/`y` van de -1 a 1 **medidos sobre lo que sobra**, no en
  píxeles, de modo que ±1 pega la foto contra el borde y nunca deja un
  vacío, sea cual sea la proporción del original. Esa cuenta vive solo en
  `drawCover()`: si cada pieza hiciera la suya, el mismo deslizador
  significaría cosas distintas según dónde se use. `ENCUADRE_PERFIL`
  (y = 0.16) reproduce exactamente el recorte que tenía la pieza de perfil
  antes de que el encuadre fuera ajustable, para que nada ya publicado se
  moviera.
- En la pieza de perfil **solo entran los números mayores que cero**. Un
  "0 goles · 0 asistencias" no informa nada y encima deja al jugador como
  si no hubiera hecho nada; hoy son 26 de 53. Sin números la foto crece y
  el escudo se centra en el hueco que queda, en vez de dejar un vacío.
- **Los amistosos no cuelgan del torneo** (`friendlies`, `friendly_sides`,
  `friendly_players`, migración 00013). No es duplicación por pereza: todo lo
  del torneo tiene `tournament_id` not null, y `team_players` tiene
  `unique (tournament_id, player_id)` —un jugador en un solo equipo por
  torneo—, que con lados que rotan cada semana se rompe al segundo partido.
  En `friendly_players`, `player_id` es NULABLE y va con `guest_name`: así
  entra quien no está inscrito sin inventarle un correo en `players`, que
  exige email único, edad, pie y posición. El `check` obliga a que haya uno
  de los dos. Y el `friendly_id` repetido con clave foránea compuesta es lo
  que permite el índice único que impide jugar para los dos lados: mismo
  truco que `team_players` con `(team_id, tournament_id)`.
  No hay `published_at` ni push: es una herramienta del admin para mandar la
  alineación al grupo, y los suscritos a push lo son del torneo.
- Ojo con los códigos de error al detectar "falta la migración":
  **PostgREST devuelve `PGRST205`**, no el `42P01` de Postgres. Hay que mirar
  los dos según por dónde entre la consulta.
- **Una definición por penales no cambia el marcador.** `matches.home_penalties
  / away_penalties` (migración 00014) guardan la tanda aparte: un 0-0 definido
  desde el punto blanco sigue siendo 0-0 para la tabla y la diferencia de gol,
  que es como lo cuenta el fútbol. Los `check` obligan a que estén los dos o
  ninguno, a que no terminen empatados y a que solo existan si el partido
  quedó empatado. Quién ganó lo resuelve `matchWinner()`, que mira primero el
  marcador y después la tanda.
- **`tracked()` CENTRA en la x que recibe, no alinea a la izquierda.** Pasarle
  el borde izquierdo de un bloque corre media etiqueta hacia atrás — así se
  montó sobre el escudo en el podio. Para anclar a la izquierda está
  `trackedLeft()`.
- El aviso de "faltan goles por asignar" **solo sale si hay alguno cargado**.
  Cero goleadores en un 10-6 es una decisión válida, no un error; el aviso es
  para la carga a medias, donde los nombres no cuadran con el marcador.
- En la pieza `premio` (goleador y MVP del torneo) los bloques se calculan
  **de abajo hacia arriba**: se reserva la cifra, después el nombre, y lo que
  sobre se lo queda la foto. Apilando desde arriba con offsets fijos, la
  cifra terminaba encima de la línea del equipo apenas la foto crecía. El
  nombre va centrado en el hueco que queda, así se acomoda solo cuando la
  foto tope por ancho en vez de por alto.
- **Los datos del torneo se cachean con `unstable_cache` y la etiqueta
  `TAG_TORNEO`, pero las páginas siguen siendo `force-dynamic`.** Las dos
  mitades importan. Sin caché, `/torneo` hacía 9 consultas a Supabase en cada
  visita y tardaba más de un segundo. Y prerenderizando, el build —que corre
  sin credenciales— habría guardado el estado vacío y el primer visitante
  vería eso. Las acciones del admin llaman **`updateTag`**, no
  `revalidateTag`: `updateTag` expira de inmediato y el admin ve su propio
  cambio, mientras que `revalidateTag` sirve una versión vieja mientras
  refresca por detrás.
- **`/torneo` y `/torneos/[slug]` comparten `TournamentView`.** Es la misma
  pantalla: duplicarla sería arreglar cada cosa dos veces. Los loaders de
  `src/lib/` reciben el slug con el activo como valor por defecto, para no
  romper a los llamadores que ya existían.
- **El bucket `payment-proofs` es PRIVADO**, al revés que `player-photos` y
  `team-crests`. Un comprobante de pago lleva banco, monto y a veces el
  número de cuenta de una persona: en un bucket público queda en una URL que
  cualquiera que la tenga abre, para siempre. Se guarda solo la ruta, y el
  admin lo mira con una URL firmada que vence en un minuto.
- **Los premios de un torneo se guardan, no se calculan** (`tournament_awards`,
  migración 00016). El campeón y el podio salen de los partidos, pero el MVP
  lo escoge el organizador a dedo. La cifra va como texto y congelada: si
  mañana se corrigen eventos de un partido viejo, un premio ya entregado no
  debe cambiar solo.
- **El home es ESTÁTICO a propósito**, y lee Supabase igual. Es la única
  página pública que no es `force-dynamic`, y conviene saber por qué antes
  de "arreglarla": el build SÍ tiene credenciales y hornea los datos reales
  en el HTML —se comprobó: el campeón sale en el prerender—, así que lo que
  cuenta del torneo 1 no necesita ser dinámico. Y no puede quedarse viejo:
  ese torneo está `finished` y su campeón, su podio y sus premios ya no
  cambian. A cambio se sirve desde el CDN en 3 ms sin invocar función, que
  es lo que importa para quien llega de Instagram con datos móviles.
  La página hereda `revalidate: 3600` de `getHistory()`, así que incluso si
  el build agarra la base a medias se corrige sola en una hora, sin
  redeploy. Eso fue justo lo que pasó la primera vez: una migración cerró
  el torneo DESPUÉS de compilar y el banner salió vacío —**una migración
  SQL no dispara `updateTag`**, solo las server actions lo hacen.
- **`readableAccent()` solo resuelve la mitad del problema de contraste.**
  Aclara los colores apagados para que se vean sobre el negro, pero no hace
  nada con el caso contrario: el amarillo de Los Irreverentes (#f5ec00)
  sobre el hueso del tema claro es ilegible. Por eso el color del equipo se
  usa como texto solo bajo `dark:`; en claro manda el color de texto normal
  y la identidad la cargan el escudo, el borde y el degradado. Como fondo
  con alfa (`${acento}22`) sí sirve en los dos temas.
- **`PlayerPhoto` es la versión HTML de `drawCover()`.** Misma convención
  —zoom 1 = la foto justo cubre el marco, x/y de −1 a 1 sobre lo que
  sobra— para que una foto se vea igual en la web que en las piezas. No es
  un `object-position` y ya: ese reparte el sobrante SIN zoom, así que al
  acercar la foto el ancla se corre. Por eso van dos cajas, la interna de
  `zoom × marco` y desplazada `p · (1 − zoom)`.
- **`animate-reveal` se mueve con el scroll, no con un reloj**
  (`animation-timeline: view()`). En una página estática una animación de
  montaje ya terminó cuando el visitante baja hasta la sección. Va envuelta
  en `prefers-reduced-motion: no-preference` y en `@supports`: donde no
  exista, la sección sale quieta.
- **Nada del formato del torneo se escribe en el home.** El primer torneo
  fueron 4 equipos, 3 fechas de grupos, semifinales y final en la semana 5,
  y todo eso estaba horneado en la landing: las cinco semanas con los
  cruces "1 vs 2", "4 equipos" en los datos rápidos y hasta la descripción
  Open Graph del sitio. El segundo va para más de seis equipos y el
  formato se define cuando cierren las inscripciones, así que la landing
  cuenta el **proceso** (te inscribes → te toca equipo → a jugar), que no
  cambia, y manda el calendario a `/torneo`, que sale de la base. Si vuelve
  a aparecer un número de equipos o una fecha en el home, es un dato que va
  a envejecer.
- **El calendario no asume cuántos equipos hay.** `addWeek` programa una
  fecha de dos partidos (martes y jueves) y la única regla dura es que
  nadie juegue dos veces en esa fecha. Antes exigía los cuatro equipos en
  fase de grupos: con cuatro eso equivalía a "todos juegan una vez", pero
  con seis bloqueaba el calendario. Por lo mismo el aviso "no juegan X, Y"
  del panel solo sale cuando los partidos de la fecha dan justo para todos
  los equipos; si no, que alguno descanse es lo normal.
  `addWeek` recibe **una lista de partidos**, cada uno con su fase, su día
  y su hora, de 1 a 8. Antes recibía exactamente dos y le sumaba dos días
  al martes para sacar el jueves: con cuatro equipos eso era justo una
  vuelta, pero con seis son tres partidos y la forma del formulario se
  volvía el límite del torneo. Tampoco bloquea ya una semana que tenga
  partidos —hacía falta borrar la fecha entera para corregirla—, y el
  formulario avisa cuántos tiene antes de sumarle.
  Probado contra la base con seis equipos y una fecha de tres partidos
  repartidos en dos días: la tabla, el calendario público y la publicación
  por semana lo soportan sin cambios.
- **Un fallo de carga NUNCA se guarda en el caché.** `getHistory()` y
  `getActiveTournamentName()` lanzan si Supabase falla y el `try/catch` vive
  AFUERA de `unstable_cache`. Al revés —devolviendo `[]` o `null` adentro—
  el caché guarda el fallo como si fuera la respuesta buena y lo sirve una
  hora; y en el home, que es estático, queda horneado en el HTML hasta la
  siguiente revalidación. Ya pasó: el cartel del hero desapareció en
  producción porque el render del build no encontró el nombre del torneo,
  mientras `/torneo` —dinámica, mismo código— lo mostraba bien. Con el
  catch afuera, la sección no se dibuja en ESE render y el siguiente lo
  vuelve a intentar.
- **El admin va en barra lateral, no en el encabezado.** Son nueve
  secciones y en fila no caben: en pantallas medianas la última salía
  cortada y el scroll horizontal ni se notaba. La barra es fija desde `lg`;
  por debajo manda el menú de hamburguesa, que ya existía. Arriba de la
  barra va siempre qué torneo se está editando y en qué estado, porque el
  admin escribe sobre el que marque `NEXT_PUBLIC_TOURNAMENT_SLUG` y ese
  dato no se veía en ninguna pantalla.
- **El aviso de entorno (`EnvBadge`) mira `NODE_ENV`, no el slug.** Antes
  comparaba contra `"relampago-2026"` escrito a mano, y fallaba en los dos
  sentidos: al poner `NEXT_PUBLIC_TOURNAMENT_SLUG=fin-de-ano-2026` en
  Vercel el sitio público se rotuló solo como entorno de prueba —lo vieron
  los visitantes—, y correr en local contra el torneo REAL no mostraba
  nada, que es justo el caso peligroso, porque ahí el admin escribe en
  producción. Ahora en producción no sale nunca y fuera de ella sale
  siempre, en ámbar si apunta a `prueba-local` y en rojo ("Datos reales")
  si apunta a cualquier otro. Cambiar de torneo ya no obliga a tocarlo.
- **El nombre de la carta y el nombre completo son dos datos**
  (`players.jersey_name`, migración 00017). El completo identifica a la
  persona para la organización; en la camiseta va el apodo o el apellido,
  que es más corto y es como lo llaman en la cancha. `cardName()` en
  `types.ts` aplica la regla —camiseta si la eligió, completo si no— y vive
  ahí para que no se desincronice vista por vista: los 82 jugadores de antes
  de la migración tienen `jersey_name` nulo. `height_cm` entra como tercer
  dato de la carta; sin estatura la carta sigue con dos y no queda un hueco.
- **El calendario separa fase de grupos y playoff, y el playoff es una
  llave.** Una lista por fechas responde "cuándo se juega", que es lo que
  importa en grupos; en playoff lo que importa es de dónde sale cada
  finalista, y eso una lista no lo muestra. `PlayoffBracket` dibuja los
  conectores con `div` con fondo, no con un `<svg>`, para que sigan al
  layout cuando las tarjetas cambian de alto.
- **En la pestaña de estadísticas solo se corona al líder si el torneo
  TERMINÓ y va solo en la punta.** Con el torneo en curso el primero es "el
  que va ganando" y destacarlo miente; con empate, destacar al primero es
  inventar un ganador —en figuras del torneo 1 hay ocho jugadores con una
  sola y el orden entre ellos es alfabético—. Las figuras se cuentan de
  `matches.mvp_player_id`, sin vista SQL.
- **Las marcas de evento del calendario son formas planas, no iconos.** A
  14px un icono de línea detallado es una mancha y hay que distinguir un
  gol de una asistencia de reojo: disco lleno para el gol, aro para el
  autogol, "A" para la asistencia y rectángulos para las tarjetas. Los
  goleadores van en dos columnas, una por equipo, por la misma razón que en
  la pieza de resultado; el autogol en la columna del que se benefició.
- **Ojo con subir un límite en zod sin mirar el `check` de la base.** Pasó:
  el formulario de calendario pasó a aceptar la semana 20 y `matches.week`
  seguía con `check (week between 1 and 10)` de la 00001, así que zod dejaba
  pasar y Postgres rechazaba con un 23514 que la interfaz no traduce. Lo
  corrige la migración 00018.
- Privacidad: el email de los jugadores no se muestra en ninguna vista pública;
  solo en el panel admin.
