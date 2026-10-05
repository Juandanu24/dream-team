# LANDING.md — Encargo: el home tiene que contar el torneo 1

Para la sesión que lo implemente. **Leer antes `AGENTS.md`, `ORQUESTACION.md`
y `CONTENIDO.md`.**

---

## El problema

Está a punto de llegar gente nueva por el torneo de fin de año. Lo primero
que ven hoy es un home que **no cuenta que hubo un torneo antes**: ni campeón,
ni premios, ni que esto ya se jugó una vez y salió bien.

Se construyó `/historia` con el palmarés completo —campeón, podio y los tres
premios— pero quedó **suelta**:

- **No está en el navbar.** `src/components/site-header.tsx`, el arreglo
  `links` (hoy: Inicio, Torneo, Penales).
- **El home casi no la menciona.** Solo hay un `ChampionBanner`
  (`src/app/(public)/champion-banner.tsx`), una tarjeta discreta entre
  "Datos rápidos" y "Formato".

Lo que Juan pidió, en sus palabras: *"la idea es que la gente que llegue a
esa página vea eso de entrada, y luego vayan a inscribirse. Crea widgets,
cards, cosas dinámicas y cheveres."*

**El recorrido que hay que lograr:** llega un desconocido → ve que esto es
serio y que ya hubo un campeón → se quiere meter → se inscribe.

---

## Qué datos hay (verificado contra la base, 5 de octubre de 2026)

Todo del torneo 1 (`relampago-2026`, ya en `finished`):

| Dato | Cantidad |
|---|---|
| Equipos | 4 |
| Partidos jugados | 10 |
| Goles | **66** (solo 50 con autor cargado) |
| Jugadores con equipo | 53 |
| Inscritos aprobados | 54 |
| Premios en `tournament_awards` | 3 (MVP, goleador, valla) |
| Onces ideales | 3 |
| Alineaciones | 17 |
| Partidas de penales | 6 |

**El campeón fue Los Irreverentes F.C**, y su historia es buena: perdieron
0-7 el primer partido contra Teletubbies, pasaron terceros, y le ganaron la
final a ese mismo equipo por penales. Eso da para un widget.

Datos ya calculados y listos para usar:

- `getHistory()` en `src/lib/history.ts` — campeón, podio y premios de cada
  torneo terminado, ya cacheado.
- `getTournamentData(slug)` en `src/lib/data.ts` — todo lo demás de un
  torneo: tabla, partidos, goleadores, asistencias. Recibe el slug, así que
  sirve para leer el torneo 1 aunque el activo sea otro.

---

## Lo que hay que construir

1. **`/historia` en el navbar.** Es un enlace en `links`; el ícono puede ser
   `Trophy` o `Medal` de lucide.
2. **Reemplazar `ChampionBanner` por algo que valga la pena.** Una sección del
   home que cuente el torneo 1: el campeón grande, los tres premiados con su
   foto, y las cifras del torneo (10 partidos, 66 goles, 53 jugadores).
3. **Que lleve a inscribirse.** La sección tiene que terminar empujando al
   torneo nuevo, no quedarse en la nostalgia.

---

## Restricciones que no se pueden ignorar

- **El home es una página ESTÁTICA**, prerenderizada en el build
  (`x-nextjs-prerender: 1`). Ya mordió una vez: el `ChampionBanner` salió
  vacío en producción porque el build corrió antes de que la migración
  cerrara el torneo 1, y quedó horneado así. Si la sección nueva depende de
  la base, hay que decidir conscientemente entre:
  - dejar el home estático y aceptar que un cambio en la base tarda hasta
    una hora (o un redeploy) en verse, o
  - pasarlo a `force-dynamic` como `/torneo`, perdiendo los 3 ms que hoy
    tarda en responder.

  **El caché se invalida con `updateTag(TAG_TORNEO)` desde las server
  actions. Una migración SQL NO lo invalida** — por eso el banner no
  apareció solo.

- **"Dinámico y chévere" no puede costar rendimiento.** Se acaba de bajar
  `/torneo` de 2.7 s a 0.7 s; el home va en 3 ms. La animación va en CSS o en
  el cliente, no en más consultas.

- Hay dos acentos con roles fijos: `--volt` es ACCIÓN y presente,
  `--dt-blue` es INFORMACIÓN. El palmarés es información; el botón de
  inscripción es acción.

- Ya existen piezas reutilizables: `TeamCrest`, `InteractiveBall` (el balón
  que se puede patear, ya está en el hero), `Avatar`, `Card`.

---

## Cómo verificar

1. `pnpm lint` y `rm -rf .next && pnpm build`.
2. Levantar el build de producción y **medir**: el home no debe pasar de lo
   que tarda hoy.
   ```bash
   pnpm start --port 3022
   curl -s -o /dev/null -w '%{time_starttransfer}\n' http://localhost:3022/
   ```
3. **Mirarlo en el navegador**, en claro y en oscuro, y en ancho de celular.
4. Comprobar que la sección trae datos de verdad y no el estado vacío:
   ```bash
   curl -s http://localhost:3022/ | grep -c "IRREVERENTES"
   ```

---

## Lo que NO hay que hacer

- No tocar `/historia`: ya funciona y muestra campeón, podio y premios.
- No rehacer `getHistory()` ni `getTournamentData()`.
- No meter el torneo 1 en `/torneo`: ese es el torneo en curso. El viejo vive
  en `/torneos/relampago-2026`.
