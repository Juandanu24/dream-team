# TORNEO-2.md — Plan del segundo torneo

> **Estado: las cuatro entregas están implementadas.** Falta correr las
> migraciones 00015 y 00016 y hacer el cambio de torneo activo.

Cuatro entregas. Se pueden hacer en orden y cada una queda publicable por
su cuenta. **Juan pidió empezar por las inscripciones.**

Decisiones ya tomadas por él:

- `/torneo` muestra **el torneo en curso**; el torneo 1 queda archivado en
  su propia ruta.
- El **comprobante de pago es obligatorio** para poder inscribirse.
- El salón de la fama va en **página propia**, con una mención en el home.

---

## Lo que ya está resuelto y no hay que construir

Medido contra el código y la base, no supuesto:

- **`registrations` ya cuelga de `tournament_id`** y tiene
  `unique (player_id, tournament_id)`. Un torneo nuevo no toca nada del viejo.
- **La inscripción ya reconoce al que vuelve**: si el email existe, actualiza
  su perfil y le crea una inscripción nueva para el torneo activo
  (`inscripcion/actions.ts`). Que alguien esté en el torneo 1 y en el 2 ya
  funciona.
- `tournaments.status` ya distingue `registration` / `in_progress` /
  `finished`, y la inscripción **ya rechaza** si no está en `registration`.

Lo que falta es: el comprobante, las rutas, el caché y los premios.

---

## Estado medido (5 de octubre de 2026)

| | |
|---|---|
| `/torneo` | **1.1 s en caliente, 3.8 s en frío** |
| `/` e `/inscripcion` | ~0.4 s |
| Caché | **Ninguno**: todo sale con `no-store` |
| Consultas de `/torneo` | 9 en paralelo, en cada visita |
| Vercel | `iad1` (Washington) |
| Archivos que fijan el torneo activo | **15** |
| Buckets | `player-photos` y `team-crests`, los dos **públicos** |
| Torneos | `relampago-2026` sigue en `in_progress` |

---

## Entrega A — Inscripciones del torneo 2 · **empezar por acá**

### Datos

Migración `00015_inscripcion_con_pago.sql`:

```sql
alter table registrations
  -- La RUTA en el bucket, no una URL: el bucket es privado y la URL se
  -- firma en el momento de mirarla.
  add column payment_proof_path text,
  add column payment_verified_at timestamptz;

-- Bucket PRIVADO, a diferencia de player-photos y team-crests.
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false);
```

**Por qué privado.** Las fotos de jugador son públicas a propósito: salen en
las piezas y en la web. Un comprobante de pago es un dato financiero de una
persona — ahí va el banco, el monto y a veces el número de cuenta. En un
bucket público queda en una URL que cualquiera que la tenga puede abrir, para
siempre. El admin lo ve con una URL firmada que vence en un minuto, generada
en el servidor.

Además, fuera de la migración: crear la fila del torneo 2 en `tournaments`
con `status = 'registration'`, y pasar `relampago-2026` a `finished`.
**Falta que Juan defina el slug y el nombre.**

### Código

| Archivo | Qué |
|---|---|
| `(public)/inscripcion/registration-form.tsx` | Campo nuevo de comprobante, obligatorio. Reutilizar la compresión que ya existe para la foto |
| `(public)/inscripcion/actions.ts` | Validar y subir al bucket privado; guardar `payment_proof_path`. Si falla la subida del comprobante, **no** crear la inscripción |
| `admin/(panel)/inscripciones/` | Ver el comprobante y marcar el pago como verificado |
| `admin/(panel)/inscripciones/actions.ts` | `getPaymentProofUrl(registrationId)` → URL firmada de 60 s, solo para admin |

### Riesgos

- **Una inscripción a medias**: foto subida, comprobante no. El orden debe ser
  subir las dos cosas y después insertar la fila; si algo falla, borrar lo
  subido.
- El que ya se inscribió en el torneo 1 y vuelve: el flujo lo cubre, pero hay
  que probarlo de verdad con un email existente.

### Cómo verificar

Contra la base real y limpiando lo creado: una inscripción nueva con
comprobante; una sin comprobante que el formulario rechace; una de alguien
que ya existe en `players` (debe actualizar el perfil y crear inscripción
nueva sin tocar la del torneo 1); y que el bucket **no** sirva el archivo sin
firma.

---

## Entrega B — Rendimiento

El problema no es la consulta, es que no hay caché. `/torneo` hace 9
consultas desde Washington en **cada visita**, y los resultados cambian una o
dos veces por semana.

- Quitar `force-dynamic` de las 4 páginas públicas y pasarlas a datos
  cacheados con etiqueta por torneo.
- Las acciones del admin ya llaman `revalidatePath`; agregarles la
  invalidación por etiqueta para que **al guardar un resultado se vea de
  inmediato**, sin esperar a que venza el caché.
- El panel admin se queda dinámico: es privado y de poco tráfico.

**Ojo con la versión de Next.** Es Next 16 y las APIs de caché cambiaron.
Leer `node_modules/next/dist/docs/` antes de escribir, como manda `AGENTS.md`.

**Verificar midiendo**, antes y después, con el mismo comando:

```bash
curl -s -o /dev/null -w '%{time_starttransfer}\n' https://dreamteamcolombia.vercel.app/torneo
```

Objetivo: `/torneo` por debajo de 200 ms en caliente, y que un resultado
cargado en el admin salga en la web sin esperar.

---

## Entrega C — Salón de la fama (`/historia`) y mención en el home

### El problema de datos que hay que resolver primero

**Los premios del torneo 1 no existen en la base.** El campeón y el podio se
derivan de los partidos, y el goleador y la valla se calculan — pero el
**MVP del torneo lo escogió Juan a dedo** para la pieza, y eso no quedó
guardado en ningún lado.

Hace falta una tabla:

```sql
create table tournament_awards (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  kind text not null check (kind in ('mvp', 'goleador', 'valla', 'fair_play')),
  player_id uuid not null references players (id) on delete cascade,
  -- "6 goles en 4 partidos": la cifra tal como se publicó, congelada. Si
  -- mañana se corrigen los eventos, el premio no cambia solo.
  detail text,
  unique (tournament_id, kind)
);
```

Y una pantalla mínima en el admin para elegirlos — o cargarlos a mano esta
primera vez, que son tres filas.

### El otro problema: faltan 16 goles

Del 10-6 por el tercer puesto **no se cargaron los goleadores**. El torneo
tuvo 66 goles y el sistema conoce el autor de 50. Eso significa que
**"goleador del torneo 1" puede no ser Andres Baloco**: Colombia metió 10 esa
noche y Juan Rodriguez va con 5.

Antes de publicar el salón de la fama hay que decidir:

1. Cargar esos 16 goles (lo correcto, si alguien se acuerda).
2. Congelar el premio en `tournament_awards` con la cifra de hoy, sabiendo
   que sale de 50 de 66 goles.

### Qué se construye

- `/historia` — campeón, podio, los premios individuales, el once ideal y
  enlace al archivo del torneo.
- Una sección corta en el home que lleve allá.
- Pensarla desde ya para **varios torneos**: lista de torneos terminados, cada
  uno con lo suyo. Cuando acabe el torneo 2 no hay que tocar nada.

---

## Entrega D — Archivo del torneo 1 (`/torneos/[slug]`)

La más mecánica y la más regada: **15 archivos** leen
`ACTIVE_TOURNAMENT_SLUG` directo.

- Los loaders de `src/lib/` pasan a recibir el slug (o el id) por parámetro,
  con el activo como valor por defecto para no romper lo que ya llama.
- `/torneo` usa el torneo en curso. `/torneos/[slug]` usa el de la URL.
- El admin se queda apuntando al activo: **no** es un panel multi-torneo, y
  convertirlo en uno es un trabajo aparte que nadie pidió.

**Riesgo real:** tocar los 15 archivos mientras el torneo 2 está vivo. Hacerlo
entre fechas, no en semana de partido.

---

## Orden sugerido

1. **A — Inscripciones.** Es lo que bloquea a la gente, y los visitantes están
   llegando ahora.
2. **B — Rendimiento.** Chica y de mucho efecto en la primera impresión.
3. **C — Salón de la fama.** Necesita decidir antes lo de los 16 goles.
4. **D — Archivo.** La más invasiva; mejor con el torneo 2 ya rodando y entre
   fechas.

C y D se tocan: el salón enlaza al archivo. Si D se retrasa, C sale igual y el
enlace se agrega después.

---

## Lo que falta que Juan decida

- **Slug y nombre del torneo 2** (`relampago-2027`? "2º Torneo Dream Team"?).
- **Valor de la inscripción**, si va a mostrarse en el formulario.
- **Los 16 goles del 10-6**: cargarlos o congelar el premio como está.
