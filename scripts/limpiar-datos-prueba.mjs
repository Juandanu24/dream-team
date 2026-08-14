// Limpieza de datos del torneo activo.
//
//   node --env-file=.env.local scripts/limpiar-datos-prueba.mjs
//     Solo los jugadores de prueba (emails @dreamteam.test) y, en cascada,
//     sus inscripciones, equipos, goles y penales.
//
//   ... --reset
//     Además deja el torneo en blanco: partidos (con sus eventos), equipos
//     y puntajes de penales. Los jugadores reales se conservan.
//
//   ... --reset --todo
//     Borrón y cuenta nueva: TAMBIÉN borra los jugadores reales y las fotos
//     subidas. Queda el torneo vacío, listo para inscripciones de verdad.
//
// El torneo y los usuarios admin de Supabase Auth nunca se tocan.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const reset = process.argv.includes("--reset");
const todo = process.argv.includes("--todo");

if (!url || !key) {
  console.error("Faltan las variables de Supabase (corre con --env-file=.env.local)");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function api(method, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { method, headers });
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function emptyBucket(bucket) {
  const listRes = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prefix: "", limit: 1000 }),
  });
  const files = await listRes.json();
  // Las fotos de escudos viven en subcarpetas (un folder por equipo).
  const names = [];
  for (const file of files) {
    if (file.id === null) {
      const subRes = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prefix: file.name, limit: 1000 }),
      });
      const subFiles = await subRes.json();
      names.push(...subFiles.map((f) => `${file.name}/${f.name}`));
    } else {
      names.push(file.name);
    }
  }
  if (names.length === 0) return 0;

  const res = await fetch(`${url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ prefixes: names }),
  });
  if (!res.ok) throw new Error(`Borrando ${bucket}: ${await res.text()}`);
  return names.length;
}

const [tournament] = await api("GET", "tournaments?select=id&slug=eq.relampago-2026");
if (!tournament) {
  console.error("No se encontró el torneo activo");
  process.exit(1);
}

if (reset) {
  // match_events y team_players caen en cascada con partidos y equipos.
  const matches = await api("DELETE", `matches?tournament_id=eq.${tournament.id}`);
  const penalties = await api("DELETE", `penalty_scores?tournament_id=eq.${tournament.id}`);
  const teams = await api("DELETE", `teams?tournament_id=eq.${tournament.id}`);
  console.log(`✓ ${matches.length} partidos borrados (con sus goles y tarjetas)`);
  console.log(`✓ ${penalties.length} puntajes de penales borrados`);
  console.log(`✓ ${teams.length} equipos borrados`);
}

const filter = todo ? "id=not.is.null" : "email=like.*%40dreamteam.test";
const players = await api("DELETE", `players?${filter}`);
console.log(
  `✓ ${players.length} jugadores borrados${todo ? " (todos, incluidos los reales)" : " de prueba"}`,
);

if (todo) {
  for (const bucket of ["player-photos", "team-crests"]) {
    const removed = await emptyBucket(bucket);
    console.log(`✓ ${removed} archivos borrados de ${bucket}`);
  }
}

const [left] = await api(
  "GET",
  `registrations?select=count&tournament_id=eq.${tournament.id}`,
);
console.log(`→ quedan ${left?.count ?? 0} inscripciones en el torneo`);
