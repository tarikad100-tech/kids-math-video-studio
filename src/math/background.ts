export type Rect = { x: number; y: number; w: number; h: number };

export type BackgroundPreset =
  | "meadow"
  | "ocean"
  | "space"
  | "rainbow"
  | "forest"
  | "sunset"
  | "candy"
  | "winter"
  | "chalkboard"
  | "pastel"
  | "sketchbook"
  | "wood"
  | "white";

export const BACKGROUND_OPTIONS: ReadonlyArray<readonly [BackgroundPreset, string]> = [
  ["meadow", "Sunny meadow"],
  ["rainbow", "Rainbow sky"],
  ["ocean", "Under the sea"],
  ["space", "Starry space"],
  ["forest", "Green forest"],
  ["sunset", "Warm sunset"],
  ["candy", "Candy land"],
  ["winter", "Snowy winter"],
  ["chalkboard", "Classroom chalkboard"],
  ["pastel", "Pastel art studio"],
  ["sketchbook", "Warm sketchbook"],
  ["wood", "Light wooden drawing desk"],
  ["white", "Clean white paper"],
];

export function isBackgroundPreset(value: unknown): value is BackgroundPreset {
  return BACKGROUND_OPTIONS.some(([id]) => id === value);
}

/** Small deterministic random generator, so every render looks identical. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const SHEET_COLOR: Record<BackgroundPreset, string> = {
  meadow: "#fffefa",
  ocean: "#fffefa",
  space: "#fffdf6",
  rainbow: "#fffefb",
  forest: "#fffefa",
  sunset: "#fffaf3",
  candy: "#fffefc",
  winter: "#ffffff",
  chalkboard: "#fffdf6",
  pastel: "#fffdf8",
  sketchbook: "#fffaf0",
  wood: "#fffdf7",
  white: "#ffffff",
};

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.arc(x, y, s * 0.5, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + s * 0.45, y - s * 0.3, s * 0.45, Math.PI, Math.PI * 2);
  ctx.arc(x + s * 1.0, y - s * 0.1, s * 0.4, Math.PI * 1.2, Math.PI * 2.4);
  ctx.arc(x + s * 1.2, y + s * 0.1, s * 0.4, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  ctx.beginPath();

  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.fill();
}

function drawFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  petal: string,
) {
  ctx.fillStyle = petal;

  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, radius * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

function roundedRectPath(
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

function drawMeadow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: number,
  random: () => number,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#6ec6ff");
  sky.addColorStop(0.6, "#bfe8ff");
  sky.addColorStop(1, "#e9f8ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Sun with a soft glow.
  const sunX = width * 0.84;
  const sunY = base * 0.1;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, base * 0.22);
  glow.addColorStop(0, "rgba(255, 236, 120, 0.9)");
  glow.addColorStop(1, "rgba(255, 236, 120, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - base * 0.25, sunY - base * 0.25, base * 0.5, base * 0.5);
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  ctx.arc(sunX, sunY, base * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  for (let i = 0; i < 4; i++) {
    drawCloud(
      ctx,
      random() * width * 0.8,
      base * (0.06 + random() * 0.14) + (i % 2) * height * 0.1,
      base * (0.07 + random() * 0.05),
    );
  }

  // Two layers of rolling hills at the bottom.
  const hills = [
    { top: height - base * 0.2, color: "#9bdc7f", wave: 0.04 },
    { top: height - base * 0.12, color: "#6cc35a", wave: 0.05 },
  ];

  hills.forEach((hill, index) => {
    ctx.fillStyle = hill.color;
    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let x = 0; x <= width; x += 8) {
      ctx.lineTo(
        x,
        hill.top + Math.sin((x / width) * Math.PI * (2 + index) + index) * base * hill.wave,
      );
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  });

  const petals = ["#ff8fab", "#ffffff", "#ffb347", "#c39bff"];
  for (let i = 0; i < 16; i++) {
    drawFlower(
      ctx,
      random() * width,
      height - base * (0.01 + random() * 0.1),
      base * 0.012,
      petals[i % petals.length],
    );
  }
}

function drawWaves(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  top: number,
  amplitude: number,
  length: number,
  phase: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, height);

  for (let x = 0; x <= width; x += 6) {
    ctx.lineTo(x, top + Math.sin((x / length) * Math.PI * 2 + phase) * amplitude);
  }

  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
}

function drawOcean(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: number,
  random: () => number,
) {
  const water = ctx.createLinearGradient(0, 0, 0, height);
  water.addColorStop(0, "#9be8ff");
  water.addColorStop(0.35, "#4ec0f0");
  water.addColorStop(1, "#1b6fb8");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, width, height);

  // Light rays from the surface.
  ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
  for (let i = 0; i < 5; i++) {
    const x = width * (0.1 + i * 0.2);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + base * 0.12, 0);
    ctx.lineTo(x + base * 0.3, height);
    ctx.lineTo(x - base * 0.05, height);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = Math.max(1.5, base * 0.003);
  for (let i = 0; i < 26; i++) {
    ctx.beginPath();
    ctx.arc(random() * width, random() * height, base * (0.005 + random() * 0.018), 0, Math.PI * 2);
    ctx.stroke();
  }

  drawWaves(ctx, width, height, height - base * 0.15, base * 0.018, width * 0.7, 0, "rgba(255, 224, 160, 0.9)");
  drawWaves(ctx, width, height, height - base * 0.1, base * 0.02, width * 0.55, 2, "rgba(255, 205, 130, 0.95)");

  // Seaweed and shells on the sand.
  ctx.strokeStyle = "#2fb36b";
  ctx.lineWidth = Math.max(3, base * 0.008);
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const x = width * (0.06 + random() * 0.88);
    const y = height - base * 0.07;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - base * 0.03, y - base * 0.04, x + base * 0.03, y - base * 0.07, x, y - base * 0.1);
    ctx.stroke();
  }
}

function drawSpace(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: number,
  random: () => number,
) {
  const sky = ctx.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, "#150f3d");
  sky.addColorStop(0.5, "#352a7a");
  sky.addColorStop(1, "#0c1a4a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  for (const [x, y, color] of [
    [0.2, 0.25, "rgba(255, 105, 180, 0.28)"],
    [0.85, 0.65, "rgba(70, 220, 210, 0.22)"],
  ] as const) {
    const glow = ctx.createRadialGradient(width * x, height * y, 0, width * x, height * y, base * 0.55);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.45 + random() * 0.55;

    if (i % 7 === 0) drawStar(ctx, random() * width, random() * height, base * (0.01 + random() * 0.012));
    else {
      ctx.beginPath();
      ctx.arc(random() * width, random() * height, base * (0.002 + random() * 0.004), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Ringed planet.
  const px = width * 0.8;
  const py = base * 0.075;
  const pr = base * 0.05;
  ctx.fillStyle = "#ffb86b";
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 140, 90, 0.5)";
  ctx.beginPath();
  ctx.arc(px - pr * 0.25, py - pr * 0.2, pr * 0.8, 0.3, 2.4);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 236, 190, 0.9)";
  ctx.lineWidth = Math.max(3, base * 0.01);
  ctx.beginPath();
  ctx.ellipse(px, py, pr * 1.8, pr * 0.5, -0.4, 0, Math.PI * 2);
  ctx.stroke();

  // Moon with craters.
  const mx = width * 0.14;
  const my = height - base * 0.08;
  ctx.fillStyle = "#f4f1e6";
  ctx.beginPath();
  ctx.arc(mx, my, base * 0.065, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(180, 175, 160, 0.55)";
  for (const [dx, dy, r] of [[-0.02, -0.015, 0.014], [0.022, 0.01, 0.01], [-0.005, 0.028, 0.008]] as const) {
    ctx.beginPath();
    ctx.arc(mx + base * dx, my + base * dy, base * r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRainbow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: number,
  random: () => number,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#9fdcff");
  sky.addColorStop(0.7, "#e4f6ff");
  sky.addColorStop(1, "#fff4d6");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const colors = ["#ff6b6b", "#ff9f4a", "#ffd93d", "#6bcf63", "#4dabf7", "#6c63ff", "#b36bff"];
  const cx = width / 2;
  const cy = height * 0.78;
  const band = base * 0.045;
  const outer = Math.min(width * 0.62, height * 0.5);

  ctx.lineWidth = band + 1;
  colors.forEach((color, index) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, outer - index * band, Math.PI, Math.PI * 2);
    ctx.stroke();
  });

  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  drawCloud(ctx, cx - outer - base * 0.06, cy - base * 0.02, base * 0.12);
  drawCloud(ctx, cx + outer - base * 0.12, cy - base * 0.02, base * 0.12);
  for (let i = 0; i < 3; i++) {
    drawCloud(ctx, random() * width * 0.8, base * (0.05 + random() * 0.15), base * (0.06 + random() * 0.04));
  }
}

function drawForest(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: number,
  random: () => number,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#bfeaf5");
  sky.addColorStop(0.6, "#e6f6d8");
  sky.addColorStop(1, "#cbeaa8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 250, 200, 0.5)";
  ctx.beginPath();
  ctx.arc(width * 0.2, base * 0.1, base * 0.07, 0, Math.PI * 2);
  ctx.fill();

  const rows = [
    { y: height - base * 0.16, color: "#7cc576", size: 0.1 },
    { y: height - base * 0.1, color: "#4fa85c", size: 0.12 },
    { y: height - base * 0.04, color: "#2f8a4a", size: 0.14 },
  ];

  for (const row of rows) {
    for (let x = -base * 0.05; x < width + base * 0.05; x += base * row.size * 0.8) {
      const h = base * row.size * (1.1 + random() * 0.6);
      const w = base * row.size * 0.9;
      const baseY = row.y + random() * base * 0.02;

      ctx.fillStyle = "#8a5a35";
      ctx.fillRect(x - w * 0.05, baseY - h * 0.08, w * 0.1, h * 0.12 + base * 0.04);
      ctx.fillStyle = row.color;

      for (let tier = 0; tier < 3; tier++) {
        const tierY = baseY - tier * h * 0.28;
        ctx.beginPath();
        ctx.moveTo(x, tierY - h * 0.45);
        ctx.lineTo(x + w * (0.5 - tier * 0.1), tierY);
        ctx.lineTo(x - w * (0.5 - tier * 0.1), tierY);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  ctx.fillStyle = "#ffe66d";
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(random() * width, random() * height * 0.8, base * 0.004, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSunset(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: number,
  random: () => number,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#6d5bd6");
  sky.addColorStop(0.45, "#ff8fab");
  sky.addColorStop(0.8, "#ffc371");
  sky.addColorStop(1, "#ffe7a3");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 18; i++) {
    ctx.globalAlpha = 0.4 + random() * 0.4;
    ctx.beginPath();
    ctx.arc(random() * width, random() * height * 0.3, base * 0.0035, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const sunY = height - base * 0.06;
  const glow = ctx.createRadialGradient(width / 2, sunY, 0, width / 2, sunY, base * 0.5);
  glow.addColorStop(0, "rgba(255, 244, 170, 0.95)");
  glow.addColorStop(1, "rgba(255, 244, 170, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, sunY - base * 0.5, width, base);
  ctx.fillStyle = "#fff1a8";
  ctx.beginPath();
  ctx.arc(width / 2, sunY, base * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 220, 230, 0.8)";
  drawCloud(ctx, width * 0.08, height * 0.18, base * 0.09);
  drawCloud(ctx, width * 0.62, height * 0.1, base * 0.07);

  drawWaves(ctx, width, height, height - base * 0.1, base * 0.035, width * 0.9, 1, "#7a4a8f");
  drawWaves(ctx, width, height, height - base * 0.05, base * 0.03, width * 0.7, 3, "#4f2d6b");
}

function drawCandy(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: number,
  random: () => number,
) {
  ctx.fillStyle = "#ffd3e6";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  const stripe = base * 0.08;
  for (let x = -height; x < width + height; x += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripe, 0);
    ctx.lineTo(x + stripe + height * 0.5, height);
    ctx.lineTo(x + height * 0.5, height);
    ctx.closePath();
    ctx.fill();
  }

  // Lollipops.
  const swirl = ["#ff6fa5", "#ffd23f", "#6ed3ff", "#9b7bff"];
  const spots: ReadonlyArray<readonly [number, number, number]> = [
    [0.12, 0.1, 0.07],
    [0.88, 0.14, 0.06],
    [0.1, 0.9, 0.06],
    [0.9, 0.86, 0.075],
  ];

  spots.forEach(([fx, fy, fr], index) => {
    const x = width * fx;
    const y = height * fy;
    const r = base * fr;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(4, base * 0.01);
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.lineTo(x, y + r * 3);
    ctx.stroke();

    ctx.fillStyle = swirl[index % swirl.length];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(3, r * 0.2);
    ctx.beginPath();

    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const rr = (a / (Math.PI * 5)) * r * 0.85;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  });

  // Sprinkles.
  const colors = ["#ff6fa5", "#ffd23f", "#6ed3ff", "#9b7bff", "#7bdc8f"];
  for (let i = 0; i < 70; i++) {
    ctx.save();
    ctx.translate(random() * width, random() * height);
    ctx.rotate(random() * Math.PI);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-base * 0.012, -base * 0.003, base * 0.024, base * 0.006);
    ctx.restore();
  }
}

function drawWinter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: number,
  random: () => number,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#bfe0ff");
  sky.addColorStop(0.7, "#eaf6ff");
  sky.addColorStop(1, "#ffffff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Snowy pines in the distance.
  for (let i = 0; i < 7; i++) {
    const x = width * (0.04 + i * 0.15 + random() * 0.04);
    const h = base * (0.14 + random() * 0.08);
    const y = height - base * 0.1;

    ctx.fillStyle = "#6fa7a0";
    for (let tier = 0; tier < 3; tier++) {
      ctx.beginPath();
      ctx.moveTo(x, y - h + tier * h * 0.25);
      ctx.lineTo(x + h * (0.3 + tier * 0.1), y - h * 0.2 + tier * h * 0.1);
      ctx.lineTo(x - h * (0.3 + tier * 0.1), y - h * 0.2 + tier * h * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawWaves(ctx, width, height, height - base * 0.09, base * 0.03, width * 0.9, 0.5, "#e8f3ff");
  drawWaves(ctx, width, height, height - base * 0.045, base * 0.025, width * 0.6, 2.5, "#ffffff");

  // Snowflakes.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = Math.max(1.5, base * 0.0025);
  ctx.lineCap = "round";
  for (let i = 0; i < 42; i++) {
    const x = random() * width;
    const y = random() * height * 0.9;
    const r = base * (0.005 + random() * 0.012);

    if (i % 3 === 0) {
      for (let k = 0; k < 3; k++) {
        const angle = (Math.PI / 3) * k;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(angle) * r * 1.6, y - Math.sin(angle) * r * 1.6);
        ctx.lineTo(x + Math.cos(angle) * r * 1.6, y + Math.sin(angle) * r * 1.6);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawChalkboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: number,
  random: () => number,
) {
  const board = ctx.createRadialGradient(width / 2, height / 2, base * 0.1, width / 2, height / 2, Math.max(width, height) * 0.7);
  board.addColorStop(0, "#3d7364");
  board.addColorStop(1, "#264d41");
  ctx.fillStyle = board;
  ctx.fillRect(0, 0, width, height);

  // Chalk doodles around the edges.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = Math.max(2, base * 0.004);
  ctx.lineCap = "round";

  for (let i = 0; i < 16; i++) {
    const nearTop = i % 2 === 0;
    const x = random() * width;
    const y = nearTop ? random() * base * 0.12 : height - random() * base * 0.12;
    const r = base * (0.015 + random() * 0.02);
    const kind = i % 4;

    if (kind === 0) drawStar(ctx, x, y, r);
    else if (kind === 1) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 2) {
      ctx.beginPath();
      ctx.moveTo(x - r * 2, y);
      ctx.quadraticCurveTo(x - r, y - r, x, y);
      ctx.quadraticCurveTo(x + r, y + r, x + r * 2, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      ctx.stroke();
    }
  }

  // Wooden frame.
  const frame = base * 0.03;
  ctx.strokeStyle = "#a9784a";
  ctx.lineWidth = frame * 2;
  ctx.strokeRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = Math.max(2, base * 0.004);
  ctx.strokeRect(frame * 2, frame * 2, width - frame * 4, height - frame * 4);
}

/**
 * Draws the video background (no text, no UI) and returns the paper sheet the
 * drawing is placed on.
 */
export function createBackground(
  width: number,
  height: number,
  preset: BackgroundPreset,
): { canvas: HTMLCanvasElement; sheet: Rect } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the video canvas.");

  const base = Math.min(width, height);
  const decorated = preset !== "white";
  const side = Math.round(base * (decorated ? 0.09 : 0.04));
  // More room along the long side, where the scenery is.
  const long = Math.round(base * (decorated ? 0.17 : 0.04));
  const marginX = height > width ? side : long;
  const marginY = height > width ? long : side;
  const sheet: Rect = {
    x: marginX,
    y: marginY,
    w: width - marginX * 2,
    h: height - marginY * 2,
  };
  const random = seeded(width * 31 + height * 17 + preset.length);

  const scenes: Partial<
    Record<
      BackgroundPreset,
      (c: CanvasRenderingContext2D, w: number, h: number, b: number, r: () => number) => void
    >
  > = {
    meadow: drawMeadow,
    ocean: drawOcean,
    space: drawSpace,
    rainbow: drawRainbow,
    forest: drawForest,
    sunset: drawSunset,
    candy: drawCandy,
    winter: drawWinter,
    chalkboard: drawChalkboard,
  };
  const scene = scenes[preset];

  if (scene) {
    scene(ctx, width, height, base, random);
  } else if (preset === "white") {
    ctx.fillStyle = "#eef2ef";
    ctx.fillRect(0, 0, width, height);
  } else if (preset === "sketchbook") {
    ctx.fillStyle = "#f1e2c6";
    ctx.fillRect(0, 0, width, height);
  } else if (preset === "pastel") {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#d4f1e4");
    gradient.addColorStop(0.5, "#d6e9fb");
    gradient.addColorStop(1, "#ffe3d3");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const dots = ["#fff3b8", "#ffd9c7", "#c9f0de", "#cfe6ff"];
    ctx.globalAlpha = 0.6;

    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = dots[i % dots.length];
      ctx.beginPath();
      ctx.arc(
        random() * width,
        random() * height,
        base * (0.04 + random() * 0.08),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#ffffff";

    for (let i = 0; i < 18; i++) {
      drawStar(ctx, random() * width, random() * height, base * (0.012 + random() * 0.016));
    }

    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "#d9b98c";
    ctx.fillRect(0, 0, width, height);

    const plank = base * 0.16;
    ctx.strokeStyle = "#b78f60";
    ctx.lineWidth = Math.max(2, base * 0.004);

    for (let y = plank; y < height; y += plank) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(120, 80, 40, 0.12)";
    ctx.lineWidth = Math.max(1, base * 0.0025);

    for (let i = 0; i < 240; i++) {
      const x = random() * width;
      const y = random() * height;
      const length = base * (0.05 + random() * 0.3);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + length / 2, y + (random() - 0.5) * base * 0.01, x + length, y);
      ctx.stroke();
    }

    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      base * 0.3,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(60, 35, 10, 0.25)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  // Paper sheet with rounded corners and a soft shadow.
  const radius = base * 0.025;

  ctx.save();
  ctx.shadowColor = "rgba(40, 50, 70, 0.28)";
  ctx.shadowBlur = base * 0.04;
  ctx.shadowOffsetY = base * 0.012;
  ctx.fillStyle = SHEET_COLOR[preset];
  roundedRectPath(ctx, sheet.x, sheet.y, sheet.w, sheet.h, radius);
  ctx.fill();
  ctx.restore();

  // Very subtle paper grain.
  ctx.save();
  roundedRectPath(ctx, sheet.x, sheet.y, sheet.w, sheet.h, radius);
  ctx.clip();
  ctx.fillStyle = preset === "white" ? "rgba(90, 90, 90, 0.02)" : "rgba(122, 106, 74, 0.04)";
  const grains = Math.min(7000, Math.floor((sheet.w * sheet.h) / 700));

  for (let i = 0; i < grains; i++) {
    ctx.fillRect(
      sheet.x + random() * sheet.w,
      sheet.y + random() * sheet.h,
      1 + random() * 1.5,
      1 + random() * 1.5,
    );
  }

  ctx.restore();

  if (preset === "sketchbook") {
    const spacing = base * 0.06;
    const vertical = height > width;
    const length = vertical ? sheet.w : sheet.h;

    ctx.fillStyle = "#8d8d92";
    ctx.strokeStyle = "#6b6b70";
    ctx.lineWidth = Math.max(2, base * 0.004);

    for (let offset = spacing; offset < length - spacing / 2; offset += spacing) {
      const cx = vertical ? sheet.x + offset : sheet.x;
      const cy = vertical ? sheet.y : sheet.y + offset;

      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        vertical ? base * 0.012 : base * 0.022,
        vertical ? base * 0.022 : base * 0.012,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, base * 0.006, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (preset !== "white") {
    // Washi tape holding the paper at the top corners.
    const tapes = [
      { x: sheet.x + base * 0.02, y: sheet.y + base * 0.02, angle: -0.75, color: "rgba(255, 143, 171, 0.9)" },
      { x: sheet.x + sheet.w - base * 0.02, y: sheet.y + base * 0.02, angle: 0.75, color: "rgba(110, 198, 255, 0.9)" },
    ];

    for (const tape of tapes) {
      ctx.save();
      ctx.translate(tape.x, tape.y);
      ctx.rotate(tape.angle);
      ctx.fillStyle = tape.color;
      ctx.fillRect(-base * 0.1, -base * 0.025, base * 0.2, base * 0.05);
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";

      for (let i = -4; i < 4; i++) {
        ctx.fillRect(i * base * 0.025, -base * 0.025, base * 0.012, base * 0.05);
      }

      ctx.restore();
    }
  }

  return { canvas, sheet };
}
