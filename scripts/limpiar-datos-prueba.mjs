// Borra los jugadores de prueba (emails @dreamteam.test) y, en cascada,
// sus inscripciones y asignaciones a equipos.
//
// Uso:  node --env-file=.env.local scripts/limpiar-datos-prueba.mjs

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltan las variables de Supabase (corre con --env-file=.env.local)");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Prefer: "return=representation",
};

const res = await fetch(
  `${url}/rest/v1/players?email=like.*%40dreamteam.test`,
  { method: "DELETE", headers },
);

if (!res.ok) {
  console.error("Error borrando:", res.status, await res.text());
  process.exit(1);
}

const deleted = await res.json();
console.log(`✓ ${deleted.length} jugadores de prueba borrados (con sus inscripciones y equipos)`);
