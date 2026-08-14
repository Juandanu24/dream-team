// Limpieza de datos de prueba.
//
//   node --env-file=.env.local scripts/limpiar-datos-prueba.mjs
//     Borra solo los jugadores de prueba (emails @dreamteam.test) y, en
//     cascada, sus inscripciones, asignaciones a equipos, goles y penales.
//
//   node --env-file=.env.local scripts/limpiar-datos-prueba.mjs --reset
//     Además deja el torneo en blanco: borra partidos (con sus eventos),
//     equipos y puntajes de penales. Los jugadores reales se conservan.
//
// El torneo y los jugadores reales nunca se borran.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const reset = process.argv.includes("--reset");

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

const [tournament] = await api("GET", "tournaments?select=id&slug=eq.relampago-2026");
if (!tournament) {
  console.error("No se encontró el torneo activo");
  process.exit(1);
}

if (reset) {
  // Los match_events y team_players caen en cascada con partidos y equipos.
  const matches = await api("DELETE", `matches?tournament_id=eq.${tournament.id}`);
  const penalties = await api("DELETE", `penalty_scores?tournament_id=eq.${tournament.id}`);
  const teams = await api("DELETE", `teams?tournament_id=eq.${tournament.id}`);
  console.log(`✓ ${matches.length} partidos borrados (con sus goles y tarjetas)`);
  console.log(`✓ ${penalties.length} puntajes de penales borrados`);
  console.log(`✓ ${teams.length} equipos borrados`);
}

const players = await api("DELETE", "players?email=like.*%40dreamteam.test");
console.log(`✓ ${players.length} jugadores de prueba borrados (con sus inscripciones)`);

const [restantes] = await api(
  "GET",
  `registrations?select=count&tournament_id=eq.${tournament.id}`,
);
console.log(`→ quedan ${restantes?.count ?? 0} inscripciones reales en el torneo`);
