/*
 * "Mimo", an original little round character drawn with code. It has a few
 * moods so it can wait, think, cheer and celebrate. Nothing here is copied
 * from an existing character.
 */

export type Mood = "idle" | "think" | "happy" | "cheer";

const OUTLINE = "#c9672a";

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number) {
  ctx.beginPath();

  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2 + rotation;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
}

/**
 * Draws Mimo standing on the ground at (x, groundY). `size` is the body width
 * and `timeMs` drives the small idle animation.
 */
export function drawMascot(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  size: number,
  mood: Mood,
  timeMs: number,
) {
  const t = timeMs / 1000;
  const jump = mood === "cheer" ? Math.abs(Math.sin(t * 6)) * size * 0.16 : Math.abs(Math.sin(t * 2.2)) * size * 0.025;
  const squash = 1 + (mood === "cheer" ? 0.03 * Math.sin(t * 12) : 0.012 * Math.sin(t * 4.4));
  const bodyW = size;
  const bodyH = size * 0.95;
  const cy = groundY - size * 0.16 - bodyH / 2 - jump;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, size * 0.028);
  ctx.strokeStyle = OUTLINE;

  // Ground shadow.
  ctx.save();
  ctx.globalAlpha = 0.18 - jump / size;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(x, groundY, size * 0.42, size * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Feet.
  ctx.fillStyle = "#ff9248";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * size * 0.22, groundY - size * 0.06 - jump * 0.3, size * 0.14, size * 0.085, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Antenna with a star.
  const sway = Math.sin(t * 3) * size * 0.05;
  const topY = cy - (bodyH / 2) * squash;
  ctx.beginPath();
  ctx.moveTo(x, topY + size * 0.02);
  ctx.quadraticCurveTo(x + sway, topY - size * 0.18, x + sway * 1.4, topY - size * 0.3);
  ctx.stroke();
  ctx.fillStyle = "#ffd23f";
  star(ctx, x + sway * 1.4, topY - size * 0.36, size * 0.1, Math.sin(t * 2) * 0.3);
  ctx.fill();
  ctx.stroke();

  // Arms behind the body.
  const armLift = mood === "cheer" ? -1.1 + Math.sin(t * 12) * 0.25 : mood === "happy" ? -0.7 : mood === "think" ? -0.25 : 0.25 + Math.sin(t * 2) * 0.05;
  ctx.fillStyle = "#ff9248";
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(x + side * bodyW * 0.47, cy + size * 0.05);
    ctx.rotate(side * -armLift - side * 0.1);
    ctx.beginPath();
    ctx.ellipse(side * size * 0.07, size * 0.12, size * 0.09, size * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Body.
  const body = ctx.createLinearGradient(x, cy - bodyH / 2, x, cy + bodyH / 2);
  body.addColorStop(0, "#ffc766");
  body.addColorStop(1, "#ff8c42");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, cy, (bodyW / 2) * (2 - squash), (bodyH / 2) * squash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Light belly.
  ctx.fillStyle = "rgba(255, 244, 214, 0.9)";
  ctx.beginPath();
  ctx.ellipse(x, cy + size * 0.25, size * 0.25, size * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks.
  ctx.fillStyle = "rgba(255, 105, 135, 0.55)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * size * 0.3, cy + size * 0.1, size * 0.07, size * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes.
  const eyeY = cy - size * 0.08;
  const eyeX = size * 0.17;

  if (mood === "happy" || mood === "cheer") {
    ctx.strokeStyle = "#3a2418";
    ctx.lineWidth = Math.max(3, size * 0.045);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + side * eyeX, eyeY + size * 0.03, size * 0.07, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    const blink = mood === "idle" && Math.sin(t * 1.3) > 0.985;

    for (const side of [-1, 1]) {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = Math.max(2, size * 0.02);
      ctx.beginPath();
      ctx.ellipse(x + side * eyeX, eyeY, size * 0.1, blink ? size * 0.015 : size * 0.115, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (!blink) {
        const lookX = mood === "think" ? size * 0.035 : 0;
        const lookY = mood === "think" ? -size * 0.05 : size * 0.01;
        ctx.fillStyle = "#2b1a12";
        ctx.beginPath();
        ctx.arc(x + side * eyeX + lookX, eyeY + lookY, size * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + side * eyeX + lookX + size * 0.015, eyeY + lookY - size * 0.02, size * 0.015, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Mouth.
  const mouthY = cy + size * 0.12;
  ctx.strokeStyle = "#3a2418";
  ctx.lineWidth = Math.max(3, size * 0.035);

  if (mood === "happy" || mood === "cheer") {
    ctx.fillStyle = "#7a2230";
    ctx.beginPath();
    ctx.moveTo(x - size * 0.13, mouthY - size * 0.02);
    ctx.quadraticCurveTo(x, mouthY + size * 0.2, x + size * 0.13, mouthY - size * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff7b8f";
    ctx.beginPath();
    ctx.ellipse(x, mouthY + size * 0.07, size * 0.06, size * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === "think") {
    ctx.beginPath();
    ctx.ellipse(x + size * 0.04, mouthY + size * 0.01, size * 0.035, size * 0.03, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x, mouthY - size * 0.02, size * 0.08, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }

  ctx.restore();
}
