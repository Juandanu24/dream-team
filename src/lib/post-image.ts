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
  | "asistencias"
  | "equipo"
  | "penales"
  | "alineacion"
  | "duelo";

export type PieceFormat = "feed" | "story";

export interface TeamSide {
  name: string;
  color: string | null;
  crestUrl?: string | null;
  score?: number | null;
}

/** Encuadre de la foto dentro de su panel. `x`/`y` van de -1 a 1 y se
 *  miden sobre el sobrante que deja el recorte, así que nunca destapan
 *  un borde vacío por más que se muevan. */
export interface DueloFoto {
  photoUrl?: string | null;
  /** Nombre en letra de brocha, blanco sobre transparente. Se tiñe con
   *  el color del equipo, así el archivo no se rehace si cambia. */
  nameImageUrl?: string | null;
  photoZoom?: number;
  photoX?: number;
  photoY?: number;
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
  players: (
    | { name: string; photoUrl?: string | null; isCaptain?: boolean }
    | null
  )[];
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
}

/** Las piezas que se dibujan con el marco común llevan encabezado. El
 *  duelo no: va a sangre, con las fotos ocupando todo el lienzo, así que
 *  pedirle un eyebrow sería un campo muerto que nadie lee. */
interface ConMarco {
  /** "SEMANA 1 · FASE DE GRUPOS" */
  eyebrow: string;
  /** "HOY JUGAMOS", "TABLA DE POSICIONES" */
  headline: string;
}

export type PostImageData = Common &
  (
    | (ConMarco & {
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
      })
    | (ConMarco & { kind: "posiciones"; rows: StandingLite[] })
    | (ConMarco & {
        kind: "goleadores" | "asistencias" | "penales";
        rows: RankLite[];
        unit: string;
        /** "+4 más con 1 gol", cuando el corte parte un empate. */
        footnote?: string;
      })
    | (ConMarco & {
        kind: "equipo";
        team: TeamSide;
        captain?: string;
        players: string[];
      })
    | {
        kind: "duelo";
        home: TeamSide & DueloFoto;
        away: TeamSide & DueloFoto;
        /** "CANCHA F8 · MONTERÍA" o el marcador si ya se jugó. */
        footer: string;
        /** Marco generado con IA que se superpone a las fotos. Viene en
         *  blanco y negro y se tiñe por equipo, así una sola plantilla
         *  sirve para los seis cruces del torneo. */
        overlayUrl?: string | null;
      }
    | (ConMarco & {
        kind: "alineacion";
        team: TeamSide;
        formation: string;
        /** De arquero a delantera; se dibuja de abajo hacia arriba. */
        rows: LineupRow[];
        bench: string[];
      })
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

export type Layout = Omit<(typeof LAYOUT)[PieceFormat], "w" | "h"> & {
  w: number;
  /** El duelo con marco lo calcula desde la proporción del PNG, así que
   *  no puede ser uno de los dos literales de LAYOUT. */
  h: number;
};

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
  data: PostImageData & ConMarco,
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
  data: Extract<PostImageData, { kind: "goleadores" | "asistencias" | "penales" }>,
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
  /** Fotos ya cargadas, por URL: varios jugadores pueden no tener. */
  fotos: Map<string, HTMLImageElement | null>,
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

      // La foto manda; las iniciales son el respaldo de quien no tiene.
      const foto = player.photoUrl ? (fotos.get(player.photoUrl) ?? null) : null;

      if (foto) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, disc, 0, Math.PI * 2);
        ctx.clip();
        // Recorte tipo "cover": la cara llena el disco sin deformarse.
        const escala = Math.max((disc * 2) / foto.width, (disc * 2) / foto.height);
        const w = foto.width * escala;
        const h = foto.height * escala;
        ctx.drawImage(foto, x - w / 2, y - h / 2, w, h);
        ctx.restore();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, disc, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, disc, 0, Math.PI * 2);
        ctx.fillStyle = `${accent}33`;
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        ctx.stroke();

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
      }

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
  const fotosPorUrl = new Map<string, HTMLImageElement | null>();

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

    if (data.kind === "alineacion") {
      // Una carga por URL: dos jugadores podrían compartir foto y no
      // tiene sentido bajarla dos veces.
      const urls = [
        ...new Set(
          data.rows
            .flatMap((r) => r.players)
            .map((p) => p?.photoUrl)
            .filter((u): u is string => Boolean(u)),
        ),
      ];
      const cargadas = await Promise.all(urls.map((u) => loadImage(u)));
      urls.forEach((u, i) => fotosPorUrl.set(u, cargadas[i]));
    }
  } else if (
    data.kind === "goleadores" ||
    data.kind === "asistencias" ||
    data.kind === "penales"
  ) {
    photos = await Promise.all(
      data.rows.map((r) => (r.photoUrl ? loadImage(r.photoUrl) : null)),
    );
    glows = [{ x: L.w * 0.5, color: data.kind === "penales" ? BLUE : VOLT }];
  }

  if (data.kind === "duelo") {
    // El duelo va a sangre: sin encabezado ni barras, la foto manda.
    const [fh, fa, ch, ca, marco, nh, na] = await Promise.all([
      data.home.photoUrl ? loadImage(data.home.photoUrl) : null,
      data.away.photoUrl ? loadImage(data.away.photoUrl) : null,
      data.home.crestUrl ? loadImage(data.home.crestUrl) : null,
      data.away.crestUrl ? loadImage(data.away.crestUrl) : null,
      data.overlayUrl ? loadImage(data.overlayUrl) : null,
      data.home.nameImageUrl ? loadImage(data.home.nameImageUrl) : null,
      data.away.nameImageUrl ? loadImage(data.away.nameImageUrl) : null,
    ]);

    if (marco) {
      // La composición del marco se arma en su propia proporción y luego
      // se monta DENTRO del marco de la marca, que aporta las barras del
      // barrido y un pie con el logo y los datos del partido. Antes la
      // foto llegaba hasta el borde y se comía la barra inferior del
      // marco generado, y la pieza salía sin logo ni info.
      const pieAlto = 168;
      const total = 1620;
      const areaAlto = total - pieAlto - 34;
      const areaAncho = Math.round((areaAlto * marco.width) / marco.height);
      const LD: Layout = { ...L, w: areaAncho, h: areaAlto };

      const dentro = document.createElement("canvas");
      dentro.width = areaAncho;
      dentro.height = areaAlto;
      const dctx = dentro.getContext("2d");
      if (dctx) {
        drawDueloConMarco(dctx, data, LD, [fh, fa], [ch, ca], marco, [nh, na], display);
      }

      canvas.height = total;
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, L.w, total);
      ctx.drawImage(dentro, Math.round((L.w - areaAncho) / 2), 22, areaAncho, areaAlto);

      // Barras del barrido, arriba y abajo de todo.
      ctx.fillStyle = sweepGradient(ctx, 0, L.w);
      ctx.fillRect(0, 0, L.w, 12);
      ctx.fillRect(0, total - 12, L.w, 12);

      // Pie: monograma y datos del partido.
      if (logo) {
        const h = 62;
        const w = (logo.width / logo.height) * h;
        ctx.drawImage(logo, L.w / 2 - w / 2, total - pieAlto + 14, w, h);
      }
      ctx.textAlign = "center";
      ctx.font = `600 26px ${sans}`;
      ctx.fillStyle = VOLT;
      tracked(ctx, data.footer.toUpperCase(), L.w / 2, total - 62, 5);
      ctx.font = `500 22px ${sans}`;
      ctx.fillStyle = "#8A8A8A";
      tracked(ctx, "DREAMTEAMCOLOMBIA.VERCEL.APP", L.w / 2, total - 30, 3);
    } else {
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, L.w, L.h);
      ctx.fillStyle = sweepGradient(ctx, 0, L.w);
      ctx.fillRect(0, 0, L.w, 12);
      ctx.fillRect(0, L.h - 12, L.w, 12);
      drawDueloBody(ctx, data, L, [fh, fa], [ch, ca], logo, display, sans);
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo exportar la pieza"))),
        "image/png",
      );
    });
  }

  drawChrome(ctx, data, L, logo, display, sans, glows);

  if (data.kind === "anuncio" || data.kind === "resultado") {
    drawMatchBody(ctx, data, L, [crests[0], crests[1]], display, sans);
  } else if (data.kind === "posiciones") {
    drawStandingsBody(ctx, data, L, crests, display, sans);
  } else if (data.kind === "equipo") {
    drawTeamBody(ctx, data, L, crests[0], display, sans);
  } else if (data.kind === "alineacion") {
    drawLineupBody(ctx, data, L, crests[0], fotosPorUrl, display, sans);
  } else if (
    data.kind === "goleadores" ||
    data.kind === "asistencias" ||
    data.kind === "penales"
  ) {
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
      : data.kind === "duelo"
        ? `-${slug(data.home.name)}-vs-${slug(data.away.name)}`
        : data.kind === "equipo" || data.kind === "alineacion"
        ? `-${slug(data.team.name)}`
        : "";
  return `dt-${data.kind}${detail}-${data.format}.png`;
}

// ── Carta de jugador como pieza de Instagram ────────────────────────

/** La carta FIFA mide 900×1400 y el feed pide 1080×1350. En un carrusel
 *  todas las diapositivas comparten la proporción de la primera, así que
 *  la carta se monta sobre el lienzo de marca en vez de subirse suelta:
 *  de lo contrario Instagram la recorta y le come la cabeza al jugador. */
export async function renderPlayerPost(
  cardBlob: Blob,
  teamColor: string | null,
  /** Con encabezado la carta se achica y sube; sin él ocupa todo. Es lo
   *  que separa "una carta más del equipo" de "la figura del partido". */
  titulo?: { eyebrow: string; headline: string; format?: PieceFormat },
): Promise<Blob> {
  await document.fonts.ready;

  const sans = fontStack("--font-archivo", "system-ui, sans-serif");
  const L = LAYOUT[titulo?.format ?? "feed"];
  const accent = readableAccent(teamColor);

  const canvas = document.createElement("canvas");
  canvas.width = L.w;
  canvas.height = L.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");

  const url = URL.createObjectURL(cardBlob);
  try {
    const carta = await loadImage(url);

    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, L.w, L.h);

    // Resplandor del color del equipo detrás de la carta.
    const g = ctx.createRadialGradient(L.w / 2, L.h * 0.44, 80, L.w / 2, L.h * 0.44, L.h * 0.5);
    g.addColorStop(0, `${accent}2E`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.w, L.h);

    ctx.fillStyle = sweepGradient(ctx, 0, L.w);
    ctx.fillRect(0, 0, L.w, 12);
    ctx.fillRect(0, L.h - 12, L.w, 12);

    const display = fontStack("--font-bebas", "Impact, sans-serif");
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // La carta se estira hasta llenar lo que quede libre, así el mismo
    // código sirve para feed y para story sin números escritos a mano.
    const pieAlto = 90;
    let cartaTop = 70;

    if (titulo) {
      const eyebrowY = L.eyebrowY;
      ctx.fillStyle = BLUE;
      ctx.font = `600 26px ${sans}`;
      tracked(ctx, titulo.eyebrow.toUpperCase(), L.w / 2, eyebrowY, 5);

      const encabezado = titulo.headline.toUpperCase();
      const tam = fitText(ctx, encabezado, (v) => `${v}px ${display}`, L.w - 140, 96, 52);
      ctx.font = `${tam}px ${display}`;
      ctx.fillStyle = VOLT;
      ctx.fillText(encabezado, L.w / 2, eyebrowY + 88);

      ctx.fillStyle = VOLT;
      ctx.fillRect(L.w / 2 - 60, eyebrowY + 114, 120, 5);

      cartaTop = eyebrowY + 150;
    }

    // Además de la altura libre, la carta no puede pasarse de ancho.
    const altoDisponible = L.h - cartaTop - pieAlto;
    const razon = carta ? carta.width / carta.height : 900 / 1400;
    const cartaAlto = Math.min(altoDisponible, (L.w - 120) / razon);

    if (carta) {
      const ancho = razon * cartaAlto;
      // Centrada en la banda libre, no pegada arriba.
      const y = cartaTop + (altoDisponible - cartaAlto) / 2;
      ctx.drawImage(carta, L.w / 2 - ancho / 2, y, ancho, cartaAlto);
    }

    ctx.textAlign = "center";
    ctx.font = `500 24px ${sans}`;
    ctx.fillStyle = "#8A8A8A";
    tracked(ctx, "DREAMTEAMCOLOMBIA.VERCEL.APP", L.w / 2, L.h - 42, 3);
  } finally {
    URL.revokeObjectURL(url);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo exportar la carta"))),
      "image/png",
    );
  });
}

// ── Duelo: las dos fotos de equipo enfrentadas ──────────────────────

/** Tiñe un marco blanco y negro con el color de cada equipo y lo deja
 *  listo para mezclarse en "screen".
 *
 *  Multiplicar solo puede oscurecer, que es justo lo que se quiere: el
 *  humo blanco se vuelve del color del equipo y el negro se queda negro
 *  —y en "screen" el negro es invisible, así que las fotos de abajo
 *  aparecen solas sin necesidad de recortar nada a mano. */
/** Pinta una imagen blanca con un color, conservando su alfa. */
function tintarImagen(
  img: HTMLImageElement,
  ancho: number,
  alto: number,
  color: string,
): HTMLCanvasElement | null {
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(ancho);
  lienzo.height = Math.round(alto);
  const c = lienzo.getContext("2d");
  if (!c) return null;
  c.drawImage(img, 0, 0, ancho, alto);
  // source-in pinta solo donde ya hay tinta, así que el trazo de brocha
  // conserva su textura y sus bordes rotos.
  c.globalCompositeOperation = "source-in";
  c.fillStyle = color;
  c.fillRect(0, 0, ancho, alto);
  return lienzo;
}

function tintarMarco(
  marco: HTMLImageElement,
  L: Layout,
  seam: number,
  colorArriba: string,
  colorAbajo: string,
): HTMLCanvasElement | null {
  const lienzo = document.createElement("canvas");
  lienzo.width = L.w;
  lienzo.height = L.h;
  const c = lienzo.getContext("2d");
  if (!c) return null;

  c.drawImage(marco, 0, 0, L.w, L.h);

  c.globalCompositeOperation = "multiply";
  for (const [color, y0, y1] of [
    [colorArriba, 0, seam],
    [colorAbajo, seam, L.h],
  ] as const) {
    c.save();
    c.beginPath();
    c.rect(0, y0, L.w, y1 - y0);
    c.clip();
    c.fillStyle = color;
    c.fillRect(0, y0, L.w, y1 - y0);
    c.restore();
  }

  // El multiply apaga bastante; se recupera brillo con un screen del
  // propio marco, que devuelve los blancos puros de las luces.
  c.globalCompositeOperation = "screen";
  c.globalAlpha = 0.35;
  c.drawImage(marco, 0, 0, L.w, L.h);
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";

  return lienzo;
}

/** Panel con las esquinas cortadas en diagonal, tipo cartel de esports.
 *  Es lo que separa "una foto pegada" de "una pieza". */
function panelDiagonal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  corte: number,
  invertido: boolean,
) {
  ctx.beginPath();
  if (invertido) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - corte, y);
    ctx.lineTo(x + w, y + corte);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + corte, y + h);
    ctx.lineTo(x, y + h - corte);
  } else {
    ctx.moveTo(x + corte, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - corte);
    ctx.lineTo(x + w - corte, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + corte);
  }
  ctx.closePath();
}

// Dónde caen los dos huecos negros del marco generado, en fracción del
// alto. Se miden sobre el PNG real; si se cambia el marco hay que
// volver a medirlos.
// Medidos sobre el PNG real analizando el brillo fila por fila. Si se
// cambia el marco, hay que volver a medirlos.
const HUECO = {
  // A sangre: la foto va de borde a borde y el marco le cae ENCIMA en
  // "screen", así el humo, los cristales y las luces quedan sobre ella.
  // Metida y achicada se leía flotando sobre el degradado, que era el
  // problema: el inset no hacía falta, porque los brillos del marco se
  // superponen igual.
  // Las fotos casi se tocan en la costura y llegan hasta arriba y abajo:
  // con más separación quedaban bandas negras planas, que era lo único
  // que delataba el montaje.
  arribaY0: 0.022,
  arribaY1: 0.478,
  abajoY0: 0.488,
  abajoY1: 0.962,
  costura: 0.482,
  margenX: 0,
} as const;

/** Duelo con marco generado: las fotos van DEBAJO y el marco encima en
 *  "screen", que vuelve invisible su negro. Así no hay que recortar los
 *  paneles a mano ni acertar los píxeles del marco. */
function drawDueloConMarco(
  ctx: CanvasRenderingContext2D,
  data: Extract<PostImageData, { kind: "duelo" }>,
  L: Layout,
  fotos: [HTMLImageElement | null, HTMLImageElement | null],
  crests: [HTMLImageElement | null, HTMLImageElement | null],
  marco: HTMLImageElement,
  nombres: [HTMLImageElement | null, HTMLImageElement | null],
  display: string,
) {
  const x0 = L.w * HUECO.margenX;
  const ancho = L.w - x0 * 2;
  const seam = L.h * HUECO.costura;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, L.w, L.h);

  // ---- Fotos en sus huecos ----
  const huecos = [
    { side: data.home, foto: fotos[0], y: L.h * HUECO.arribaY0, alto: L.h * (HUECO.arribaY1 - HUECO.arribaY0) },
    { side: data.away, foto: fotos[1], y: L.h * HUECO.abajoY0, alto: L.h * (HUECO.abajoY1 - HUECO.abajoY0) },
  ];

  for (const { side, foto, y, alto } of huecos) {
    if (!foto) continue;

    // La foto se arma aparte para poder desvanecerle los bordes. Dibujada
    // directo salía con borde recto y duro, y se leía como una calcomanía
    // pegada encima del marco en vez de estar dentro de la escena.
    const capa = document.createElement("canvas");
    capa.width = Math.round(ancho);
    capa.height = Math.round(alto);
    const c = capa.getContext("2d");
    if (!c) continue;

    const zoom = Math.max(1, side.photoZoom ?? 1);
    const escala = Math.max(ancho / foto.width, alto / foto.height) * zoom;
    const w = foto.width * escala;
    const h = foto.height * escala;
    const sobraX = Math.max(0, w - ancho) / 2;
    const sobraY = Math.max(0, h - alto) / 2;
    c.drawImage(
      foto,
      ancho / 2 - w / 2 + (side.photoX ?? 0) * sobraX,
      alto / 2 - h / 2 + (side.photoY ?? 0) * sobraY,
      w,
      h,
    );

    // Solo se desvanecen arriba y abajo: a los lados la foto se sale del
    // lienzo, así que no hay borde que disimular.
    c.globalCompositeOperation = "destination-out";
    const fx = 0;
    const fy = alto * 0.12;
    const borde = (
      x: number,
      yy: number,
      bw: number,
      bh: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
    ) => {
      const g = c.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(x, yy, bw, bh);
    };
    if (fx > 0) {
      borde(0, 0, fx, alto, 0, 0, fx, 0);
      borde(ancho - fx, 0, fx, alto, ancho, 0, ancho - fx, 0);
    }
    borde(0, 0, ancho, fy, 0, 0, 0, fy);
    borde(0, alto - fy, ancho, fy, 0, alto, 0, alto - fy);
    c.globalCompositeOperation = "source-over";

    ctx.drawImage(capa, x0, y, ancho, alto);
  }

  // ---- El marco encima, teñido por equipo ----
  const tenido = tintarMarco(
    marco,
    L,
    seam,
    readableAccent(data.home.color),
    readableAccent(data.away.color),
  );
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(tenido ?? marco, 0, 0, L.w, L.h);
  ctx.globalCompositeOperation = "source-over";

  // ---- Nombres con su escudo ----
  //
  // El de arriba va [escudo][nombre] y el de abajo [nombre][escudo]: el
  // escudo queda siempre del lado de afuera, como en los carteles de
  // enfrentamiento, y los dos bloques se espejan.
  for (const [i, { side, crest, nombreImg }] of [
    { side: data.home, crest: crests[0], nombreImg: nombres[0] },
    { side: data.away, crest: crests[1], nombreImg: nombres[1] },
  ].entries()) {
    const accent = readableAccent(side.color);
    const nombre = side.name.toUpperCase();
    const arriba = i === 0;
    // Solo hasta antes del VS, que va centrado: los nombres quedan a la
    // altura de la costura y con el ancho completo se le metían debajo.
    const anchoDisponible = L.w * 0.47;
    const hueco = 22;

    // El escudo pesa más que antes: es la identidad del equipo y a 1.15
    // del tamaño de letra se perdía.
    const razonEscudo = 2.8;

    let tam = 82;
    let ladoEscudo = 0;
    for (; tam >= 30; tam -= 2) {
      ladoEscudo = crest ? tam * razonEscudo : 0;
      ctx.font = `${tam}px ${display}`;
      // El skew ensancha el texto, así que se descuenta al medir.
      const anchoTexto = ctx.measureText(nombre).width + tam * 0.22;
      if (anchoTexto + ladoEscudo + (crest ? hueco : 0) <= anchoDisponible) break;
    }
    ctx.font = `${tam}px ${display}`;
    const anchoEscudo = crest ? (crest.width / crest.height) * ladoEscudo : 0;

    // Con imagen de brocha, el alto manda y el ancho sale de su
    // proporción; el ajuste de tamaño de letra ya no aplica.
    const altoNombre = nombreImg ? tam * 1.9 : 0;
    const anchoTexto = nombreImg
      ? (nombreImg.width / nombreImg.height) * altoNombre
      : ctx.measureText(nombre).width + tam * 0.22;
    const anchoGrupo = anchoEscudo + (crest ? hueco : 0) + anchoTexto;

    const nombreY = arriba
      ? L.h * HUECO.arribaY1 - 26
      : L.h * HUECO.abajoY1 - 26;
    const inicioX = arriba ? 60 : L.w - 60 - anchoGrupo;

    // Orden espejado según la mitad.
    const escudoX = arriba ? inicioX : inicioX + anchoTexto + hueco;
    const textoX = arriba ? inicioX + anchoEscudo + (crest ? hueco : 0) : inicioX;

    if (crest) {
      ctx.drawImage(
        crest,
        escudoX,
        nombreY - ladoEscudo * 0.78,
        anchoEscudo,
        ladoEscudo,
      );
    }

    // Inclinación tipo cartel deportivo: le da el empuje que a Bebas
    // recta le falta. Se hace con transform porque canvas no tiene
    // cursiva sintética.
    if (nombreImg) {
      const tenidoNombre = tintarImagen(nombreImg, anchoTexto, altoNombre, PAPER);
      const y = nombreY - altoNombre * 0.82;
      // Sombra por detrás para que despegue de la foto.
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 18;
      ctx.drawImage(tenidoNombre ?? nombreImg, textoX, y, anchoTexto, altoNombre);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(textoX, nombreY);
      ctx.transform(1, 0, -0.16, 1, 0, 0);
      ctx.textAlign = "left";
      ctx.lineJoin = "round";
      ctx.lineWidth = 11;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(nombre, 0, 0);
      ctx.lineWidth = 3;
      ctx.strokeStyle = accent;
      ctx.strokeText(nombre, 0, 0);
      ctx.fillStyle = PAPER;
      ctx.fillText(nombre, 0, 0);
      ctx.restore();
    }

    ctx.fillStyle = accent;
    ctx.fillRect(inicioX, nombreY + 20, anchoGrupo, 6);
  }

}

function drawDueloBody(
  ctx: CanvasRenderingContext2D,
  data: Extract<PostImageData, { kind: "duelo" }>,
  L: Layout,
  fotos: [HTMLImageElement | null, HTMLImageElement | null],
  crests: [HTMLImageElement | null, HTMLImageElement | null],
  logo: HTMLImageElement | null,
  display: string,
  sans: string,
) {
  const margen = 40;
  const corte = 56;
  const ancho = L.w - margen * 2;

  // El logo arriba, y el pie abajo: entre los dos queda la banda de los
  // paneles, que se reparte en dos mitades con el VS al medio.
  const logoAlto = 96;
  const logoY = 34;
  const pieY = L.h - 96;
  const bandaTop = logoY + logoAlto + 28;
  const bandaAlto = pieY - 40 - bandaTop;
  const panelAlto = (bandaAlto - 26) / 2;

  if (logo) {
    const w = (logo.width / logo.height) * logoAlto;
    ctx.drawImage(logo, L.w / 2 - w / 2, logoY, w, logoAlto);
  }

  const lados = [
    {
      side: data.home,
      foto: fotos[0],
      crest: crests[0],
      y: bandaTop,
      invertido: false,
    },
    {
      side: data.away,
      foto: fotos[1],
      crest: crests[1],
      y: bandaTop + panelAlto + 26,
      invertido: true,
    },
  ];

  for (const { side, foto, crest, y, invertido } of lados) {
    const accent = readableAccent(side.color);

    ctx.save();
    panelDiagonal(ctx, margen, y, ancho, panelAlto, corte, invertido);
    ctx.clip();

    if (foto) {
      // Recorte "cover" más el encuadre que eligió el admin: en una foto
      // de grupo vertical, el recorte automático suele cortar cabezas.
      const zoom = Math.max(1, side.photoZoom ?? 1);
      const escala = Math.max(ancho / foto.width, panelAlto / foto.height) * zoom;
      const w = foto.width * escala;
      const h = foto.height * escala;
      // El desplazamiento se mide sobre el sobrante, no en píxeles: así
      // el extremo del control es justo el borde de la foto.
      const sobraX = Math.max(0, w - ancho) / 2;
      const sobraY = Math.max(0, h - panelAlto) / 2;
      const dx = L.w / 2 - w / 2 + (side.photoX ?? 0) * sobraX;
      const dy = y + panelAlto / 2 - h / 2 + (side.photoY ?? 0) * sobraY;
      ctx.drawImage(foto, dx, dy, w, h);
    } else {
      ctx.fillStyle = "#141414";
      ctx.fillRect(margen, y, ancho, panelAlto);
    }

    // Velo hacia abajo, para que el nombre se lea sobre cualquier foto.
    const velo = ctx.createLinearGradient(0, y + panelAlto * 0.35, 0, y + panelAlto);
    velo.addColorStop(0, "transparent");
    velo.addColorStop(1, "rgba(0,0,0,0.82)");
    ctx.fillStyle = velo;
    ctx.fillRect(margen, y, ancho, panelAlto);

    // Tinte del color del equipo desde su borde.
    const tinte = ctx.createLinearGradient(
      invertido ? L.w : 0,
      0,
      invertido ? 0 : L.w,
      0,
    );
    tinte.addColorStop(0, `${accent}3A`);
    tinte.addColorStop(0.6, "transparent");
    ctx.fillStyle = tinte;
    ctx.fillRect(margen, y, ancho, panelAlto);
    ctx.restore();

    // Marco del color del equipo.
    panelDiagonal(ctx, margen, y, ancho, panelAlto, corte, invertido);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Nombre y escudo, alineados hacia el lado del corte.
    //
    // El de arriba va MÁS SEPARADO del borde inferior que el de abajo: el
    // VS se dibuja justo en la costura entre los dos paneles y, con la
    // misma separación, se le montaba encima.
    // El escudo va PEGADO al nombre, a su misma altura: [escudo] [nombre],
    // como un lockup. Antes iba suelto en la esquina opuesta y se leían
    // como dos cosas sin relación.
    const nombre = side.name.toUpperCase();
    const margenTexto = margen + 40;
    const anchoDisponible = ancho - 80;

    // Se mide el escudo contra el tamaño de letra, así que hay que
    // resolver los dos juntos: se prueba el tamaño y se descuenta.
    let tam = 64;
    let anchoEscudo = 0;
    const hueco = 20;
    for (; tam >= 32; tam -= 2) {
      anchoEscudo = crest ? (crest.width / crest.height) * (tam * 1.15) : 0;
      ctx.font = `${tam}px ${display}`;
      if (
        ctx.measureText(nombre).width + anchoEscudo + (crest ? hueco : 0) <=
        anchoDisponible
      ) {
        break;
      }
    }
    ctx.font = `${tam}px ${display}`;
    const anchoTexto = ctx.measureText(nombre).width;
    const anchoGrupo = anchoEscudo + (crest ? hueco : 0) + anchoTexto;

    const nombreY = y + panelAlto - (invertido ? 44 : 104);
    const inicioX = invertido
      ? L.w - margenTexto - anchoGrupo
      : margenTexto;

    if (crest) {
      const alto = tam * 1.15;
      ctx.drawImage(crest, inicioX, nombreY - alto * 0.82, anchoEscudo, alto);
    }

    // Contorno oscuro y relleno claro: se lee sobre cualquier foto.
    ctx.textAlign = "left";
    ctx.lineJoin = "round";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.78)";
    const textoX = inicioX + anchoEscudo + (crest ? hueco : 0);
    ctx.strokeText(nombre, textoX, nombreY);
    ctx.fillStyle = PAPER;
    ctx.fillText(nombre, textoX, nombreY);

    // Subrayado del color del equipo, bajo todo el conjunto.
    ctx.fillStyle = accent;
    ctx.fillRect(inicioX, nombreY + 16, anchoGrupo, 5);
  }

  // VS en el corte entre los dos paneles.
  const vsY = bandaTop + panelAlto + 13;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `120px ${display}`;
  ctx.lineWidth = 12;
  ctx.strokeStyle = INK;
  ctx.strokeText("VS", L.w / 2, vsY);
  ctx.fillStyle = PAPER;
  ctx.fillText("VS", L.w / 2, vsY);
  ctx.textBaseline = "alphabetic";

  // Pie con el barrido de marca a los lados.
  ctx.textAlign = "center";
  ctx.font = `600 26px ${sans}`;
  ctx.fillStyle = VOLT;
  tracked(ctx, data.footer.toUpperCase(), L.w / 2, pieY, 5);

  ctx.font = `500 22px ${sans}`;
  ctx.fillStyle = "#8A8A8A";
  tracked(ctx, "DREAMTEAMCOLOMBIA.VERCEL.APP", L.w / 2, pieY + 38, 3);
}
