/*
 * One deterministic schedule for the whole video: intro, then for every
 * question "appear -> countdown -> reveal", then the ending. The preview, the
 * sound effects and the export all read this same schedule.
 */

export const INTRO_MS = 2800;
export const APPEAR_MS = 700;
export const REVEAL_MS = 2600;
export const OUTRO_MS = 4000;

export const MIN_SECONDS = 3;
export const MAX_SECONDS = 15;

export type QuestionSlot = {
  start: number;
  /** The countdown starts when the question has finished appearing. */
  countStart: number;
  revealStart: number;
  end: number;
};

export type MathTimeline = {
  slots: QuestionSlot[];
  seconds: number;
  outroStart: number;
  totalMs: number;
};

export function buildTimeline(count: number, seconds: number): MathTimeline {
  const secs = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(seconds)));
  const slots: QuestionSlot[] = [];
  let cursor = INTRO_MS;

  for (let i = 0; i < count; i++) {
    const countStart = cursor + APPEAR_MS;
    const revealStart = countStart + secs * 1000;
    const end = revealStart + REVEAL_MS;

    slots.push({ start: cursor, countStart, revealStart, end });
    cursor = end;
  }

  return { slots, seconds: secs, outroStart: cursor, totalMs: cursor + OUTRO_MS };
}

export type Moment =
  | { phase: "intro"; t: number }
  | {
      phase: "question";
      index: number;
      /** 0 to 1 while the question appears, then 1. */
      appear: number;
      /** Seconds left, as a smooth number (5.0 down to 0). Equal to `seconds` before the countdown. */
      remaining: number;
      /** 0 to 1 across the reveal; 0 before it. */
      reveal: number;
      /** Milliseconds since the reveal began (0 before it). */
      sinceReveal: number;
      /** Milliseconds since the question started. */
      sinceStart: number;
    }
  | { phase: "outro"; t: number };

export function locate(timeline: MathTimeline, timeMs: number): Moment {
  const t = Math.min(Math.max(0, timeMs), timeline.totalMs);

  if (t < INTRO_MS || timeline.slots.length === 0) return { phase: "intro", t };
  if (t >= timeline.outroStart) return { phase: "outro", t: t - timeline.outroStart };

  let index = timeline.slots.findIndex((slot) => t < slot.end);
  if (index < 0) index = timeline.slots.length - 1;

  const slot = timeline.slots[index];
  const remaining = Math.min(
    timeline.seconds,
    Math.max(0, (slot.revealStart - Math.max(t, slot.countStart)) / 1000),
  );

  return {
    phase: "question",
    index,
    appear: Math.min(1, (t - slot.start) / APPEAR_MS),
    remaining,
    reveal: t >= slot.revealStart ? Math.min(1, (t - slot.revealStart) / REVEAL_MS) : 0,
    sinceReveal: Math.max(0, t - slot.revealStart),
    sinceStart: t - slot.start,
  };
}
