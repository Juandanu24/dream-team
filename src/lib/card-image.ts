"use client";

import { readableAccent } from "@/lib/team-color";

// Dibuja la carta en un canvas para poder descargarla o compartirla.
// Se redibuja a mano en vez de capturar el DOM porque el clip-path, los
// degradados y las fuentes web rompen a las librerías de screenshot.

export interface CardImageData {
  name: string;
  age: number | string;
  positionShort: string;
  footLabel: string;
  memberSince: string;
  photoUrl?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
  crestUrl?: string | null;
  isCaptain?: boolean;
}

const W = 900;
const H = 1400;

// El barrido del logo: azul profundo → cian → aqua → lima → amarillo.
const SWEEP: [number, string][] = [
  [0, "#012D9B"],
  [0.28, "#029CF3"],
  [0.46, "#03E4FA"],
  [0.7, "#A4E405"],
  [1, "#E1F804"],
];

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

// Silueta de la carta, con las puntas superiores y la V inferior.
function cardPath(ctx: CanvasRenderingContext2D, inset: number) {
  const x = inset;
  const y = inset;
  const w = W - inset * 2;
  const h = H - inset * 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.035);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w, y + h * 0.035);
  ctx.lineTo(x + w, y + h * 0.9);
  ctx.lineTo(x + w * 0.5, y + h);
  ctx.lineTo(x, y + h * 0.9);
  ctx.closePath();
}

function fontStack(variable: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return value || fallback;
}

function mix(hex: string, target: string, t: number) {
  const p = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = p(hex);
  const [r2, g2, b2] = p(target);
  const c = (a: number, b: number) =>
    Math.round(a + (b - a) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Achica la fuente hasta que el texto quepa, y solo si aun asi no cabe
 *  recorta con puntos suspensivos. Antes se cortaban letras a lo bruto:
 *  "Carli Cardona" salia como "CARLI CARDON", sin ninguna senal de que
 *  faltaba algo. */
function fitOrTrim(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  if (ctx.measureText(text).width <= maxWidth) return text;

  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

export async function renderCardImage(data: CardImageData): Promise<Blob> {
  await document.fonts.ready;

  const display = fontStack("--font-bebas", "Impact, sans-serif");
  const sans = fontStack("--font-archivo", "system-ui, sans-serif");

  // Tres tonos del color del equipo dan profundidad metálica en vez de
  // un plano liso: claro arriba, base al centro, oscuro abajo.
  const accent = readableAccent(data.teamColor);
  const light = mix(accent, "#ffffff", 0.55);
  const deep = mix(accent, "#000000", 0.45);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");

  // Marco metálico.
  const frame = ctx.createLinearGradient(0, 0, W, H);
  frame.addColorStop(0, light);
  frame.addColorStop(0.35, accent);
  frame.addColorStop(0.7, deep);
  frame.addColorStop(1, accent);
  ctx.fillStyle = frame;
  cardPath(ctx, 0);
  ctx.fill();

  // Interior.
  ctx.save();
  cardPath(ctx, 9);
  ctx.clip();

  const inner = ctx.createLinearGradient(0, 0, 0, H);
  inner.addColorStop(0, mix(deep, "#000000", 0.55));
  inner.addColorStop(0.45, "#0d0f08");
  inner.addColorStop(1, "#07080a");
  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, W, H);

  // Resplandor del color del equipo detrás de la foto.
  const glow = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 520);
  glow.addColorStop(0, `${accent}40`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Banda diagonal sutil, como el corte de las cartas de FIFA.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.52);
  ctx.lineTo(W, H * 0.36);
  ctx.lineTo(W, H * 0.47);
  ctx.lineTo(0, H * 0.63);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.textAlign = "center";

  // ---- Bloque superior izquierdo: posición y pie ----
  ctx.textAlign = "left";
  ctx.fillStyle = light;
  ctx.font = `150px ${display}`;
  ctx.fillText(data.positionShort || "—", 78, 232);

  ctx.fillStyle = `${accent}cc`;
  ctx.fillRect(80, 254, 150, 3);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = `28px ${sans}`;
  ctx.fillText((data.footLabel || "").toUpperCase(), 80, 296);

  // ---- Escudo arriba a la derecha ----
  const crest = data.crestUrl ? await loadImage(data.crestUrl) : null;
  if (crest) {
    ctx.drawImage(crest, W - 250, 105, 170, 170);
  } else {
    const mark = await loadImage("/logo-dt.webp");
    if (mark) {
      const h = 110;
      const w = (mark.width / mark.height) * h;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(mark, W - 90 - w, 130, w, h);
      ctx.globalAlpha = 1;
    }
  }

  // ---- Foto ----
  ctx.textAlign = "center";
  const photoY = 590;
  const radius = 205;

  ctx.save();
  ctx.shadowColor = `${accent}88`;
  ctx.shadowBlur = 45;
  ctx.beginPath();
  ctx.arc(W / 2, photoY, radius + 6, 0, Math.PI * 2);
  ctx.fillStyle = deep;
  ctx.fill();
  ctx.restore();

  const photo = data.photoUrl ? await loadImage(data.photoUrl) : null;
  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, photoY, radius, 0, Math.PI * 2);
    ctx.clip();
    const scale = Math.max(
      (radius * 2) / photo.width,
      (radius * 2) / photo.height,
    );
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    ctx.drawImage(photo, W / 2 - dw / 2, photoY - dh / 2, dw, dh);
    ctx.restore();
  }

  // Aro de la foto, en degradado.
  const ring = ctx.createLinearGradient(0, photoY - radius, 0, photoY + radius);
  ring.addColorStop(0, light);
  ring.addColorStop(1, deep);
  ctx.beginPath();
  ctx.arc(W / 2, photoY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 9;
  ctx.stroke();

  // Banda de capitán.
  if (data.isCaptain) {
    const cx = W / 2 + radius * 0.74;
    const cy = photoY + radius * 0.74;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#07080a";
    ctx.stroke();
    ctx.fillStyle = "#07080a";
    ctx.font = `60px ${display}`;
    ctx.textBaseline = "middle";
    ctx.fillText("C", cx, cy + 3);
    ctx.textBaseline = "alphabetic";
  }

  // ---- Nombre ----
  ctx.fillStyle = "#ffffff";
  const name = fitOrTrim(
    ctx,
    (data.name || "").toUpperCase(),
    display,
    W - 130,
    92,
    52,
  );
  ctx.fillText(name, W / 2, 920);

  // Separador con degradado hacia los bordes.
  const line = ctx.createLinearGradient(W * 0.12, 0, W * 0.88, 0);
  line.addColorStop(0, "transparent");
  line.addColorStop(0.5, accent);
  line.addColorStop(1, "transparent");
  ctx.fillStyle = line;
  ctx.fillRect(W * 0.12, 952, W * 0.76, 3);

  // ---- Datos ----
  const stat = (label: string, value: string, x: number) => {
    ctx.fillStyle = "#ffffff";
    ctx.font = `74px ${display}`;
    let v = value || "—";
    while (ctx.measureText(v).width > W * 0.4 && v.length > 2) {
      v = v.slice(0, -1);
    }
    ctx.fillText(v, x, 1040);
    ctx.fillStyle = `${accent}dd`;
    ctx.font = `26px ${sans}`;
    ctx.fillText(label, x, 1082);
  };
  stat("EDAD", String(data.age ?? ""), W * 0.29);
  stat("EN EL DT", (data.memberSince || "").toUpperCase(), W * 0.71);

  // Divisor vertical entre los dos datos.
  ctx.fillStyle = `${accent}44`;
  ctx.fillRect(W / 2 - 1, 990, 2, 100);

  // ---- Equipo, en banda inferior ----
  if (data.teamName) {
    const band = ctx.createLinearGradient(0, 0, W, 0);
    band.addColorStop(0, "transparent");
    band.addColorStop(0.5, `${accent}33`);
    band.addColorStop(1, "transparent");
    ctx.fillStyle = band;
    ctx.fillRect(0, 1140, W, 86);

    ctx.fillStyle = light;
    const team = fitOrTrim(
      ctx,
      data.teamName.toUpperCase(),
      display,
      W - 140,
      56,
      34,
    );
    ctx.fillText(team, W / 2, 1198);
  }

  // ---- Firma del torneo ----
  const mark = await loadImage("/logo-dt.webp");
  if (mark) {
    const h = 54;
    const w = (mark.width / mark.height) * h;
    ctx.drawImage(mark, W / 2 - w / 2, 1246, w, h);
  }
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.font = `26px ${display}`;
  ctx.fillText("1ER TORNEO AMISTOSO", W / 2, 1330);

  // Barrido del logo cerrando la carta, dentro del marco.
  const sweep = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
  for (const [stop, color] of SWEEP) sweep.addColorStop(stop, color);
  ctx.fillStyle = sweep;
  ctx.fillRect(W * 0.2, 1352, W * 0.6, 5);

  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen")),
      "image/png",
    );
  });
}

export function cardFileName(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `carta-${slug || "dream-team"}.png`;
}
