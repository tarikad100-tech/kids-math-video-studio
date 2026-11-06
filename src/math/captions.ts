/*
 * Text cards for the video: the title at the start and the thank-you message at
 * the end. Each card is rendered once into a small canvas (same idea as the
 * channel badge), then copied onto the frames with a fade.
 */

export type Caption = { canvas: HTMLCanvasElement; x: number; y: number };

export const MAX_CAPTION_LENGTH = 70;

const FONT_FAMILY = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);

  return lines.slice(0, 3);
}

/**
 * A rounded white card with bold text, centered on `centerX` and placed with its
 * vertical center at `centerY`. `fontScale` is relative to the video's short side.
 */
export function createCaption(
  text: string,
  centerX: number,
  centerY: number,
  maxWidth: number,
  base: number,
  fontScale: number,
  accent: string,
): Caption | null {
  const label = text.trim().slice(0, MAX_CAPTION_LENGTH);
  if (!label) return null;

  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;

  const fontSize = Math.round(base * fontScale);
  const padX = Math.round(fontSize * 0.9);
  const padY = Math.round(fontSize * 0.6);
  const shadow = Math.round(fontSize * 0.5);

  probe.font = `800 ${fontSize}px ${FONT_FAMILY}`;
  const lines = wrap(probe, label, maxWidth - padX * 2);
  const textWidth = Math.ceil(Math.max(...lines.map((line) => probe.measureText(line).width)));
  const lineHeight = Math.round(fontSize * 1.2);

  const cardW = textWidth + padX * 2;
  const cardH = lines.length * lineHeight + padY * 2;
  const canvas = document.createElement("canvas");
  canvas.width = cardW + shadow * 2;
  canvas.height = cardH + shadow * 2;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const radius = Math.min(cardH / 2, fontSize * 0.9);

  ctx.save();
  ctx.shadowColor = "rgba(30, 40, 60, 0.3)";
  ctx.shadowBlur = shadow * 0.8;
  ctx.shadowOffsetY = shadow * 0.2;
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.beginPath();
  ctx.roundRect(shadow, shadow, cardW, cardH, radius);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(3, fontSize * 0.12);
  ctx.beginPath();
  ctx.roundRect(shadow, shadow, cardW, cardH, radius);
  ctx.stroke();

  ctx.fillStyle = "#1f2d3d";
  ctx.font = `800 ${fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      canvas.width / 2,
      shadow + padY + lineHeight * index + lineHeight / 2,
    );
  });

  return {
    canvas,
    x: Math.round(centerX - canvas.width / 2),
    y: Math.round(centerY - canvas.height / 2),
  };
}
