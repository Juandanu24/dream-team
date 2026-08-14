// Motor del reto de penales. Sin React ni DOM: solo la lógica del
// disparo, para que la UI se limite a dibujar y animar.

export const SHOTS_PER_ROUND = 5;

export interface Zone {
  id: number;
  col: 0 | 1 | 2;
  row: 0 | 1;
  /** Centro de la zona en % de la escena (para colocar balón y arquero). */
  x: number;
  y: number;
  /** Probabilidad de mandarla afuera: los ángulos altos son más golosos. */
  risk: number;
  /** Si el arquero adivina la zona, qué tan probable es que la ataje.
   *  Arriba le cuesta llegar aunque adivine; abajo casi siempre llega. */
  saveIfGuessed: number;
  label: string;
}

// El trade-off del juego: arriba es difícil de atajar pero fácil de
// mandar afuera; abajo es seguro de embocar pero el arquero llega.
export const ZONES: Zone[] = [
  { id: 0, col: 0, row: 0, x: 22, y: 25, risk: 0.26, saveIfGuessed: 0.6, label: "Ángulo izquierdo" },
  { id: 1, col: 1, row: 0, x: 50, y: 22, risk: 0.19, saveIfGuessed: 0.68, label: "Arriba al medio" },
  { id: 2, col: 2, row: 0, x: 78, y: 25, risk: 0.26, saveIfGuessed: 0.6, label: "Ángulo derecho" },
  { id: 3, col: 0, row: 1, x: 22, y: 49, risk: 0.05, saveIfGuessed: 0.9, label: "Abajo izquierda" },
  { id: 4, col: 1, row: 1, x: 50, y: 51, risk: 0.02, saveIfGuessed: 0.96, label: "Abajo al medio" },
  { id: 5, col: 2, row: 1, x: 78, y: 49, risk: 0.05, saveIfGuessed: 0.9, label: "Abajo derecha" },
];

/** Distancia máxima entre el arquero y una zona, para normalizar. */
const MAX_SPREAD = 56;

export type ShotOutcome = "goal" | "saved" | "missed";

export interface ShotResult {
  outcome: ShotOutcome;
  shotZone: Zone;
  keeperZone: Zone;
}

/** Cuántas veces disparó el jugador a cada zona (índice = zona). */
export type Tendencies = number[];

export function emptyTendencies(): Tendencies {
  return ZONES.map(() => 0);
}

// El arquero decide a dónde lanzarse: pesa dónde está parado en ese
// instante (por eso conviene esperar a que se abra) y las manías del
// pateador (si siempre va al mismo palo, empieza a adivinarle).
export function chooseKeeperZone(
  keeperX: number,
  tendencies: Tendencies,
  random: () => number = Math.random,
): Zone {
  const totalShots = Math.max(1, tendencies.reduce((a, b) => a + b, 0));

  const weights = ZONES.map((zone) => {
    const proximity = Math.max(
      0,
      1 - Math.abs(zone.x - keeperX) / MAX_SPREAD,
    );
    const habit = tendencies[zone.id] / totalShots;
    // Se tira más a ras de piso que a los ángulos, como un arquero real.
    const rowBias = zone.row === 1 ? 1.35 : 0.8;
    return (0.5 + proximity * 2.4) * rowBias * (1 + 2 * habit);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let ticket = random() * total;
  for (let i = 0; i < ZONES.length; i++) {
    ticket -= weights[i];
    if (ticket <= 0) return ZONES[i];
  }
  return ZONES[ZONES.length - 1];
}

// Resuelve el disparo. Aunque el arquero adivine la zona, un buen
// remate puede entrar igual; y si se lanza al palo de al lado todavía
// alcanza a estirarse.
export function resolveShot(
  shotZone: Zone,
  keeperZone: Zone,
  random: () => number = Math.random,
): ShotOutcome {
  if (random() < shotZone.risk) return "missed";

  if (keeperZone.id === shotZone.id) {
    return random() < shotZone.saveIfGuessed ? "saved" : "goal";
  }

  // Aunque se lance al palo de al lado, todavía alcanza a estirarse.
  const adjacent = Math.abs(keeperZone.col - shotZone.col) === 1;
  const sameRow = keeperZone.row === shotZone.row;
  const stretch = sameRow ? (shotZone.row === 1 ? 0.42 : 0.2) : 0.12;
  if (adjacent && random() < stretch) return "saved";

  return "goal";
}

export function outcomeLabel(outcome: ShotOutcome): string {
  return outcome === "goal" ? "¡GOL!" : outcome === "saved" ? "¡ATAJADA!" : "¡AFUERA!";
}

export function scoreComment(score: number): string {
  if (score === 5) return "¡Perfecto! Cinco de cinco, eres el pichichi 🏆";
  if (score === 4) return "Casi perfecto, el arquero apenas te adivinó una 🔥";
  if (score === 3) return "Bien ahí, más de la mitad adentro ⚽";
  if (score === 2) return "Se puede mejorar, no le regales el palo al arquero 💪";
  if (score === 1) return "Uno de cinco… mejor pídele consejos al 9 🙈";
  return "Cero goles. El arquero te leyó completo 😅";
}
