import { createBackground, type BackgroundPreset, type Rect } from "./background";
import type { Badge } from "./badge";
import { createCaption, type Caption } from "./captions";
import { questionLabel, type Texts } from "./i18n";
import { drawMascot, type Mood } from "./mascot";
import { tokenize, type Question } from "./questions";
import { locate, type MathTimeline } from "./timeline";

/*
 * One renderer for the live preview and the export: drawFrame(ctx, timeMs)
 * paints the exact picture for that moment. The static parts (background,
 * title cards, badge) are made once; only the moving parts are drawn per frame.
 */

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif';

export type MathRendererOptions = {
  width: number;
  height: number;
  questions: Question[];
  timeline: MathTimeline;
  texts: Texts;
  background: BackgroundPreset;
  badge: Badge | null;
  titleText: string;
  outroText: string;
  showMascot: boolean;
};

export type MathRenderer = {
  width: number;
  height: number;
  timeline: MathTimeline;
  drawFrame: (ctx: CanvasRenderingContext2D, timeMs: number) => void;
};

const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function ringColor(fraction: number): string {
  if (fraction > 0.5) return "#2fb26a";
  if (fraction > 0.25) return "#f2b01e";
  return "#e5484d";
}

function pie(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, d: number) {
  const step = (Math.PI * 2) / d;

  for (let i = 0; i < d; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2 + i * step, -Math.PI / 2 + (i + 1) * step);
    ctx.closePath();
    ctx.fillStyle = i < n ? "#ff8c42" : "#fff1dc";
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.strokeStyle = "#c9672a";
    ctx.stroke();
  }
}

type Piece = { width: number; draw: (x: number, baseline: number, color: string) => void };

function measureTokens(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  colorOverride?: string,
): Piece[] {
  const pieces: Piece[] = [];
  ctx.font = `800 ${size}px ${FONT}`;

  for (const token of tokenize(text)) {
    if (token.kind === "text") {
      const width = ctx.measureText(token.value).width;
      const value = token.value;
      pieces.push({
        width,
        draw: (x, baseline, color) => {
          ctx.font = `800 ${size}px ${FONT}`;
          ctx.fillStyle = colorOverride ?? color;
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(value, x, baseline);
        },
      });
    } else {
      const small = size * 0.72;
      ctx.font = `800 ${small}px ${FONT}`;
      const width = Math.max(ctx.measureText(token.n).width, ctx.measureText(token.d).width) + size * 0.3;
      const { n, d } = token;
      pieces.push({
        width,
        draw: (x, baseline, color) => {
          ctx.font = `800 ${small}px ${FONT}`;
          ctx.fillStyle = colorOverride ?? color;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          const mid = baseline - size * 0.3;
          ctx.fillText(n, x + width / 2, mid - size * 0.1);
          ctx.fillText(d, x + width / 2, mid + small * 0.82);
          ctx.fillRect(x + size * 0.05, mid - size * 0.03, width - size * 0.1, Math.max(3, size * 0.06));
        },
      });
    }
  }

  return pieces;
}

export function createMathRenderer(options: MathRendererOptions): MathRenderer {
  const { width, height, questions, timeline, texts, badge, showMascot } = options;
  const base = Math.min(width, height);
  const portrait = height > width;
  const { canvas: backdrop, sheet } = createBackground(width, height, options.background);

  const card: Rect = {
    x: sheet.x,
    y: sheet.y,
    w: sheet.w,
    h: sheet.h,
  };
  const cx = card.x + card.w / 2;

  // Layout of the question screen.
  const eqArea: Rect = portrait
    ? { x: card.x + card.w * 0.05, y: card.y + card.h * 0.17, w: card.w * 0.9, h: card.h * 0.3 }
    : { x: card.x + card.w * 0.04, y: card.y + card.h * 0.2, w: card.w * 0.56, h: card.h * 0.55 };
  const ring = portrait
    ? { x: cx, y: card.y + card.h * 0.55, r: Math.min(card.w * 0.16, card.h * 0.095) }
    : { x: card.x + card.w * 0.8, y: card.y + card.h * 0.3, r: Math.min(card.w * 0.1, card.h * 0.16) };
  const mascot = portrait
    ? { x: cx, y: card.y + card.h * 0.95, size: Math.min(card.w * 0.28, card.h * 0.17) }
    : { x: card.x + card.w * 0.8, y: card.y + card.h * 0.93, size: Math.min(card.w * 0.15, card.h * 0.24) };

  const titleCaption: Caption | null = createCaption(
    options.titleText || texts.title,
    cx,
    card.y + card.h * (portrait ? 0.34 : 0.36),
    card.w * 0.86,
    base,
    portrait ? 0.062 : 0.07,
    "#ff8c42",
  );
  const outroCaption: Caption | null = createCaption(
    options.outroText || texts.outro,
    cx,
    card.y + card.h * (portrait ? 0.34 : 0.36),
    card.w * 0.86,
    base,
    portrait ? 0.062 : 0.07,
    "#2fb26a",
  );

  // Header pill ("Question 3 of 10") per question, made lazily and cached.
  const headerCache = new Map<number, HTMLCanvasElement>();

  function header(index: number): HTMLCanvasElement {
    const cached = headerCache.get(index);
    if (cached) return cached;

    const label = questionLabel(texts, index + 1, questions.length);
    const size = Math.round(base * 0.045);
    const probe = document.createElement("canvas").getContext("2d");
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (!probe || !ctx) return c;

    probe.font = `800 ${size}px ${FONT}`;
    const textW = Math.ceil(probe.measureText(label).width);
    const padX = size * 0.9;
    const padY = size * 0.45;
    c.width = Math.ceil(textW + padX * 2);
    c.height = Math.ceil(size + padY * 2);
    ctx.fillStyle = "#ff8c42";
    ctx.beginPath();
    ctx.roundRect(0, 0, c.width, c.height, c.height / 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = texts.rtl ? "rtl" : "ltr";
    ctx.fillText(label, c.width / 2, c.height / 2 + size * 0.04);
    headerCache.set(index, c);

    return c;
  }

  function drawCard(ctx: CanvasRenderingContext2D, alpha: number) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(40, 30, 10, 0.25)";
    ctx.shadowBlur = base * 0.03;
    ctx.shadowOffsetY = base * 0.01;
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.roundRect(card.x, card.y, card.w, card.h, base * 0.04);
    ctx.fill();
    ctx.restore();
  }

  function drawEquation(
    ctx: CanvasRenderingContext2D,
    question: Question,
    area: Rect,
    revealed: boolean,
    pop: number,
    timeMs: number,
  ) {
    const prefix = question.text.replace(/\?\s*$/, "");
    const answerText = String(question.answer);
    let size = Math.min(base * 0.16, area.h * 0.8);
    let pieces = measureTokens(ctx, prefix, size);
    const shown = revealed ? answerText : "?";
    const slot = (s: number) => {
      ctx.font = `800 ${s}px ${FONT}`;
      return Math.max(ctx.measureText("?").width, ctx.measureText(answerText).width);
    };
    let total = pieces.reduce((sum, p) => sum + p.width, 0) + slot(size);

    if (total > area.w) {
      size *= area.w / total;
      pieces = measureTokens(ctx, prefix, size);
      total = pieces.reduce((sum, p) => sum + p.width, 0) + slot(size);
    }

    ctx.save();
    ctx.direction = "ltr";
    ctx.lineJoin = "round";
    let x = area.x + (area.w - total) / 2;
    const baseline = area.y + area.h / 2 + size * 0.36;

    for (const piece of pieces) {
      piece.draw(x, baseline, "#2d3a4a");
      x += piece.width;
    }

    const answerW = slot(size);
    ctx.translate(x + answerW / 2, baseline - size * 0.34);
    const scale = revealed ? 0.6 + 0.4 * easeOutBack(pop) : 1 + Math.sin(timeMs / 260) * 0.05;
    ctx.scale(scale, scale);
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    if (revealed) {
      ctx.fillStyle = "#ffe9b8";
      ctx.beginPath();
      ctx.roundRect(-answerW * 0.62, -size * 0.78, answerW * 1.24, size * 1.2, size * 0.25);
      ctx.fill();
    }

    ctx.fillStyle = revealed ? "#1f9a57" : "#ff8c42";
    ctx.fillText(shown, 0, size * 0.34);
    ctx.restore();
  }

  function drawRing(
    ctx: CanvasRenderingContext2D,
    remaining: number,
    seconds: number,
    revealed: boolean,
    pop: number,
  ) {
    const { x, y, r } = ring;
    const line = r * 0.22;
    const fraction = clamp01(remaining / seconds);

    ctx.save();
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = line;
    ctx.strokeStyle = "#efe6d2";
    ctx.stroke();

    if (revealed) {
      const s = 0.7 + 0.3 * easeOutBack(pop);
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = "#2fb26a";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, r * 0.02);
      ctx.lineTo(-r * 0.1, r * 0.34);
      ctx.lineTo(r * 0.46, -r * 0.3);
      ctx.lineWidth = r * 0.24;
      ctx.strokeStyle = "#ffffff";
      ctx.lineJoin = "round";
      ctx.stroke();
    } else {
      if (fraction > 0.001) {
        ctx.beginPath();
        ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
        ctx.strokeStyle = ringColor(fraction);
        ctx.stroke();
      }

      const whole = Math.ceil(remaining - 1e-6);
      const phase = remaining - Math.floor(remaining - 1e-6) - 1;
      const bump = remaining > 0 && remaining < seconds ? 1 + 0.18 * clamp01(1 + phase * 4) : 1;
      ctx.translate(x, y);
      ctx.scale(bump, bump);
      ctx.fillStyle = ringColor(fraction);
      ctx.font = `900 ${r * 1.0}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(Math.max(0, whole)), 0, r * 0.05);
    }

    ctx.restore();
  }

  function drawConfetti(ctx: CanvasRenderingContext2D, since: number) {
    if (since <= 0 || since > 2400) return;

    const colors = ["#ff8c42", "#ffd23f", "#2fb26a", "#4aa8ff", "#ff6b9a", "#9b6bff"];
    const t = since / 1000;
    const originX = ring.x;
    const originY = ring.y;
    ctx.save();
    ctx.globalAlpha = clamp01((2.4 - t) / 0.8);

    for (let i = 0; i < 46; i++) {
      const a = ((i * 137.5) % 360) * (Math.PI / 180);
      const speed = base * (0.35 + ((i * 53) % 40) / 100);
      const px = originX + Math.cos(a) * speed * t * 0.9;
      const py = originY - Math.abs(Math.sin(a)) * speed * t * 1.1 + base * 0.7 * t * t;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + t * (3 + (i % 5)));
      ctx.fillStyle = colors[i % colors.length];
      const s = base * 0.014 * (1 + (i % 3) * 0.4);
      ctx.fillRect(-s, -s * 0.5, s * 2, s);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawBadge(ctx: CanvasRenderingContext2D) {
    if (badge) ctx.drawImage(badge.canvas, badge.x, badge.y);
  }

  function centeredText(
    ctx: CanvasRenderingContext2D,
    text: string,
    y: number,
    size: number,
    color: string,
    alpha: number,
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = texts.rtl ? "rtl" : "ltr";
    ctx.fillText(text, cx, y, card.w * 0.9);
    ctx.restore();
  }

  function drawTitleScreen(
    ctx: CanvasRenderingContext2D,
    caption: Caption | null,
    sub: string,
    t: number,
    mood: Mood,
    timeMs: number,
    color: string,
  ) {
    const alpha = clamp01(t / 400);
    const slide = (1 - easeOutBack(clamp01(t / 700))) * base * 0.08;

    if (caption) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(caption.canvas, caption.x, caption.y + slide);
      ctx.restore();
    }

    centeredText(ctx, sub, card.y + card.h * (portrait ? 0.52 : 0.5), base * 0.04, color, clamp01((t - 300) / 500));

    if (showMascot) {
      const size = Math.min(card.w * 0.34, card.h * (portrait ? 0.26 : 0.22));
      drawMascot(ctx, cx, card.y + card.h * 0.93, size, mood, timeMs);
    }
  }

  function drawFrame(ctx: CanvasRenderingContext2D, timeMs: number) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(backdrop, 0, 0);
    drawCard(ctx, 1);

    const moment = locate(timeline, timeMs);

    if (moment.phase === "intro") {
      drawTitleScreen(ctx, titleCaption, texts.subtitle, moment.t, "cheer", timeMs, "#6b5a3c");
    } else if (moment.phase === "outro") {
      drawTitleScreen(ctx, outroCaption, texts.outroSub, moment.t, "cheer", timeMs, "#6b5a3c");
    } else {
      const question = questions[moment.index];
      const revealed = moment.reveal > 0 || moment.sinceReveal > 0;
      const pop = clamp01(moment.sinceReveal / 500);
      const enter = easeOutBack(clamp01(moment.appear));
      const fade = clamp01(moment.appear * 1.5);
      const outFade = revealed ? clamp01((timeline.slots[moment.index].end - timeMs) / 300) : 1;

      ctx.save();
      ctx.globalAlpha = Math.min(fade, outFade);

      const pill = header(moment.index);
      ctx.drawImage(pill, cx - pill.width / 2, card.y + card.h * 0.06 - (1 - enter) * base * 0.05);

      const area: Rect = { ...eqArea, y: eqArea.y + (1 - enter) * base * 0.06 };

      if (question.visual) {
        const r = Math.min(area.h * 0.5, base * 0.1);
        const pieX = portrait ? area.x + area.w / 2 : area.x + area.w / 2;
        pie(ctx, pieX, area.y - r * 0.1, r, question.visual.n, question.visual.d);
        area.y += r * 1.0;
      }

      drawEquation(ctx, question, area, revealed, pop, timeMs);
      drawRing(ctx, moment.remaining, timeline.seconds, revealed, pop);
      ctx.restore();

      if (revealed) drawConfetti(ctx, moment.sinceReveal);

      if (showMascot) {
        const mood: Mood = revealed ? (moment.sinceReveal < 1800 ? "cheer" : "happy") : moment.sinceStart < 900 ? "idle" : "think";
        drawMascot(ctx, mascot.x, mascot.y, mascot.size, mood, timeMs);
      }
    }

    drawBadge(ctx);
    ctx.restore();
  }

  return { width, height, timeline, drawFrame };
}
