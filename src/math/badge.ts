/*
 * The channel badge (profile picture + account name) drawn in a corner of the
 * video, like on professional channels. It is rendered once into its own small
 * canvas and then copied onto every frame, so it costs almost nothing per frame.
 */

export type BadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const BADGE_POSITIONS: ReadonlyArray<readonly [BadgePosition, string]> = [
  ["top-left", "Top left"],
  ["top-right", "Top right"],
  ["bottom-left", "Bottom left"],
  ["bottom-right", "Bottom right"],
];

export function isBadgePosition(value: unknown): value is BadgePosition {
  return BADGE_POSITIONS.some(([id]) => id === value);
}

export const MAX_BADGE_NAME = 30;

export type Badge = {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
};

const FONT_FAMILY = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif';

/** Draws `image` into a circle of diameter `d`, cropped from the center so it is never stretched. */
function drawAvatar(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  cx: number,
  cy: number,
  d: number,
  name: string,
) {
  const r = d / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, sx, sy, side, side, cx - r, cy - r, d, d);
  } else {
    // No picture: a colored circle with the first letter.
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(cx - r, cy - r, d, d);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${d * 0.5}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((name.trim()[0] ?? "?").toUpperCase(), cx, cy + d * 0.02);
  }

  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, d * 0.05);
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.restore();
}

export function createBadge(
  width: number,
  height: number,
  name: string,
  image: HTMLImageElement | null,
  position: BadgePosition,
): Badge | null {
  const label = name.trim().slice(0, MAX_BADGE_NAME);
  if (!label) return null;

  const base = Math.min(width, height);
  const d = Math.round(base * 0.085);
  const pad = Math.round(d * 0.14);
  const fontSize = Math.round(d * 0.4);
  const gap = Math.round(d * 0.22);
  const shadow = Math.round(d * 0.25);

  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;

  probe.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  const textWidth = Math.ceil(probe.measureText(label).width);

  const pillW = pad + d + gap + textWidth + Math.round(d * 0.45);
  const pillH = d + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = pillW + shadow * 2;
  canvas.height = pillH + shadow * 2;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Soft white pill with a gentle shadow.
  ctx.save();
  ctx.shadowColor = "rgba(30, 40, 60, 0.28)";
  ctx.shadowBlur = shadow * 0.9;
  ctx.shadowOffsetY = shadow * 0.25;
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.beginPath();
  ctx.roundRect(shadow, shadow, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.restore();

  drawAvatar(ctx, image, shadow + pad + d / 2, shadow + pillH / 2, d, label);

  ctx.fillStyle = "#1f2d3d";
  ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, shadow + pad + d + gap, shadow + pillH / 2 + fontSize * 0.04);

  // Safe margins keep the badge away from the edges and from app buttons.
  const marginX = Math.round(base * 0.045);
  const marginTop = Math.round(height * (height > width ? 0.06 : 0.045));
  const marginBottom = Math.round(height * (height > width ? 0.12 : 0.05));
  const left = position.endsWith("left");
  const top = position.startsWith("top");

  return {
    canvas,
    x: left ? marginX - shadow : width - marginX - pillW - shadow,
    y: top ? marginTop - shadow : height - marginBottom - pillH - shadow,
  };
}
