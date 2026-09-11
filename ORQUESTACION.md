# ORQUESTACION.md — Cómo se trabaja este proyecto entre varias sesiones

Este archivo es para **sesiones que implementan**. Lo mantiene la sesión que
orquesta.

Son tres documentos y cada uno responde una pregunta distinta:

| Documento | Responde |
|---|---|
| `AGENTS.md` | **Cómo está hecho**: arquitectura, convenciones, gotchas |
| `ORQUESTACION.md` (este) | **Cómo se trabaja y qué falta**: disciplina, estado, backlog |
| `CONTENIDO.md` | **Para qué existe cada pieza**: criterio editorial, copys, assets |

**Leer los tres antes de tocar código.** El tercero importa aunque el cambio
parezca solo técnico: casi todo lo de este proyecto termina siendo una imagen
que se publica.

---

## Lo primero: la disciplina que hace que esto funcione

Este proyecto está en producción y lo usa gente real todas las semanas. Casi
todos los errores que costaron tiempo salieron de dar por bueno algo sin
verificarlo. Estas cinco reglas son la respuesta a errores que YA ocurrieron:

1. **Verificar contra la base real, no contra el tipo.** Antes de dar por buena
   una feature con datos, consultar Supabase por REST y comprobar el camino
   completo: insertar, leer, que los constraints rechacen lo que deben, y
   **limpiar lo que se creó**. Así se detectaron los 409 de casillas duplicadas
   y el `on conflict` de las alineaciones.

2. **`pnpm build` local pasa con caché; Vercel compila desde cero.** Un deploy
   ya se cayó porque unos archivos de prueba quedaron dentro del repo y el
   type check de CI los vio. Si el deploy importa, `rm -rf .next && pnpm build`.

3. **Las piezas de imagen se miran, no se suponen.** Hay un render fuera del
   navegador (ver más abajo). Varias veces el código compilaba y la pieza
   salía mal: el VS partido a la mitad, la etiqueta del arquero fuera de la
   cancha, el panel de goleadores montado sobre el pie.

4. **Medir antes de ajustar.** Cuando algo "se ve corrido", medir la tinta del
   PNG por columnas en vez de mover números a ojo. Así se descubrió que la
   pieza estaba centrada y el problema era otro: el desbalance de masa visual.

5. **Nada de push sin confirmación explícita** (convención del repo). Y nunca
   disparar push notifications de prueba: hay 8 personas suscritas y les suena
   el teléfono. Ya pasó una vez.

---

## Estado del torneo (al 11 de septiembre de 2026)

- **4 equipos**, 82 personas en `players`, 54 inscritos aprobados, 53 con
  equipo.
- **Fase de grupos CERRADA**: las 3 semanas jugadas, 6 partidos. Quedan
  semifinales (S4) y tercer puesto + final (S5), los 4 partidos ya creados.
- **Tabla final de grupos**: Teletubbies 6 pts (+7) · Colombia 6 (+5) ·
  Irreverentes 3 (−3) · Máquina 3 (−9).
- Las 6 figuras de partido elegidas; 11 alineaciones y 2 onces ideales.
- 26 jugadores con encuadre de foto guardado.
- 1 amistoso creado ("Champions league Martes").
- **Siguen 8 suscritos a push de 54.** Es el canal directo y está al 15%.

Migraciones aplicadas hasta **`00013_amistosos.sql`**, todas corridas.


---

## Puertos

Bloque **3020+** (los otros contextos de Juan usan 3000/4000/5173 y 3010-3012).

```bash
pnpm dev --port 3020                                        # torneo de prueba
NEXT_PUBLIC_TOURNAMENT_SLUG=relampago-2026 pnpm dev --port 3020   # datos reales
```

Con el slug real, **el admin toca producción**. Avisarlo siempre.

---

## Render de piezas fuera del navegador

`src/lib/post-image.ts` dibuja en canvas del navegador, así que no se puede
ver desde Node sin ayuda. El harness vive en el **scratchpad**, nunca en el
repo (ya se coló una vez y tumbó el deploy; `.gitignore` ahora lo bloquea).

Montarlo:

```bash
mkdir -p "$SCRATCHPAD/render" && cd "$SCRATCHPAD/render"
npm init -y && npm i @napi-rs/canvas
# copiar post-image.ts y team-color.ts como .mts, quitarles "use client"
# y apuntar el import a ./tc.mts
```

Necesita stubs de `document`, `getComputedStyle`, `Image`, `URL.createObjectURL`
y `canvas.toBlob`, más un parche de `drawImage` que desenvuelva el FakeImage.

**Registrar las fuentes reales no es opcional.** Sin ellas sale una serif, y
donde el tamaño de un bloque se deriva de `measureText` el harness miente
justo en lo que se está verificando: Bebas es mucho más angosta, así que los
tamaños salen distintos. Ya pasó con el nombre de brocha del duelo.

```bash
# El endpoint css (v1) con un UA viejo sirve TTF; css2 sirve woff2.
curl -s -A "Mozilla/5.0" "https://fonts.googleapis.com/css?family=Bebas+Neue"
curl -s -A "Mozilla/5.0" "https://fonts.googleapis.com/css?family=Archivo:400,600,700"
```

Después, en el harness:

```js
GlobalFonts.registerFromPath("./BebasNeue.ttf", "Bebas Neue");
globalThis.getComputedStyle = () => ({ getPropertyValue: (v) =>
  v === "--font-bebas" ? "'Bebas Neue'" : v === "--font-archivo" ? "Archivo" : "" });
```

**Ojo con la precedencia de `&&`/`||` al montarlo.** Un `mkdir -p X && cd X &&
[ -d node_modules ] || (npm init -y)` corre el `npm init` en el directorio
actual cuando el `mkdir` falla — o sea, dentro del repo. Ya pasó: le metió
`"type": "commonjs"` a `package.json` y tumbó el build con 159 errores.

---

## Cómo entregar trabajo

1. Leer `AGENTS.md`, `CONTENIDO.md` y este archivo.
2. Implementar, con comentarios que expliquen **por qué**, no qué.
3. `pnpm lint && pnpm build`.
4. Verificar contra datos reales lo que aplique.
5. Commit en español, mensaje que explique la decisión y el problema que
   resuelve. Terminar con `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
6. **Preguntar antes de hacer push.**
7. Si se agrega una convención nueva o un gotcha, escribirlo en `AGENTS.md`.
   Si cambia el estado o el backlog, acá. Si cambia el criterio de una pieza o
   un copy, en `CONTENIDO.md`. **Un documento desactualizado hace más daño que
   no tenerlo**: la otra sesión le cree.

---

## Backlog

### Listo para implementar

- **Llevar el encuadre guardado a las demás piezas.** Ya está en
  `players` y `drawCover()` lo aplica; hoy solo lo usa la pieza de
  perfil. La carta FIFA (`card-image.ts`, recorte circular centrado) y
  los círculos de la cancha de alineaciones (`drawAvatar`) tienen el
  mismo problema y resolverlo es pasarles el `Encuadre` del jugador. El
  trabajo real es enhebrarlo por `CardImageData`, que se arma en varios
  sitios (inscripción, /torneo, figura).

- **Valla menos vencida.** Se destrabó al construir alineaciones: ahora se sabe
  quién atajó cada partido (`lineup_players` con `line = 'gk'` e `is_starter`),
  y se puede cruzar con los goles recibidos del partido. Es una vista SQL nueva
  más una pieza de ranking (el motor `drawRankBody` ya existe).

- **Push automático el día del partido.** Hoy el aviso solo sale cuando el admin
  publica. Un cron diario que revise si hay partido hoy y mande recordatorio
  subiría la asistencia. Vercel permite un cron diario en el plan gratis.

- **Campaña para subir suscriptores a push.** 8 de 54. Vale más que cualquier
  pieza nueva: Instagram muestra a quien quiere, el push llega a todos. Una
  pieza/historia con instrucciones de instalar la PWA y activar avisos.

### Ideas no comprometidas

- Confirmación de asistencia por partido (los jugadores no tienen login: habría
  que resolverlo con un enlace público y selección de nombre).
- Récords automáticos al cierre del torneo (goleador, asistidor, fair play).
- Publicación directa a Instagram por la API de Meta — **evaluado y descartado
  por ahora**: exige App Review y verificación de negocio, semanas de trámite,
  para ahorrar dos toques. El camino actual (generar y compartir con
  `navigator.share`) cubre el 95%.

---

## Lo que NO hay que rehacer

Decisiones ya tomadas con razón. Cambiarlas necesita un motivo nuevo:

- **Las piezas se dibujan en canvas del navegador**, no en el servidor, porque
  ahí están las fuentes reales de `next/font`.
- **El marco del duelo es blanco y negro y se tiñe por código.** Un solo archivo
  sirve para los seis cruces. Si se pide uno con color, se casa con un equipo.
- **La figura del partido es a dedo, no calculada.** El que más corrió no sale
  en ninguna estadística.
- **El duelo no lleva marcador**: es la portada del carrusel de "así se vivió".
  El marcador va en la pieza de resultado.
- **Los jugadores no tienen login.** El filtro contra colados es la aprobación
  del admin.
- **Los amistosos no cuelgan del torneo** y tienen tablas propias. El porqué
  está en `AGENTS.md`; el resumen es que `team_players` solo admite un equipo
  por jugador y por torneo, y `players` exige correo único.
- **Los números en cero no salen en la pieza de perfil**, y el reto de penales
  no cuenta como estadística del torneo. El criterio está en `CONTENIDO.md`.
