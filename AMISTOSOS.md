# Encargo — Alineaciones de partidos amistosos

Para una sesión que implemente. **Leer antes `AGENTS.md` y `ORQUESTACION.md`.**

---

## Qué pide Juan

Poder armar alineaciones de **partidos amistosos**, los que juega la gente del
Dream Team por fuera del torneo. De cada lado quiere la misma imagen de cancha
que ya existe, el botón de WhatsApp para mandarla al grupo, y poder descargar
la imagen.

En estos partidos **puede jugar gente que no está inscrita al torneo**, y hay
que poder ponerla igual.

Es una herramienta de admin, no una sección pública.

---

## Lo que ya existe y hay que reutilizar tal cual

Nada de esto se reescribe:

| Qué | Dónde |
|---|---|
| Dibujo de la cancha | `drawLineupBody` en `src/lib/post-image.ts`, pieza `kind: "alineacion"` |
| Botón que genera, comparte y descarga la imagen | `src/components/lineup-piece-button.tsx` |
| Botón de WhatsApp | `src/components/share-text-button.tsx` |
| Texto de la alineación para el grupo | `buildLineupMessage` en `src/lib/match-summary.ts` |
| Formaciones y sus líneas | `FORMATIONS` y `formationLines` en `src/lib/types.ts` |
| Enum de líneas | `lineup_line` (`gk`/`def`/`mid`/`fwd`), ya en la base |

`LineupPieceButton` recibe `{ eyebrow, team: TeamSide, formation, rows, bench }`
y `TeamSide` es `{ name, color, crestUrl }`. Nada de eso obliga a que exista un
equipo del torneo: se le puede pasar un lado inventado. Ese es el punto de
apoyo de todo este encargo.

La cancha ya cae a las iniciales cuando un jugador no tiene foto (`drawAvatar`),
así que un invitado sin foto no rompe nada.

---

## Por qué no se puede colgar del modelo del torneo

Se verificó contra el esquema real. Todo lo del torneo está amarrado:

- `lineups.tournament_id` y `lineups.match_id` son **not null**.
- `matches.tournament_id` y `teams.tournament_id` son **not null**.
- `team_players` tiene `unique (tournament_id, player_id)`: **un jugador solo
  puede estar en un equipo por torneo**. Con lados que rotan cada semana, eso
  se rompe al segundo amistoso.
- `players` exige `email` único, `age`, `dominant_foot`, `position` y
  `member_since`, todos not null. Meter ahí a un invitado obliga a inventarle
  un correo.

Por eso van tablas nuevas. **No aflojar las restricciones de las tablas del
torneo**: están en producción y el torneo está a mitad de camino.

---

## Un dato que cambia el énfasis

`players` tiene **80 filas y las 80 con foto**. El torneo aprobó 52 y 51 tienen
equipo. O sea que la mayoría de "los que no están en el torneo" **ya existen en
`players` con su foto**, porque se inscribieron alguna vez.

El selector de jugadores debe listar **las 80 de `players`**, no el plantel del
torneo. El invitado de cero es el caso raro, no el común — pero tiene que
existir.

---

## Modelo de datos propuesto

`supabase/migrations/00013_amistosos.sql`. Identificadores en inglés, como
manda `AGENTS.md`.

```sql
create table friendlies (
  id uuid primary key default gen_random_uuid(),
  title text,                      -- "Amistoso del martes"
  kickoff_at timestamptz,
  venue text,
  created_at timestamptz not null default now()
);

create table friendly_sides (
  id uuid primary key default gen_random_uuid(),
  friendly_id uuid not null references friendlies (id) on delete cascade,
  name text not null,              -- "Claros"
  color text,                      -- para teñir la pieza
  crest_url text,                  -- opcional
  formation text not null default '3-3-2',
  notes text,
  slot smallint not null check (slot in (0, 1)),   -- 0 local, 1 visitante
  unique (friendly_id, slot),
  -- Clave compuesta para que friendly_players pueda garantizar
  -- "un jugador no está en los dos lados del mismo amistoso".
  unique (id, friendly_id)
);

create table friendly_players (
  id uuid primary key default gen_random_uuid(),
  side_id uuid not null,
  friendly_id uuid not null,
  -- Si es del Dream Team apunta a players, y de ahí sale la foto.
  player_id uuid references players (id) on delete set null,
  -- Si es un invitado que no está inscrito, solo el nombre.
  guest_name text,
  line lineup_line not null,
  slot int not null default 0 check (slot between 0 and 7),
  is_starter boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (side_id, friendly_id)
    references friendly_sides (id, friendly_id) on delete cascade,
  -- O es alguien de la base, o es un invitado con nombre. Nunca ninguno.
  constraint friendly_players_identidad
    check (player_id is not null or nullif(btrim(guest_name), '') is not null)
);

-- Dos titulares no pueden ocupar la misma casilla. Parcial, porque los
-- suplentes comparten slot 0 a propósito (igual que en lineup_players).
create unique index idx_friendly_casilla_unica
  on friendly_players (side_id, line, slot)
  where is_starter;

-- Un jugador de la base no puede estar dos veces en el mismo amistoso,
-- ni repetido en un lado ni en los dos a la vez.
create unique index idx_friendly_jugador_unico
  on friendly_players (friendly_id, player_id)
  where player_id is not null;

create index idx_friendly_sides_friendly on friendly_sides (friendly_id);
create index idx_friendly_players_side on friendly_players (side_id);

alter table friendlies enable row level security;
alter table friendly_sides enable row level security;
alter table friendly_players enable row level security;
```

**Las tres decisiones que importan y por qué:**

1. **`player_id` nulable + `guest_name`.** Es lo que deja entrar a alguien de
   afuera sin inventarle un correo en `players`. El `check` impide que quede
   una fila sin identidad de ningún tipo.
2. **`friendly_id` repetido en `friendly_players` con clave foránea
   compuesta.** Es el mismo truco que ya usa `team_players` con
   `(team_id, tournament_id)`: permite el índice único que impide que alguien
   juegue para los dos lados. Sin eso habría que resolverlo con un trigger o,
   peor, confiando en el código.
3. **No hay `published_at` ni push.** Estos partidos no salen en la web ni le
   suenan el teléfono a nadie: el admin arma, comparte al grupo y ya. Meter
   push aquí le llegaría a los 8 suscritos del torneo como ruido.

---

## Qué construir

- **Migración** `00013_amistosos.sql`.
- **Tipos** en `src/lib/types.ts` (espejo del esquema).
- **Loader** `src/lib/friendlies.ts`, `server-only`, con el mismo patrón de
  `src/lib/lineups.ts`: un solo viaje, y devolver `null` si Supabase no
  responde en vez de reventar.
- **Ruta** `/admin/amistosos` (`page.tsx` + `actions.ts` + editor cliente).
  Toda server action del admin verifica `getAdminUser()` antes de mutar.
- **Entrada en la navegación**: `src/app/admin/(panel)/admin-nav.tsx`, después
  de "Alineaciones".
- En el editor: crear amistoso (fecha, lugar, nombre de cada lado), escoger
  formación, asignar a las casillas, banca, y **"Agregar invitado"** que solo
  pide el nombre.

**El que ya está puesto en una casilla no aparece en las otras listas.** Es
convención del proyecto (`AGENTS.md`) y aquí aplica igual, pero contando los
dos lados: si alguien ya está en Claros, no debe poder ponerse en Oscuros.

---

## Sobre reutilizar el editor del torneo

`alineaciones/lineup-editor.tsx` son 476 líneas y está pegado a la forma
"equipo del torneo + partido del torneo".

**Recomendación: no refactorizarlo ahora.** Compartir solo las hojas —
`LineupPieceButton`, `ShareTextButton`, `buildLineupMessage`, `formationLines`—
y que el editor de amistosos sea suyo. Se duplica la grilla de asignación
(~150 líneas), y a cambio no se toca código en producción a mitad de torneo.
Cuando el torneo termine se unifican con calma.

Si al implementarlo se ve que la grilla sale idéntica, extraerla es válido —
pero entonces hay que volver a verificar el editor del torneo, no solo el
nuevo.

---

## Detalles que ya costaron tiempo antes

- **Las casillas vacías van como `null` en `LineupRow.players`, y `width` dice
  cuántas son.** Si se filtran los `null`, la formación se dibuja mal: tres
  defensas con uno sin asignar se dibujaban como si fueran dos. Ya pasó.
- **Fechas en `America/Bogota`.** Ya hay seis copias de ese formateo regadas
  (`match-summary.ts`, `data.ts`, `admin-matches.ts`, `piezas/page.tsx`…).
  Reutilizar la de `match-summary.ts`, no agregar la séptima.
- **La pieza se dibuja en el navegador**, no en el servidor: ahí están las
  fuentes reales de `next/font`.

---

## Cómo verificar antes de entregar

1. `pnpm lint` y `rm -rf .next && pnpm build`.
2. **Contra la base real**, por REST y limpiando lo creado: que se pueda crear
   un amistoso con dos lados; que un invitado sin `player_id` entre; que una
   fila sin `player_id` **y** sin `guest_name` sea rechazada; que dos titulares
   en la misma casilla den 23505; y que el mismo `player_id` en los dos lados
   del mismo amistoso también dé 23505.
3. **Mirar la imagen**, no suponerla: renderizar la cancha fuera del navegador
   con un lado que mezcle gente con foto e invitados sin foto. El harness y las
   fuentes están explicados en `ORQUESTACION.md` — **registrar las fuentes
   reales**, sin ellas el harness miente en todo lo que dependa de medir texto.
4. Commit en español explicando la decisión. **Preguntar antes de hacer push.**
