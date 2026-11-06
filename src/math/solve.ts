import type { Question } from "./questions";

/**
 * Works out the answer of a simple question typed by hand, such as
 * "7 × 8 = ?", "12 ÷ 3 = ?" or "3/4 × 12 = ?". Returns null when the text is
 * not one of these forms or the result is not a whole number.
 */
export function solve(text: string): string | null {
  const clean = text.replace(/\s+/g, "").replace(/[*xX]/g, "×").replace(/=\??$/, "");
  const fraction = /^(\d+)\/(\d+)×(\d+)$/.exec(clean);

  if (fraction) {
    const value = (Number(fraction[1]) * Number(fraction[3])) / Number(fraction[2]);
    return Number.isInteger(value) ? String(value) : null;
  }

  const plain = /^(\d+)([×÷+−-])(\d+)$/.exec(clean);
  if (!plain) return null;

  const a = Number(plain[1]);
  const b = Number(plain[3]);
  let value: number;

  switch (plain[2]) {
    case "×":
      value = a * b;
      break;
    case "÷":
      value = b === 0 ? NaN : a / b;
      break;
    case "+":
      value = a + b;
      break;
    default:
      value = a - b;
  }

  return Number.isInteger(value) ? String(value) : null;
}

/** The pie picture belongs to fraction questions only. */
export function visualFor(text: string): Question["visual"] {
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*[×x*]/.exec(text);
  if (!match) return null;

  const n = Number(match[1]);
  const d = Number(match[2]);

  return d >= 2 && d <= 12 && n >= 1 && n <= d ? { n, d } : null;
}
