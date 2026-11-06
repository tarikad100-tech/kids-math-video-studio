/*
 * Question generator. Every answer is calculated by the program, so it is
 * always correct. Questions use only digits and symbols (x, ÷, +, −, a/b), so
 * they are the same in every language.
 */

export type Topic = "multiplication" | "addition" | "subtraction" | "division" | "fractions";

export const TOPICS: ReadonlyArray<readonly [Topic, string]> = [
  ["multiplication", "Multiplication table"],
  ["addition", "Addition"],
  ["subtraction", "Subtraction"],
  ["division", "Simple division"],
  ["fractions", "Simple fractions"],
];

export type Level = "progressive" | "easy" | "medium" | "hard";

export const LEVELS: ReadonlyArray<readonly [Level, string]> = [
  ["progressive", "Gets harder step by step"],
  ["easy", "Easy"],
  ["medium", "Medium"],
  ["hard", "Hard"],
];

export type FractionVisual = { n: number; d: number };

export type Question = {
  id: number;
  /** What is shown, for example "7 × 8 = ?". A fraction like 3/4 is drawn stacked. */
  text: string;
  answer: string;
  visual: FractionVisual | null;
};

export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 20;

export function isTopic(value: unknown): value is Topic {
  return TOPICS.some(([id]) => id === value);
}

export function isLevel(value: unknown): value is Level {
  return LEVELS.some(([id]) => id === value);
}

/** Small deterministic random generator: the same seed gives the same questions. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 4294967296;
  };
}

type Tier = 0 | 1 | 2;

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function between(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

type Draft = { text: string; answer: string; visual: FractionVisual | null };

function multiplication(random: () => number, tier: Tier): Draft {
  const tables: readonly (readonly number[])[] = [[2, 5, 10], [3, 4, 6], [7, 8, 9, 11, 12]];
  const a = pick(random, tables[tier]);
  const b = between(random, tier === 0 ? 2 : 3, tier === 2 ? 12 : 10);

  return random() < 0.5
    ? { text: `${a} × ${b} = ?`, answer: String(a * b), visual: null }
    : { text: `${b} × ${a} = ?`, answer: String(a * b), visual: null };
}

function addition(random: () => number, tier: Tier): Draft {
  const limits = [20, 100, 1000];
  const max = limits[tier];
  const a = between(random, Math.floor(max / 10) + 1, Math.floor(max * 0.75));
  const b = between(random, Math.floor(max / 10) + 1, max - a);

  return { text: `${a} + ${b} = ?`, answer: String(a + b), visual: null };
}

function subtraction(random: () => number, tier: Tier): Draft {
  const limits = [20, 100, 1000];
  const max = limits[tier];
  const a = between(random, Math.floor(max / 2), max);
  const b = between(random, Math.floor(max / 10) + 1, a - 1);

  return { text: `${a} − ${b} = ?`, answer: String(a - b), visual: null };
}

function division(random: () => number, tier: Tier): Draft {
  const divisors: readonly (readonly number[])[] = [[2, 5, 10], [3, 4, 6], [7, 8, 9]];
  const divisor = pick(random, divisors[tier]);
  const result = between(random, 2, tier === 2 ? 12 : 10);

  return { text: `${divisor * result} ÷ ${divisor} = ?`, answer: String(result), visual: null };
}

function fractions(random: () => number, tier: Tier): Draft {
  const denominators: readonly (readonly number[])[] = [[2, 4], [2, 3, 4, 5], [3, 4, 5, 6, 8]];
  const d = pick(random, denominators[tier]);
  const n = tier === 0 ? 1 : between(random, 1, d - 1);
  const unit = between(random, 2, tier === 2 ? 12 : 8);
  const whole = d * unit;

  return {
    text: `${n}/${d} × ${whole} = ?`,
    answer: String(n * unit),
    visual: { n, d },
  };
}

const MAKERS: Record<Topic, (random: () => number, tier: Tier) => Draft> = {
  multiplication,
  addition,
  subtraction,
  division,
  fractions,
};

function tierFor(level: Level, index: number, count: number): Tier {
  if (level === "easy") return 0;
  if (level === "medium") return 1;
  if (level === "hard") return 2;

  const progress = count <= 1 ? 0 : index / (count - 1);

  return progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2;
}

export type GenerateOptions = {
  topics: readonly Topic[];
  level: Level;
  count: number;
  seed: number;
};

/** Questions that get harder, mix the chosen topics, and never repeat. */
export function generateQuestions({ topics, level, count, seed }: GenerateOptions): Question[] {
  const chosen = topics.length > 0 ? topics : (["addition"] as const);
  const total = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, count));
  const random = seeded(seed * 2654435761 + 12345);
  const seen = new Set<string>();
  const questions: Question[] = [];

  for (let index = 0; index < total; index++) {
    const tier = tierFor(level, index, total);
    let draft: Draft | null = null;

    for (let attempt = 0; attempt < 40 && draft === null; attempt++) {
      // Topics take turns, so a short video still covers all of them.
      const topic =
        attempt < 20 ? chosen[(index + Math.floor(random() * 2)) % chosen.length] : pick(random, chosen);
      const candidate = MAKERS[topic](random, tier);

      if (!seen.has(candidate.text)) draft = candidate;
    }

    const final = draft ?? MAKERS[chosen[0]](random, tier);
    seen.add(final.text);
    questions.push({ id: index + 1, ...final });
  }

  return questions;
}

/** Splits "3/4 × 12 = ?" into plain text and fractions, so fractions can be drawn stacked. */
export type Token = { kind: "text"; value: string } | { kind: "fraction"; n: string; d: string };

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(\d+)\/(\d+)/g;
  let last = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > last) tokens.push({ kind: "text", value: text.slice(last, match.index) });
    tokens.push({ kind: "fraction", n: match[1], d: match[2] });
    last = match.index + match[0].length;
    match = pattern.exec(text);
  }

  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });

  return tokens;
}
