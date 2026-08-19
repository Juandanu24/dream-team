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
  | "penales"
  | "alineacion";

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

/** Un goleador del partido. `goals` permite "×2" sin repetir la fila. */
export interface ScorerLine {
  name: string;
  goals: number;
}

/** Una línea de la cancha, de arquero a delantera.
 *  `players` tiene largo `width` y admite huecos: una alineación a medio
 *  armar debe dejar la casilla vacía en su sitio, no repartir a los que
 *  hay. Si no, dos defensas de tres se dibujan como si fueran dos. */
export interface LineupRow {
  width: number;
  players: ({ name: string; isCaptain?: boolean } | null)[];
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
        /** Goleadores por equipo, solo en "resultado". Van en dos
         *  columnas: antes era una sola cadena que se salía del panel
         *  en cuanto el partido pasaba de tres o cuatro goles. */
        homeScorers?: ScorerLine[];
        awayScorers?: ScorerLine[];
      }
    | { kind: "posiciones"; rows: StandingLite[] }
    | {
        kind: "goleadores" | "penales";
        rows: RankLite[];
        unit: string;
        /** "+4 más con 1 gol", cuando el corte parte un empate. */
        footnote?: string;
      }
    | {
        kind: "equipo";
        team: TeamSide;
        captain?: string;
        players: string[];
      }
    | {
        kind: "alineacion";
        team: TeamSide;
        formation: string;
        /** De arquero a delantera; se dibuja de abajo hacia arriba. */
        rows: LineupRow[];
        bench: string[];
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

/** Texto centrado con espaciado entre letras, que canvas no trae de fábrica.
 *
 *  La x que se calcula acá es el BORDE IZQUIERDO de cada letra, así que hay
 *  que forzar textAlign a "left" mientras se dibuja. Los llamadores dejan
 *  "center" activo, y con eso cada glifo se centraba sobre su borde
 *  izquierdo: la línea entera quedaba descentrada. */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  spacing: number,
) {
  const chars = [...text];
  const anchos = chars.map((c) => ctx.measureText(c).width);
  const total =
    anchos.reduce((sum, w) => sum + w, 0) + spacing * (chars.length - 1);

  const alineacionPrevia = ctx.textAlign;
  ctx.textAlign = "left";
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += anchos[i] + spacing;
  });
  ctx.textAlign = alineacionPrevia;
}

/** Balón pequeño. Se dibuja a mano porque el emoji ⚽ en canvas depende
 *  de la fuente del sistema y en algunos equipos sale como cuadro. */
function drawBall(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#F2F2F2";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.stroke();

  // Pentágono central: a este tamaño es lo que lo hace leer como balón.
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = cx + Math.cos(a) * r * 0.48;
    const y = cy + Math.sin(a) * r * 0.48;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#141414";
  ctx.fill();
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

interface ContentBox {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// Cada escudo trae distinto margen transparente: el de un equipo ocupaba
// el 94% de su PNG y el de otro el 86%, así que al encajarlos por el
// lienzo uno salía 11% más grande que el otro y la pieza se veía
// cargada hacia un lado. Se mide el contenido real y se encaja ESE.
const cacheCaja = new WeakMap<HTMLImageElement, ContentBox | null>();

function contentBox(img: HTMLImageElement): ContentBox | null {
  const guardado = cacheCaja.get(img);
  if (guardado !== undefined) return guardado;

  let caja: ContentBox | null = null;
  try {
    // Un muestreo de 200px basta para hallar los bordes y es barato.
    const escala = Math.min(1, 200 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * escala));
    const h = Math.max(1, Math.round(img.height * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = w;
    lienzo.height = h;
    const c = lienzo.getContext("2d");
    if (c) {
      c.drawImage(img, 0, 0, w, h);
      const datos = c.getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (datos[(y * w + x) * 4 + 3] > 12) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= 0) {
        caja = {
          sx: minX / escala,
          sy: minY / escala,
          sw: (maxX - minX + 1) / escala,
          sh: (maxY - minY + 1) / escala,
        };
      }
    }
  } catch {
    // Si el bucket no manda CORS, getImageData lanza: se usa el PNG entero.
    caja = null;
  }
  cacheCaja.set(img, caja);
  return caja;
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
    // Encajar sin deformar el CONTENIDO, no el lienzo: así dos escudos
    // con distinto margen transparente salen del mismo tamaño.
    const caja = contentBox(crest) ?? {
      sx: 0,
      sy: 0,
      sw: crest.width,
      sh: crest.height,
    };
    const scale = Math.min(size / caja.sw, size / caja.sh);
    const w = caja.sw * scale;
    const h = caja.sh * scale;
    ctx.drawImage(crest, caja.sx, caja.sy, caja.sw, caja.sh, cx - w / 2, cy - h / 2, w, h);
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

  const homeScorers = data.homeScorers ?? [];
  const awayScorers = data.awayScorers ?? [];
  const filas = Math.max(homeScorers.length, awayScorers.length);
  const conGoleadores = data.kind === "resultado" && filas > 0;

  // Todo se mide contra la banda libre y no con offsets fijos: en un
  // partido de muchos goles, la lista crece y el bloque tiene que
  // encogerse solo en vez de montarse sobre el pie.
  const crestSize = conGoleadores ? 220 : 260;
  const gapNombres = 100;
  const cabeceraPanel = conGoleadores ? 130 : 235;
  const band = L.footerY - L.bodyTop - 20;

  // 88 = separador + encabezados de columna + aire de abajo.
  const fijo = crestSize + gapNombres + cabeceraPanel + (conGoleadores ? 88 : 0);
  // Por debajo de 24px la fila deja de leerse, así que en vez de seguir
  // encogiendo se corta la lista y se remata con "+N más". Un 12-0 en
  // formato feed se salía del pie.
  const cabenFilas = Math.max(1, Math.floor((band - fijo) / 24));
  const filasVisibles = Math.min(filas, cabenFilas);
  const rowH = conGoleadores
    ? Math.min(46, (band - fijo) / Math.max(1, filasVisibles))
    : 0;
  const panelH = cabeceraPanel + (conGoleadores ? 88 + filasVisibles * rowH : 0);
  const blockH = crestSize + gapNombres + panelH;
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

  // Nombres bajo cada escudo, con su color como subrayado. Los dos van
  // al MISMO tamaño —manda el que menos quepa—: ajustar cada uno por
  // separado dejaba el nombre corto enorme al lado del largo y la pieza
  // se veía cargada hacia ese lado.
  const nameY = blockTop + crestSize + 56;
  const tamNombre = Math.min(
    fitText(ctx, data.home.name.toUpperCase(), (s) => `${s}px ${display}`, 420, 56, 28),
    fitText(ctx, data.away.name.toUpperCase(), (s) => `${s}px ${display}`, 420, 56, 28),
  );
  for (const [cx, side, accent] of [
    [leftX, data.home, homeAccent],
    [rightX, data.away, awayAccent],
  ] as const) {
    const name = side.name.toUpperCase();
    const size = tamNombre;
    ctx.font = `${size}px ${display}`;
    ctx.fillStyle = PAPER;
    ctx.fillText(name, cx, nameY);
    const w = Math.min(ctx.measureText(name).width, 420);
    ctx.fillStyle = accent;
    ctx.fillRect(cx - w / 2, nameY + 18, w, 5);
  }

  // Panel con fecha, lugar y, si hay, los goleadores en dos columnas.
  const panelY = blockTop + crestSize + gapNombres;
  const panelX = 90;
  const panelW = L.w - 180;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  roundRect(ctx, panelX, panelY, panelW, panelH, 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  const whenTop = conGoleadores ? 62 : 92;
  const whenSize = fitText(
    ctx,
    data.when.toUpperCase(),
    (s) => `${s}px ${display}`,
    panelW - 80,
    conGoleadores ? 46 : 62,
    30,
  );
  ctx.font = `${whenSize}px ${display}`;
  ctx.fillStyle = VOLT;
  ctx.fillText(data.when.toUpperCase(), L.w / 2, panelY + whenTop);

  ctx.font = `600 ${conGoleadores ? 26 : 30}px ${sans}`;
  ctx.fillStyle = "#C9C9C9";
  tracked(ctx, data.venue.toUpperCase(), L.w / 2, panelY + whenTop + (conGoleadores ? 42 : 58), 3);

  if (!conGoleadores) return;

  // ---- Goleadores: una columna por equipo ----
  const sepY = panelY + cabeceraPanel - 18;
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(panelX + 40, sepY, panelW - 80, 2);

  // Línea vertical que parte las dos columnas.
  const listaTop = sepY + 26;
  const listaAlto = 46 + filasVisibles * rowH;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(L.w / 2 - 1, listaTop, 2, listaAlto);

  const colW = panelW / 2 - 70;
  const columnas = [
    { x: panelX + 42, scorers: homeScorers, accent: homeAccent, name: data.home.name },
    { x: L.w / 2 + 32, scorers: awayScorers, accent: awayAccent, name: data.away.name },
  ];

  for (const col of columnas) {
    // Encabezado con el nombre del equipo en su color: si alguien
    // recorta la pieza, la columna sigue diciendo de quién es.
    ctx.textAlign = "left";
    ctx.font = `600 24px ${sans}`;
    ctx.fillStyle = col.accent;
    ctx.fillText(truncate(ctx, col.name.toUpperCase(), colW), col.x, listaTop + 26);

    const ballR = Math.max(9, Math.min(15, rowH * 0.3));
    const nameSize = Math.max(22, Math.min(34, Math.round(rowH * 0.66)));

    // Si la columna no cabe entera, se reserva una fila para el resumen.
    const cabe =
      col.scorers.length > filasVisibles ? filasVisibles - 1 : filasVisibles;
    const visibles = col.scorers.slice(0, cabe);
    const restantes = col.scorers
      .slice(cabe)
      .reduce((total, r) => total + r.goals, 0);

    const textoX = col.x + ballR * 2 + 14;
    const anchoTexto = colW - (textoX - col.x);

    visibles.forEach((scorer, i) => {
      const y = listaTop + 46 + i * rowH + rowH / 2;
      drawBall(ctx, col.x + ballR, y, ballR);

      const etiqueta =
        scorer.goals > 1 ? `${scorer.name} ×${scorer.goals}` : scorer.name;
      ctx.font = `${nameSize}px ${display}`;
      ctx.fillStyle = PAPER;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(truncate(ctx, etiqueta.toUpperCase(), anchoTexto), textoX, y + 1);
      ctx.textBaseline = "alphabetic";
    });

    if (restantes > 0) {
      const y = listaTop + 46 + visibles.length * rowH + rowH / 2;
      ctx.font = `${Math.round(nameSize * 0.82)}px ${display}`;
      ctx.fillStyle = MUTED;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${restantes} MÁS`, textoX, y + 1);
      ctx.textBaseline = "alphabetic";
    }
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
  // El alto de fila sale del espacio libre: con alto fijo, la última
  // quedaba pegada al pie.
  // La nota al pie se descuenta antes de repartir el alto de fila, si no
  // la última fila se le monta encima.
  const notaH = data.footnote ? 54 : 0;
  const band = L.footerY - L.bodyTop - 40 - notaH;
  const rowH = Math.min(
    data.format === "story" ? 150 : 126,
    band / Math.max(1, data.rows.length),
  );
  const avatar = Math.round(rowH * 0.66);
  const y = L.bodyTop + 20;

  // Puesto real, con empates: nueve jugadores con un gol comparten el
  // primer puesto, no van numerados del 1 al 9. El número solo se
  // imprime cuando cambia, para que el empate se lea de una.
  const puestos = data.rows.map((row, i, todas) =>
    i > 0 && todas[i - 1].value === row.value ? 0 : i + 1,
  );

  // Si TODOS están empatados no hay líder, y resaltar al primero de la
  // lista sería inventarse un orden que los datos no tienen.
  const mejor = data.rows[0]?.value;
  const todosIguales = data.rows.every((r) => r.value === mejor);
  const esLider = (row: RankLite) => !todosIguales && row.value === mejor;

  data.rows.forEach((row, i) => {
    const top = y + i * rowH;
    const accent = readableAccent(row.color ?? null);
    const lider = esLider(row);

    if (lider) {
      ctx.fillStyle = "rgba(204,255,0,0.07)";
      roundRect(ctx, x0, top - 10, width, rowH - 14, 14);
      ctx.fill();
    }

    ctx.textAlign = "left";
    if (puestos[i] > 0) {
      ctx.font = `${Math.round(rowH * 0.37)}px ${display}`;
      ctx.fillStyle = lider ? VOLT : MUTED;
      ctx.fillText(String(puestos[i]), x0 + 16, top + rowH * 0.38);
    }

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
    ctx.fillStyle = lider ? VOLT : PAPER;
    const valueX = x0 + width - 16;
    ctx.fillText(String(row.value), valueX, top + rowH * 0.4);

    ctx.font = `600 ${Math.round(rowH * 0.17)}px ${sans}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = "right";
    ctx.fillText(data.unit.toUpperCase(), valueX, top + rowH * 0.63);
  });

  // Quien quedó fuera del corte por empate: se dice, no se esconde.
  if (data.footnote) {
    ctx.textAlign = "center";
    ctx.font = `500 28px ${sans}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(data.footnote, L.w / 2, y + data.rows.length * rowH + 34);
  }
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

/** "Juan David Pérez" → "J. Pérez": en la cancha no cabe el nombre entero. */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

/** Variante alternativa: "Juan David Pérez" → "Juan P." */
function altName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// Dos "J. PÉREZ" en la misma cancha son indistinguibles y la pieza
// miente sobre quién juega. Se desempata a "JUAN P." y, si vuelven a
// chocar, al nombre completo.
function shirtNames(nombres: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const porCorto = new Map<string, string[]>();
  for (const nombre of nombres) {
    const corto = shortName(nombre);
    porCorto.set(corto, [...(porCorto.get(corto) ?? []), nombre]);
  }
  for (const [corto, grupo] of porCorto) {
    const distintos = [...new Set(grupo)];
    if (distintos.length === 1) {
      out.set(distintos[0], corto);
      continue;
    }
    const alternativos = distintos.map(altName);
    const sinChoque = new Set(alternativos).size === alternativos.length;
    distintos.forEach((nombre, i) => {
      out.set(nombre, sinChoque ? alternativos[i] : nombre);
    });
  }
  return out;
}

function drawLineupBody(
  ctx: CanvasRenderingContext2D,
  data: Extract<PostImageData, { kind: "alineacion" }>,
  L: Layout,
  crest: HTMLImageElement | null,
  display: string,
  sans: string,
) {
  const accent = readableAccent(data.team.color);

  // Las etiquetas se resuelven contra TODA la pieza (cancha + banca),
  // porque el choque puede ser entre un titular y un suplente.
  const etiquetas = shirtNames([
    ...data.rows.flatMap((r) => r.players.filter(Boolean).map((p) => p!.name)),
    ...data.bench,
  ]);
  const etiqueta = (nombre: string) => etiquetas.get(nombre) ?? shortName(nombre);

  // La cancha ocupa la banda libre, menos la línea de suplentes si hay.
  const benchH = data.bench.length > 0 ? 96 : 0;
  const top = L.bodyTop + 10;
  const bottom = L.footerY - 20 - benchH;
  const pitchH = bottom - top;
  const pitchX = 90;
  const pitchW = L.w - 180;

  // ---- Cancha ----
  ctx.save();
  roundRect(ctx, pitchX, top, pitchW, pitchH, 18);
  ctx.clip();

  // Verde muy oscuro, para que no pelee con el negro de la marca.
  const grass = ctx.createLinearGradient(0, top, 0, bottom);
  grass.addColorStop(0, "#0C1E12");
  grass.addColorStop(1, "#07140C");
  ctx.fillStyle = grass;
  ctx.fillRect(pitchX, top, pitchW, pitchH);

  // Franjas de corte del césped.
  ctx.fillStyle = "rgba(255,255,255,0.018)";
  const stripes = 8;
  for (let i = 0; i < stripes; i += 2) {
    ctx.fillRect(pitchX, top + (pitchH / stripes) * i, pitchW, pitchH / stripes);
  }

  // Líneas: perímetro, medio campo, círculo central y las dos áreas.
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(pitchX + 18, top + 18, pitchW - 36, pitchH - 36);

  ctx.beginPath();
  ctx.moveTo(pitchX + 18, top + pitchH / 2);
  ctx.lineTo(pitchX + pitchW - 18, top + pitchH / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pitchX + pitchW / 2, top + pitchH / 2, pitchW * 0.13, 0, Math.PI * 2);
  ctx.stroke();

  const boxW = pitchW * 0.46;
  const boxH = pitchH * 0.14;
  ctx.strokeRect(pitchX + (pitchW - boxW) / 2, top + 18, boxW, boxH);
  ctx.strokeRect(pitchX + (pitchW - boxW) / 2, bottom - 18 - boxH, boxW, boxH);
  ctx.restore();

  // ---- Jugadores ----
  // rows viene de arquero a delantera; se dibuja de abajo hacia arriba.
  const n = data.rows.length;
  const disc = Math.min(54, pitchH / (n * 3.4));
  // Los márgenes salen del tamaño del disco, no de constantes: con 0.9
  // fijo, la etiqueta del arquero se salía de la cancha y chocaba con
  // la línea de suplentes.
  const marginTop = Math.max(0.12, (disc + 30) / pitchH);
  const marginBottom = Math.min(0.88, 1 - (disc * 1.78 + 24) / pitchH);

  data.rows.forEach((row, rowIndex) => {
    const width = Math.max(row.width, row.players.length);
    if (width === 0) return;
    const t =
      n === 1
        ? marginBottom
        : marginBottom - ((marginBottom - marginTop) * rowIndex) / (n - 1);
    const y = top + pitchH * t;

    for (let i = 0; i < width; i++) {
      const player = row.players[i] ?? null;
      const x = pitchX + (pitchW * (i + 1)) / (width + 1);

      // Casilla vacía: se marca con línea punteada para que se note que
      // falta alguien, en vez de correr al resto y mentir la formación.
      if (!player) {
        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(x, y, disc, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
        continue;
      }

      // Disco con el color del equipo.
      ctx.beginPath();
      ctx.arc(x, y, disc, 0, Math.PI * 2);
      ctx.fillStyle = `${accent}33`;
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Iniciales dentro del disco.
      ctx.fillStyle = accent;
      ctx.font = `${Math.round(disc * 0.82)}px ${display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const initials = player.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
      ctx.fillText(initials, x, y + disc * 0.04);
      ctx.textBaseline = "alphabetic";

      // Nombre bajo el disco, con fondo para que se lea sobre el césped.
      const label = etiqueta(player.name).toUpperCase();
      ctx.font = `${Math.round(disc * 0.58)}px ${display}`;
      const wLabel = ctx.measureText(label).width;
      const padX = 12;
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      roundRect(
        ctx,
        x - wLabel / 2 - padX,
        y + disc + 12,
        wLabel + padX * 2,
        disc * 0.78,
        7,
      );
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.textAlign = "center";
      ctx.fillText(label, x, y + disc + 12 + disc * 0.58);

      if (player.isCaptain) {
        ctx.fillStyle = VOLT;
        ctx.font = `${Math.round(disc * 0.44)}px ${display}`;
        ctx.fillText("C", x + disc * 0.86, y - disc * 0.62);
      }
    }
  });

  // Escudo y formación, arriba a la izquierda de la cancha.
  if (crest) {
    drawCrest(ctx, crest, pitchX + 64, top + 60, 76, accent, display,
      data.team.name.slice(0, 1), false);
  }
  ctx.textAlign = "right";
  ctx.font = `44px ${display}`;
  ctx.fillStyle = VOLT;
  ctx.fillText(data.formation, pitchX + pitchW - 34, top + 74);

  // ---- Suplentes ----
  if (data.bench.length > 0) {
    ctx.textAlign = "center";
    ctx.font = `600 24px ${sans}`;
    ctx.fillStyle = MUTED;
    tracked(ctx, "SUPLENTES", L.w / 2, bottom + 42, 5);

    const bench = data.bench.map(etiqueta).join("  ·  ").toUpperCase();
    const size = fitText(ctx, bench, (s) => `${s}px ${display}`, L.w - 160, 34, 18);
    ctx.font = `${size}px ${display}`;
    ctx.fillStyle = "#DEDEDE";
    ctx.fillText(bench, L.w / 2, bottom + 84);
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
  } else if (data.kind === "equipo" || data.kind === "alineacion") {
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
  } else if (data.kind === "alineacion") {
    drawLineupBody(ctx, data, L, crests[0], display, sans);
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
      : data.kind === "equipo" || data.kind === "alineacion"
        ? `-${slug(data.team.name)}`
        : "";
  return `dt-${data.kind}${detail}-${data.format}.png`;
}
