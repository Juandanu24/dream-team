// Crea (o recrea) un torneo de prueba con equipos y jugadores ficticios,
// para probar el flujo completo en local sin tocar el torneo real.
//
//   node --env-file=.env.local scripts/torneo-de-prueba.mjs
//
// Después, en .env.local:  NEXT_PUBLIC_TOURNAMENT_SLUG=prueba-local
// y reinicia `pnpm dev`. Para volver al torneo real, borra esa línea.
//
// Con --borrar elimina el torneo de prueba y todos sus datos.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SLUG = "prueba-local";
const borrar = process.argv.includes("--borrar");

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

async function api(method, path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// Borrar el torneo arrastra en cascada equipos, partidos e inscripciones.
await api("DELETE", `tournaments?slug=eq.${SLUG}`);
await api("DELETE", "players?email=like.*%40prueba.local");

if (borrar) {
  console.log("✓ Torneo de prueba eliminado");
  process.exit(0);
}

const [tournament] = await api("POST", "tournaments", {
  slug: SLUG,
  name: "Torneo de prueba (local)",
  status: "registration",
});

const nombres = [
  ["Arquero Uno", "goalkeeper"], ["Arquero Dos", "goalkeeper"],
  ["Arquero Tres", "goalkeeper"], ["Arquero Cuatro", "goalkeeper"],
];
for (let i = 1; i <= 20; i++) {
  const pos = i % 3 === 0 ? "defender" : i % 3 === 1 ? "midfielder" : "forward";
  nombres.push([`Jugador ${i}`, pos]);
}

const players = await api(
  "POST",
  "players",
  nombres.map(([full_name, position], i) => ({
    full_name,
    email: `p${i}@prueba.local`,
    age: 20 + (i % 20),
    dominant_foot: i % 3 === 0 ? "left" : "right",
    position,
    member_since: `${1 + (i % 5)} años`,
    photo_url: `https://api.dicebear.com/9.x/adventurer/png?seed=prueba${i}&size=320&backgroundColor=1c2205`,
  })),
);

await api(
  "POST",
  "registrations",
  players.map((p) => ({
    player_id: p.id,
    tournament_id: tournament.id,
    status: "approved",
  })),
);

const teams = await api(
  "POST",
  "teams",
  [
    ["Equipo A", "#CCFF00"], ["Equipo B", "#FF4D4D"],
    ["Equipo C", "#4DA6FF"], ["Equipo D", "#FF9F1C"],
  ].map(([name, color]) => ({ tournament_id: tournament.id, name, color })),
);

const arqueros = players.filter((p) => p.position === "goalkeeper");
const campo = players.filter((p) => p.position !== "goalkeeper");
const asignaciones = [];
teams.forEach((team, i) => {
  for (const p of [arqueros[i], ...campo.slice(i * 5, i * 5 + 5)]) {
    asignaciones.push({
      team_id: team.id,
      tournament_id: tournament.id,
      player_id: p.id,
      is_goalkeeper: p.position === "goalkeeper",
      is_captain: p.id === campo[i * 5]?.id,
    });
  }
});
await api("POST", "team_players", asignaciones);

console.log(`✓ Torneo "${SLUG}" listo: ${players.length} jugadores, 4 equipos de 6`);
console.log("→ Agrega a .env.local:  NEXT_PUBLIC_TOURNAMENT_SLUG=prueba-local");
console.log("→ Reinicia pnpm dev y prueba el flujo sin tocar el torneo real");
