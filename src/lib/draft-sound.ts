"use client";

// El sonido de "elegido" se SINTETIZA, no es un archivo.
//
// Son unas líneas de Web Audio contra un mp3 que habría que buscar,
// licenciar, servir y cachear en la PWA. Además así se afina tocando
// números en vez de volviendo a exportar audio.
//
// Tres capas, que es lo que hace que suene a premio y no a notificación:
// un golpe grave que da cuerpo, un barrido de ruido que hace el "fff"
// de la carta entrando, y dos notas en quinta que rematan hacia arriba.

const CLAVE = "dt-sorteo-sonido";

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  // Los navegadores arrancan el contexto suspendido hasta que hay un
  // gesto del usuario. Acá siempre venimos de un toque, así que se puede
  // reanudar sin que lo bloqueen.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function sonidoActivo(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(CLAVE) !== "off";
  } catch {
    return true;
  }
}

// Store mínimo para `useSyncExternalStore`, igual que el estado de
// movimiento de las cartas: así el interruptor se entera del cambio sin
// leer localStorage en un efecto.
const oyentes = new Set<() => void>();

export function suscribirSonido(cb: () => void) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

export function cambiarSonido(activo: boolean) {
  try {
    window.localStorage.setItem(CLAVE, activo ? "on" : "off");
  } catch {
    // Modo incógnito o almacenamiento bloqueado: el sonido queda como
    // esté en esta sesión y no se rompe nada.
  }
  oyentes.forEach((f) => f());
}

/** Golpe grave: le da peso al momento. */
function golpe(ac: AudioContext, t: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);
  // Las rampas arrancan y terminan en valores > 0 para que no suene el
  // "clic" de cortar la onda en seco.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.32);
}

/** El "fff" de la carta entrando: ruido filtrado barriendo hacia arriba. */
function barrido(ac: AudioContext, t: number) {
  const muestras = Math.floor(ac.sampleRate * 0.35);
  const buffer = ac.createBuffer(1, muestras, ac.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < muestras; i++) datos[i] = Math.random() * 2 - 1;

  const fuente = ac.createBufferSource();
  fuente.buffer = buffer;
  const filtro = ac.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.Q.value = 1.1;
  filtro.frequency.setValueAtTime(700, t);
  filtro.frequency.exponentialRampToValueAtTime(5200, t + 0.3);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.16, t + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  fuente.connect(filtro).connect(gain).connect(ac.destination);
  fuente.start(t);
}

/** Dos notas en quinta, la segunda encima: el remate hacia arriba. */
function notas(ac: AudioContext, t: number) {
  [
    { hz: 659.25, en: 0.1, dur: 0.5 }, // mi
    { hz: 987.77, en: 0.22, dur: 0.6 }, // si, una quinta arriba
  ].forEach(({ hz, en, dur }) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.value = hz;
    const inicio = t + en;
    gain.gain.setValueAtTime(0.0001, inicio);
    gain.gain.exponentialRampToValueAtTime(0.22, inicio + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(inicio);
    osc.stop(inicio + dur + 0.02);
  });
}

/** Suena cuando un capitán elige. No hace nada si está apagado o si el
 *  navegador no trae Web Audio: el sorteo funciona igual sin sonido. */
export function sonarEleccion() {
  if (!sonidoActivo()) return;
  const ac = contexto();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  golpe(ac, t);
  barrido(ac, t);
  notas(ac, t);
}
