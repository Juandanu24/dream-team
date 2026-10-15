// Lógica pura del turno del sorteo. Sin imports a propósito: se puede
// simular con `node --experimental-strip-types` sin levantar nada, igual
// que `penalty-game.ts`. Toda la decisión de "a quién le toca" vive acá
// para que la UI y las acciones no la reimplementen cada una a su modo.

export type ModoSorteo = "pool" | "pots";
export type ModoOrden = "once" | "per_round";

export interface EquipoEnSorteo {
  teamId: string;
  /** 1 = elige primero. Solo los que participan tienen puesto. */
  position: number;
}

export interface PickHecho {
  teamId: string;
  round: number;
}

export interface EstadoDelTurno {
  /** A quién le toca. Null si la ronda ya se completó. */
  teamId: string | null;
  /** La ronda terminó: o eligieron todos, o se acabó el bombo. */
  rondaCompleta: boolean;
  /** Cuántos faltan por elegir en esta ronda. */
  faltanEnRonda: number;
}

/** De quién es el turno en una ronda dada.
 *
 *  Los equipos eligen en orden de `position`, uno cada uno, y la ronda
 *  termina cuando todos pasaron. En modo bombos la ronda ES el bombo, y
 *  además termina si el bombo se quedó sin jugadores: con cinco equipos
 *  y un bombo de tres, dos se quedan sin elegir de ese bombo y hay que
 *  pasar al siguiente en vez de trabarse esperando un turno imposible.
 */
export function estadoDelTurno(
  equipos: EquipoEnSorteo[],
  picks: PickHecho[],
  round: number,
  disponiblesEnLaRonda: number,
): EstadoDelTurno {
  const enOrden = [...equipos].sort((a, b) => a.position - b.position);
  const yaEligieron = picks.filter((p) => p.round === round).length;
  const faltan = Math.max(0, enOrden.length - yaEligieron);

  if (enOrden.length === 0 || faltan === 0 || disponiblesEnLaRonda === 0) {
    return { teamId: null, rondaCompleta: true, faltanEnRonda: faltan };
  }
  return {
    teamId: enOrden[yaEligieron].teamId,
    rondaCompleta: false,
    faltanEnRonda: faltan,
  };
}

/** Un orden al azar, 1..n. Mezcla de Fisher-Yates.
 *
 *  Se resuelve en el SERVIDOR y se guarda. Si lo decidiera el navegador,
 *  recargar la página sería volver a tirar los dados hasta que salga el
 *  orden que uno quiere, y el sorteo dejaría de ser un sorteo. La
 *  animación del cliente revela un resultado que ya está escrito. */
export function ordenAlAzar<T>(items: T[]): { item: T; position: number }[] {
  const mezcla = [...items];
  for (let i = mezcla.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mezcla[i], mezcla[j]] = [mezcla[j], mezcla[i]];
  }
  return mezcla.map((item, i) => ({ item, position: i + 1 }));
}

/** El nombre del bombo: 1 → "Bombo A". Se deriva del número para no
 *  tener que mantener filas de bombos con nombre propio. */
export function nombreDeBombo(pot: number): string {
  return `Bombo ${String.fromCharCode(64 + pot)}`;
}
