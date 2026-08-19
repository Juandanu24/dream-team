"use client";

import { readableAccent } from "@/lib/team-color";

// Dibuja las piezas de Instagram en un canvas, con las mismas fuentes y
// colores de la web. Se dibuja a mano en vez de capturar el DOM por la
// misma razón que la carta de jugador: los degradados y el clip-path
// rompen a las librerías de screenshot.
//
// Las fuentes salen de las variables CSS que pone next/font, así que la
// pieza usa Bebas Neue y Archivo de verdad — por eso el generador vive
// en el navegador y no en un script de Node.

export type PieceKind =
  | "anuncio"
  | "resultado"
  | "posiciones"
  | "goleadores"
  | "equipo"
  | "penales";

export type PieceFormat = "feed" | "story";

export interface TeamSide {
  name: string;
  color: string | null;
  crestUrl?: string | null;
  score?: number | null;
}

export interface StandingLite {
  teamName: string;
  color: string | null;
  crestUrl?: string | null;
  played: number;
  goalDiff: number;
  points: number;
}

export interface RankLite {
  name: string;
  detail: string;
  value: number;
  photoUrl?: string | null;
  color?: string | null;
}

interface Common {
  format: PieceFormat;
  /** "SEMANA 1 · FASE DE GRUPOS" */
  eyebrow: string;
  /** "HOY JUGAMOS", "TABLA DE POSICIONES" */
  headline: string;
}

export type PostImageData = Common &
  (
    | {
        kind: "anuncio" | "resultado";
        home: TeamSide;
        away: TeamSide;
        /** "MARTES 18 DE AGOSTO · 8:00 PM" */
        when: string;
        /** "CANCHA F8 · MONTERÍA" */
        venue: string;
        /** Goleadores, al pie del panel. */
        note?: string;
      }
    | { kind: "posiciones"; rows: StandingLite[] }
    | { kind: "goleadores" | "penales"; rows: RankLite[]; unit: string }
    | {
        kind: "equipo";
        team: TeamSide;
        captain?: string;
        players: string[];
      }
  );

// El barrido del logo: azul profundo → cian → aqua → lima → amarillo.
const SWEEP: [number, string][] = [
  [0, "#012D9B"],
  [0.28, "#029CF3"],
  [0.46, "#03E4FA"],
  [0.7, "#A4E405"],
  [1, "#E1F804"],
];

const VOLT = "#CCFF00";
const BLUE = "#4FA8FF";
const INK = "#0A0A0A";
const PAPER = "#F5F5F5";
const MUTED = "#9A9A9A";

// Cada formato define su lienzo y dónde empieza y termina el contenido.
// En story el cuerpo baja bastante: Instagram tapa el borde superior con
// el avatar y el inferior con la caja de responder.
const LAYOUT = {
  feed: { w: 1080, h: 1350, eyebrowY: 150, headY: 268, bodyTop: 360, footerY: 1140 },
  story: { w: 1080, h: 1920, eyebrowY: 350, headY: 470, bodyTop: 570, footerY: 1610 },
} as const;

export type Layout = (typeof LAYOUT)[PieceFormat];

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Sin esto el canvas queda "manchado" y no se puede exportar.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fontStack(variable: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return value || fallback;
}

function sweepGradient(ctx: CanvasRenderingContext2D, x0: number, x1: number) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [stop, color] of SWEEP) g.addColorStop(stop, color);
  return g;
}

/** Baja el tamaño de fuente hasta que el texto quepa en el ancho dado. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  maxWidth: number,
  startSize: number,
  minSize: number,
) {
  let size = startSize;
  ctx.font = font(size);
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

/** Corta con puntos suspensivos si no cabe (la fuente ya debe estar puesta). */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/** Texto con espaciado entre letras, que canvas no trae de fábrica. */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  spacing: number,
) {
  const chars = [...text];
  const total =
    chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) +
    spacing * (chars.length - 1);
  let x = cx - total / 2;
  for (const c of chars) {
    ctx.fillText(c, x, y);
    x += ctx.measureText(c).width + spacing;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Escudo del equipo, o un círculo con la inicial si no hay imagen. */
function drawCrest(
  ctx: CanvasRenderingContext2D,
  crest: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  accent: string,
  display: string,
  fallbackLetter: string,
  glow = true,
) {
  if (glow) {
    const g = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.85);
    g.addColorStop(0, `${accent}55`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crest) {
    // Encajar sin deformar: el lado largo manda.
    const scale = Math.min(size / crest.width, size / crest.height);
    const w = crest.width * scale;
    const h = crest.height * scale;
    ctx.drawImage(crest, cx - w / 2, cy - h / 2, w, h);
    return;
  }

  ctx.fillStyle = `${accent}22`;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(2, size * 0.02);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${size * 0.45}px ${display}`;
  ctx.fillText(fallbackLetter, cx, cy + size * 0.03);
  ctx.textBaseline = "alphabetic";
}

/** Foto de jugador recortada en círculo, o las iniciales. */
function drawAvatar(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  name: string,
  sans: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (photo) {
    const scale = Math.max(size / photo.width, size / photo.height);
    const w = photo.width * scale;
    const h = photo.height * scale;
    ctx.drawImage(photo, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = "#242424";
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.fillStyle = MUTED;
    ctx.font = `600 ${size * 0.36}px ${sans}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.slice(0, 2).toUpperCase(), cx, cy);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.stroke();
}

// ── Marco común a todas las piezas ──────────────────────────────────

function drawChrome(
  ctx: CanvasRenderingContext2D,
  data: PostImageData,
  L: Layout,
  logo: HTMLImageElement | null,
  display: string,
  sans: string,
  glows: { x: number; color: string }[],
) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, L.w, L.h);

  // Resplandores de color, como luces de estadio.
  for (const { x, color } of glows) {
    const g = ctx.createRadialGradient(x, L.h * 0.42, 60, x, L.h * 0.42, L.h * 0.46);
    g.addColorStop(0, `${color}26`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.w, L.h);
  }

  // Barras de marca arriba y abajo.
  ctx.fillStyle = sweepGradient(ctx, 0, L.w);
  ctx.fillRect(0, 0, L.w, 12);
  ctx.fillRect(0, L.h - 12, L.w, 12);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = BLUE;
  ctx.font = `600 26px ${sans}`;
  tracked(ctx, data.eyebrow.toUpperCase(), L.w / 2, L.eyebrowY, 5);

  const headline = data.headline.toUpperCase();
  const size = fitText(ctx, headline, (s) => `${s}px ${display}`, L.w - 140, 128, 60);
  ctx.fillStyle = PAPER;
  ctx.font = `${size}px ${display}`;
  ctx.fillText(headline, L.w / 2, L.headY);

  ctx.fillStyle = VOLT;
  ctx.fillRect(L.w / 2 - 60, L.headY + 32, 120, 5);

  // Pie: monograma y dirección de la web.
  if (logo) {
    const h = 66;
    const w = (logo.width / logo.height) * h;
    ctx.drawImage(logo, L.w / 2 - w / 2, L.footerY, w, h);
  }
  ctx.font = `500 26px ${sans}`;
  ctx.fillStyle = "#8A8A8A";
  tracked(ctx, "DREAMTEAMCOLOMBIA.VERCEL.APP", L.w / 2, L.footerY + 114, 3);
}

// ── Cuerpos por tipo de pieza ───────────────────────────────────────

function drawMatchBody(
  ctx: CanvasRenderingContext2D,
  data: Extract<PostImageData, { kind: "anuncio" | "resultado" }>,
  L: Layout,
  crests: [HTMLImageElement | null, HTMLImageElement | null],
  display: string,
  sans: string,
) {
  const homeAccent = readableAccent(data.home.color);
  const awayAccent = readableAccent(data.away.color);

  // Todo el bloque se centra en la banda libre. Con offsets fijos el
  // panel con goleadores se montaba sobre el pie en formato feed.
  const crestSize = 260;
  const panelH = data.note ? 290 : 235;
  const blockH = crestSize + 100 + panelH;
  const band = L.footerY - L.bodyTop - 20;
  const blockTop = L.bodyTop + Math.max(0, (band - blockH) / 2);

  const crestY = blockTop + crestSize / 2;
  const leftX = 268;
  const rightX = L.w - 268;

  drawCrest(ctx, crests[0], leftX, crestY, crestSize, homeAccent, display, data.home.name.slice(0, 1));
  drawCrest(ctx, crests[1], rightX, crestY, crestSize, awayAccent, display, data.away.name.slice(0, 1));

  ctx.textAlign = "center";
  if (data.kind === "resultado") {
    ctx.font = `132px ${display}`;
    ctx.fillStyle = VOLT;
    ctx.fillText(`${data.home.score ?? 0}-${data.away.score ?? 0}`, L.w / 2, crestY + 46);
  } else {
    ctx.font = `104px ${display}`;
    ctx.fillStyle = PAPER;
    ctx.fillText("VS", L.w / 2, crestY + 36);
  }

  // Nombres bajo cada escudo, con su color como subrayado.
  const nameY = blockTop + crestSize + 56;
  for (const [cx, side, accent] of [
    [leftX, data.home, homeAccent],
    [rightX, data.away, awayAccent],
  ] as const) {
    const name = side.name.toUpperCase();
    const size = fitText(ctx, name, (s) => `${s}px ${display}`, 420, 56, 28);
    ctx.font = `${size}px ${display}`;
    ctx.fillStyle = PAPER;
    ctx.fillText(name, cx, nameY);
    const w = Math.min(ctx.measureText(name).width, 420);
    ctx.fillStyle = accent;
    ctx.fillRect(cx - w / 2, nameY + 18, w, 5);
  }

  // Panel con fecha, lugar y (si hay) goleadores.
  const panelY = blockTop + crestSize + 100;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  roundRect(ctx, 90, panelY, L.w - 180, panelH, 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const whenSize = fitText(
    ctx, data.when.toUpperCase(), (s) => `${s}px ${display}`, L.w - 260, 62, 34,
  );
  ctx.font = `${whenSize}px ${display}`;
  ctx.fillStyle = VOLT;
  ctx.fillText(data.when.toUpperCase(), L.w / 2, panelY + 92);

  ctx.font = `600 30px ${sans}`;
  ctx.fillStyle = "#C9C9C9";
  tracked(ctx, data.venue.toUpperCase(), L.w / 2, panelY + 150, 3);

  if (data.note) {
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(180, panelY + 188, L.w - 360, 2);
    const noteSize = fitText(ctx, data.note, (s) => `${s}px ${sans}`, L.w - 260, 28, 18);
    ctx.font = `${noteSize}px ${sans}`;
    ctx.fillStyle = "#E8E8E8";
    ctx.fillText(data.note, L.w / 2, panelY + 240);
  }
}

function drawStandingsBody(
  ctx: CanvasRenderingContext2D,
  data: Extract<PostImageData, { kind: "posiciones" }>,
  L: Layout,
  crests: (HTMLImageElement | null)[],
  display: string,
  sans: string,
) {
  const x0 = 90;
  const width = L.w - 180;
  const rowH = data.format === "story" ? 148 : 124;
  let y = L.bodyTop + 30;

  // Encabezado de columnas.
  const colPJ = x0 + width - 300;
  const colDG = x0 + width - 190;
  const colPTS = x0 + width - 60;
  ctx.font = `600 24px ${sans}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.fillText("PJ", colPJ, y);
  ctx.fillText("DG", colDG, y);
  ctx.fillStyle = VOLT;
  ctx.fillText("PTS", colPTS, y);
  y += 22;

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(x0, y, width, 2);
  y += 28;

  data.rows.forEach((row, i) => {
    const accent = readableAccent(row.color);
    const top = y + i * rowH;

    // Los dos primeros clasifican: fondo tenue y borde de color.
    if (i < 2) {
      ctx.fillStyle = "rgba(204,255,0,0.06)";
      roundRect(ctx, x0, top - 12, width, rowH - 14, 14);
      ctx.fill();
    }
    ctx.fillStyle = i < 2 ? VOLT : "rgba(255,255,255,0.22)";
    ctx.fillRect(x0, top - 12, 5, rowH - 14);

    ctx.textAlign = "left";
    ctx.font = `${data.format === "story" ? 54 : 46}px ${display}`;
    ctx.fillStyle = i < 2 ? VOLT : MUTED;
    ctx.fillText(String(i + 1), x0 + 26, top + 44);

    const crestSize = data.format === "story" ? 82 : 70;
    drawCrest(ctx, crests[i], x0 + 118, top + 30, crestSize, accent, display,
      row.teamName.slice(0, 1), false);

    const nameSize = data.format === "story" ? 46 : 40;
    ctx.font = `${nameSize}px ${display}`;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.fillText(truncate(ctx, row.teamName.toUpperCase(), colPJ - x0 - 200), x0 + 172, top + 44);

    ctx.textAlign = "center";
    ctx.font = `600 30px ${sans}`;
    ctx.fillStyle = "#C9C9C9";
    ctx.fillText(String(row.played), colPJ, top + 42);
    ctx.fillText(
      row.goalDiff > 0 ? `+${row.goalDiff}` : String(row.goalDiff),
      colDG,
      top + 42,
    );

    ctx.font = `${data.format === "story" ? 62 : 54}px ${display}`;
    ctx.fillStyle = i < 2 ? VOLT : PAPER;
    ctx.fillText(String(row.points), colPTS, top + 48);
  });
}

function drawRankBody(
  ctx: CanvasRenderingContext2D,
  data: Extract<PostImageData, { kind: "goleadores" | "penales" }>,
  L: Layout,
  photos: (HTMLImageElement | null)[],
  display: string,
  sans: string,
) {
  const x0 = 90;
  const width = L.w - 180;
  // El alto de fila sale del espacio libre: con 6 filas y alto fijo la
  // última quedaba pegada al pie.
  const band = L.footerY - L.bodyTop - 40;
  const rowH = Math.min(
    data.format === "story" ? 150 : 126,
    band / Math.max(1, data.rows.length),
  );
  const avatar = Math.round(rowH * 0.66);
  const y = L.bodyTop + 20;

  data.rows.forEach((row, i) => {
    const top = y + i * rowH;
    const accent = readableAccent(row.color ?? null);

    if (i === 0) {
      ctx.fillStyle = "rgba(204,255,0,0.07)";
      roundRect(ctx, x0, top - 10, width, rowH - 14, 14);
      ctx.fill();
    }

    ctx.textAlign = "left";
    ctx.font = `${Math.round(rowH * 0.37)}px ${display}`;
    ctx.fillStyle = i === 0 ? VOLT : MUTED;
    ctx.fillText(String(i + 1), x0 + 16, top + rowH * 0.38);

    drawAvatar(ctx, photos[i], x0 + 128, top + rowH * 0.28, avatar, row.name, sans);

    ctx.textAlign = "left";
    const nameX = x0 + 128 + avatar / 2 + 26;
    const nameMax = width - (nameX - x0) - 130;
    ctx.font = `${Math.round(rowH * 0.34)}px ${display}`;
    ctx.fillStyle = PAPER;
    ctx.fillText(truncate(ctx, row.name.toUpperCase(), nameMax), nameX, top + rowH * 0.22);

    ctx.font = `500 ${Math.round(rowH * 0.2)}px ${sans}`;
    ctx.fillStyle = accent;
    ctx.fillText(truncate(ctx, row.detail, nameMax), nameX, top + rowH * 0.5);

    ctx.textAlign = "right";
    ctx.font = `${Math.round(rowH * 0.48)}px ${display}`;
    ctx.fillStyle = i === 0 ? VOLT : PAPER;
    const valueX = x0 + width - 16;
    ctx.fillText(String(row.value), valueX, top + rowH * 0.4);

    ctx.font = `600 ${Math.round(rowH * 0.17)}px ${sans}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = "right";
    ctx.fillText(data.unit.toUpperCase(), valueX, top + rowH * 0.63);
  });
}

function drawTeamBody(
  ctx: CanvasRenderingContext2D,
  data: Extract<PostImageData, { kind: "equipo" }>,
  L: Layout,
  crest: HTMLImageElement | null,
  display: string,
  sans: string,
) {
  const accent = readableAccent(data.team.color);

  // La nómina puede traer 11 nombres o 20: el interlineado sale del
  // espacio que sobre, en vez de un valor fijo que se salía del pie.
  const crestSize = data.format === "story" ? 320 : 220;
  const crestY = L.bodyTop + crestSize / 2 + 10;

  drawCrest(ctx, crest, L.w / 2, crestY, crestSize, accent, display,
    data.team.name.slice(0, 1));

  ctx.textAlign = "center";
  const name = data.team.name.toUpperCase();
  const nameSize = fitText(ctx, name, (s) => `${s}px ${display}`, L.w - 200, 82, 38);
  ctx.font = `${nameSize}px ${display}`;
  ctx.fillStyle = PAPER;
  const nameY = crestY + crestSize / 2 + 70;
  ctx.fillText(name, L.w / 2, nameY);

  const nameW = Math.min(ctx.measureText(name).width, L.w - 200);
  ctx.fillStyle = accent;
  ctx.fillRect(L.w / 2 - nameW / 2, nameY + 20, nameW, 6);

  let y = nameY + 84;

  if (data.captain) {
    ctx.font = `600 26px ${sans}`;
    ctx.fillStyle = MUTED;
    tracked(ctx, "CAPITÁN", L.w / 2, y, 5);
    ctx.font = `52px ${display}`;
    ctx.fillStyle = VOLT;
    ctx.fillText(data.captain.toUpperCase(), L.w / 2, y + 56);
    y += 112;
  }

  if (data.players.length > 0) {
    ctx.font = `600 26px ${sans}`;
    ctx.fillStyle = MUTED;
    tracked(ctx, "NÓMINA", L.w / 2, y, 5);
    y += 46;

    // Dos columnas, y el interlineado se ajusta a lo que quede libre.
    const perCol = Math.ceil(data.players.length / 2);
    const room = L.footerY - y - 20;
    const lineH = Math.min(44, room / perCol);
    const size = Math.max(20, Math.min(34, Math.round(lineH * 0.74)));
    ctx.font = `${size}px ${display}`;
    ctx.fillStyle = "#DEDEDE";
    data.players.forEach((player, i) => {
      const col = i < perCol ? 0 : 1;
      const row = i % perCol;
      ctx.textAlign = col === 0 ? "right" : "left";
      const x = col === 0 ? L.w / 2 - 30 : L.w / 2 + 30;
      ctx.fillText(truncate(ctx, player.toUpperCase(), 420), x, y + row * lineH);
    });
  }
}

// ── Punto de entrada ────────────────────────────────────────────────

export async function renderPostImage(data: PostImageData): Promise<Blob> {
  await document.fonts.ready;

  const display = fontStack("--font-bebas", "Impact, sans-serif");
  const sans = fontStack("--font-archivo", "system-ui, sans-serif");
  const L = LAYOUT[data.format];

  const canvas = document.createElement("canvas");
  canvas.width = L.w;
  canvas.height = L.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");

  const logo = await loadImage("/logo-dt.webp");

  // Cada tipo carga sus imágenes y define de dónde salen los resplandores.
  let glows: { x: number; color: string }[] = [];
  let crests: (HTMLImageElement | null)[] = [];
  let photos: (HTMLImageElement | null)[] = [];

  if (data.kind === "anuncio" || data.kind === "resultado") {
    crests = await Promise.all([
      data.home.crestUrl ? loadImage(data.home.crestUrl) : null,
      data.away.crestUrl ? loadImage(data.away.crestUrl) : null,
    ]);
    glows = [
      { x: L.w * 0.16, color: readableAccent(data.home.color) },
      { x: L.w * 0.84, color: readableAccent(data.away.color) },
    ];
  } else if (data.kind === "posiciones") {
    crests = await Promise.all(
      data.rows.map((r) => (r.crestUrl ? loadImage(r.crestUrl) : null)),
    );
    glows = [{ x: L.w * 0.5, color: VOLT }];
  } else if (data.kind === "equipo") {
    crests = [data.team.crestUrl ? await loadImage(data.team.crestUrl) : null];
    glows = [{ x: L.w * 0.5, color: readableAccent(data.team.color) }];
  } else if (data.kind === "goleadores" || data.kind === "penales") {
    photos = await Promise.all(
      data.rows.map((r) => (r.photoUrl ? loadImage(r.photoUrl) : null)),
    );
    glows = [{ x: L.w * 0.5, color: data.kind === "penales" ? BLUE : VOLT }];
  }

  drawChrome(ctx, data, L, logo, display, sans, glows);

  if (data.kind === "anuncio" || data.kind === "resultado") {
    drawMatchBody(ctx, data, L, [crests[0], crests[1]], display, sans);
  } else if (data.kind === "posiciones") {
    drawStandingsBody(ctx, data, L, crests, display, sans);
  } else if (data.kind === "equipo") {
    drawTeamBody(ctx, data, L, crests[0], display, sans);
  } else if (data.kind === "goleadores" || data.kind === "penales") {
    drawRankBody(ctx, data, L, photos, display, sans);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo exportar la pieza"))),
      "image/png",
    );
  });
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function postFileName(data: PostImageData) {
  const detail =
    data.kind === "anuncio" || data.kind === "resultado"
      ? `-${slug(data.home.name)}-vs-${slug(data.away.name)}`
      : data.kind === "equipo"
        ? `-${slug(data.team.name)}`
        : "";
  return `dt-${data.kind}${detail}-${data.format}.png`;
}
