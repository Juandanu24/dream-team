# CONTENIDO.md — Qué es cada pieza y cuándo se usa

`AGENTS.md` dice *cómo está hecho*. `ORQUESTACION.md`, *cómo se trabaja*.
Este dice **para qué existe cada cosa** — el criterio editorial detrás del
generador, que no se deduce leyendo el código.

Si vas a tocar `src/lib/post-image.ts`, `/admin/piezas` o a escribir un copy,
lee esto primero.

---

## El canal

Instagram **@dreamteam_colombia**, más el grupo de WhatsApp. La web
(`dreamteamcolombia.vercel.app`) es el destino al que apuntan los dos: ahí
están la tabla en vivo, las cartas y los perfiles.

Nada se publica automáticamente. El admin genera la pieza en `/admin/piezas`,
la comparte con `navigator.share` (en el celular abre el selector nativo con
Instagram y WhatsApp adentro) o la descarga, y la sube a mano. Publicar
directo por la API de Meta **se evaluó y se descartó**: exige App Review y
verificación de negocio, semanas de trámite, para ahorrar dos toques.

---

## Catálogo de piezas

Los diez tipos de `PieceKind`, más `figura` que el estudio compone en dos
pasos. Todas salen en **feed 1080×1350** y **story 1080×1920**, menos el
duelo.

| Pieza | Para qué momento | De dónde saca los datos |
|---|---|---|
| `anuncio` | **Antes** del partido: hoy jugamos | Partido del calendario |
| `duelo` | **Portada** del carrusel de "así se vivió". Va SIN marcador | Fotos que sube el admin |
| `resultado` | **Después**: marcador y goleadores en dos columnas | Partido + eventos |
| `figura` | El mejor del partido, sobre su carta FIFA | `matches.mvp_player_id` |
| `alineacion` | La titular en la cancha, con las fotos | `/admin/alineaciones` |
| `posiciones` | La tabla al día | Vista `group_standings` |
| `goleadores` | Ranking de goles | Vista `top_scorers` |
| `asistencias` | Ranking de asistencias | Vista `top_assists` |
| `equipo` | Escudo y nómina. Portada del multipost | Equipo + su plantel |
| `perfil` | Un jugador con su foto y sus números | Plantel + vistas |
| `penales` | Ranking del reto arcade de `/penales` | `penalty_leaderboard` |

**El paquete de la fecha** (`week-pack.tsx`) arma de un golpe las cuatro que
se repiten cada semana: resultado, anuncio, posiciones y goleadores.

---

## Cómo se encadenan en una fecha

El orden importa: cada pieza revela una cosa y no pisa a la siguiente.

1. **`anuncio`** el día del partido. Quién juega, cuándo, dónde.
2. **`alineacion`** cuando el admin la publica — esa sí dispara push y se ve
   en la web.
3. Se juega.
4. **Carrusel "así se vivió"**: el `duelo` de portada y detrás las fotos y
   videos de la noche. **Sin marcador**, porque el resultado va aparte.
5. **`resultado`** con el marcador y los goleadores.
6. **`figura`** del partido. Es **por partido, no por semana**: en una semana
   hay dos partidos y por tanto dos figuras.
7. **`posiciones`** y **`goleadores`** al cerrar la fecha.
8. **Once ideal** de la fecha, cuando se arma en `/admin/once-ideal`.

El **multipost "conoce al equipo"** (`equipo` + un `perfil` por jugador) no va
atado a una fecha: se publica cuando conviene llenar la parrilla.
Ojo: **Instagram admite 10 por carrusel** y un equipo de 13 da 14 piezas, así
que toca partirlo en dos publicaciones. El botón lo avisa.

---

## Cómo escribe Juan los copys

Reglas sacadas de correcciones suyas, no inventadas:

- **Corto.** Su palabra: *"mucha IA y la gente no lo querrá leer, hagámoslos
  igual de bien pero más corto"*. Si una frase no aporta un dato o una gracia,
  sobra.
- **Nada de relleno épico.** "Van a dejar el alma en la cancha" es exactamente
  lo que pidió sacar.
- **No presentar como nuevo lo que ya se conoce.** A media fase de grupos, un
  "CONOCE A COLOMBIA" envejece mal: la gente ya los conoce. Por eso el
  multipost pasó a "COLOMBIA, UNO POR UNO".
- **No mencionar la maquinaria.** Hablar de "las cartas tipo FIFA" suena raro
  en un post; el producto se muestra, no se explica.
- **Cerrar con una pregunta que se pueda responder.** "¿Quién va a ser la
  figura de este equipo?" funciona; "¿le tienes fe a este combo?" es tibio.
- **Español colombiano, tuteo.** Nunca voseo.
- El pie es siempre el mismo: enlace a la web con "(Link en la bio)" y los
  hashtags `#DreamTeamColombia #FutbolAmateur #Montería #LaF8 #CanchaF8`.

Los textos sugeridos viven en el `caption` de `pieces-studio.tsx` y son
**editables antes de copiar**: el generador propone, no impone.

**Cuidado con los datos en los copys.** Ya se publicó un cruce con los equipos
cambiados ("Teletubbies vs Máquina" cuando era Irreverentes vs Teletubbies).
Si el copy nombra equipos, jugadores o marcadores, comprobarlos contra la base.

---

## Los assets de marca y de dónde salen

Todo vive en `public/`.

| Archivo | Qué es | Cómo se hace otro |
|---|---|---|
| `logo-dt.webp` | Monograma DT, a color | — |
| `marco-duelo.webp` | Marco cinematográfico del duelo | Generado con IA, **en blanco y negro** |
| `nombre-<slug>.webp` | Nombre del equipo en letra de brocha | **Blanco sobre transparente**, recortado, `-resize x260` |

**Los dos últimos son en blanco y negro a propósito y se tiñen por código.**
El marco se multiplica por el color de cada equipo y se dibuja en modo
`screen`, que vuelve invisible su negro — por eso no hay que recortar los
huecos a mano ni acertar los píxeles. Un solo archivo sirve para los seis
cruces; uno con color se casaría con un equipo.

El slug del nombre sale del nombre del equipo, así que **agregar un equipo es
dejar caer el archivo**. Si no existe, `loadImage` falla en silencio y cae al
texto en Bebas inclinada: nadie se rompe por no tener el suyo.

Los cuatro nombres actuales los generó ChatGPT con un prompt de letra de
brocha. El de Colombia dice "COLOMBIA DT" y es de **una sola línea**, mucho
más ancho que los otros tres (razón 3.1 contra ~1.8): por eso el ajuste del
bloque escudo+nombre mide la imagen y no el texto.

---

## Las fotos de los jugadores

Las manda cada quien desde su celular: unas de cuerpo entero, otras primer
plano, otras horizontales. Un recorte fijo que le sirve a una le corta la
cabeza a la siguiente.

Por eso el **encuadre es del jugador, no de la pieza**: se ajusta una vez en
`/admin/piezas` (escoger equipo, escoger jugador, mover los deslizadores
contra su vista previa real) y queda guardado en `players`. Hoy lo usa la
pieza de perfil; llevarlo a la carta FIFA y a la cancha está en el backlog.

---

## Lo que NO se publica

- **La pieza de duelo nunca lleva marcador.** Es la portada de "así se vivió",
  no el resumen.
- **Los números en cero no salen.** Un "0 goles · 0 asistencias" no informa y
  deja al jugador como si no hubiera ido; hoy son 26 de 53. Sin números, la
  pieza le da ese espacio a la foto.
- **El reto de penales no es una estadística del torneo.** Tiene su propio
  ranking, pero no va al lado de los goles en el perfil de un jugador: es un
  juego de la web, no algo que pasó en la cancha.
- **El email de los jugadores no aparece en ninguna vista pública.**
