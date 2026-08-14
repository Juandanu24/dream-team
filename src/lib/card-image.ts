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
const H = 1260;

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

// Misma silueta que el clip-path de la carta.
function cardPath(ctx: CanvasRenderingContext2D, inset: number) {
  const x = inset;
  const y = inset;
  const w = W - inset * 2;
  const h = H - inset * 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.03);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w, y + h * 0.03);
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

export async function renderCardImage(data: CardImageData): Promise<Blob> {
  await document.fonts.ready;

  const display = fontStack("--font-bebas", "Impact, sans-serif");
  const sans = fontStack("--font-archivo", "system-ui, sans-serif");
  const accent = readableAccent(data.teamColor);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");

  // Marco con el color del equipo.
  const frame = ctx.createLinearGradient(0, 0, 0, H);
  frame.addColorStop(0, accent);
  frame.addColorStop(0.55, `${accent}59`);
  frame.addColorStop(1, `${accent}1a`);
  ctx.fillStyle = frame;
  cardPath(ctx, 0);
  ctx.fill();

  // Interior oscuro.
  ctx.save();
  cardPath(ctx, 7);
  ctx.clip();
  const inner = ctx.createLinearGradient(0, 0, 0, H);
  inner.addColorStop(0, "#1c2205");
  inner.addColorStop(0.5, "#111403");
  inner.addColorStop(1, "#0a0b02");
  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, W, H);

  // Posición y pie.
  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = `120px ${display}`;
  ctx.fillText(data.positionShort || "—", 150, 220);
  ctx.font = `26px ${sans}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText((data.footLabel || "").toUpperCase(), 150, 262);
  ctx.globalAlpha = 1;

  // Escudo o marca.
  const crest = data.crestUrl ? await loadImage(data.crestUrl) : null;
  if (crest) {
    ctx.drawImage(crest, W - 250, 110, 140, 140);
  } else {
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `44px ${display}`;
    ctx.fillText("DREAM", W - 110, 165);
    ctx.fillText("TEAM", W - 110, 210);
    ctx.textAlign = "center";
  }

  // Foto circular.
  const photoY = 480;
  const radius = 165;
  const photo = data.photoUrl ? await loadImage(data.photoUrl) : null;
  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, photoY, radius, 0, Math.PI * 2);
    ctx.clip();
    // Recorte tipo object-cover.
    const scale = Math.max(
      (radius * 2) / photo.width,
      (radius * 2) / photo.height,
    );
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    ctx.drawImage(photo, W / 2 - dw / 2, photoY - dh / 2, dw, dh);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(W / 2, photoY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `${accent}66`;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Banda de capitán.
  if (data.isCaptain) {
    const cx = W / 2 + radius * 0.72;
    const cy = photoY + radius * 0.72;
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#0a0b02";
    ctx.stroke();
    ctx.fillStyle = "#0a0b02";
    ctx.font = `52px ${display}`;
    ctx.textBaseline = "middle";
    ctx.fillText("C", cx, cy + 3);
    ctx.textBaseline = "alphabetic";
  }

  // Nombre.
  ctx.fillStyle = "#fafafa";
  ctx.font = `76px ${display}`;
  let name = (data.name || "").toUpperCase();
  while (ctx.measureText(name).width > W - 120 && name.length > 3) {
    name = name.slice(0, -1);
  }
  ctx.fillText(name, W / 2, 790);

  // Separador.
  ctx.fillStyle = `${accent}66`;
  ctx.fillRect(W * 0.125, 820, W * 0.75, 2);

  // Datos.
  const stat = (label: string, value: string, x: number) => {
    ctx.fillStyle = "#fafafa";
    ctx.font = `62px ${display}`;
    ctx.fillText(value || "—", x, 900);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `24px ${sans}`;
    ctx.fillText(label, x, 940);
  };
  stat("EDAD", String(data.age ?? ""), W * 0.3);
  stat("EN EL DT", data.memberSince || "", W * 0.7);

  // Equipo.
  if (data.teamName) {
    ctx.fillStyle = accent;
    ctx.font = `46px ${display}`;
    ctx.fillText(data.teamName.toUpperCase(), W / 2, 1075);
  }

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
