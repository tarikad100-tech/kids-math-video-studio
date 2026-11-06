import { startMusic } from "./music";
import type { MathTimeline } from "../math/timeline";

/*
 * The whole soundtrack of the video as ONE audio buffer: the background music
 * plus the sound effects (tick-tock, answer chime, ending jingle). The live
 * preview plays this buffer and the export encodes it, so they always match.
 */

const RATE = 44100;

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

type Out = { ctx: OfflineAudioContext; out: AudioNode };

function tone(
  { ctx, out }: Out,
  start: number,
  midi: number,
  duration: number,
  peak: number,
  type: OscillatorType = "sine",
) {
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = midiToFrequency(midi);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(out);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** A soft wood-block "tok" for the clock. */
function tick(target: Out, start: number, high: boolean) {
  tone(target, start, high ? 88 : 81, 0.09, high ? 0.32 : 0.22, "triangle");
  tone(target, start, high ? 100 : 93, 0.05, 0.1, "sine");
}

/** A happy two-note bell for the answer. */
function chime(target: Out, start: number) {
  tone(target, start, 84, 0.9, 0.22);
  tone(target, start + 0.12, 88, 0.9, 0.22);
  tone(target, start + 0.24, 91, 1.2, 0.24);
}

function whoosh(target: Out, start: number) {
  tone(target, start, 72, 0.18, 0.08, "sine");
  tone(target, start + 0.05, 79, 0.16, 0.06, "sine");
}

function jingle(target: Out, start: number) {
  const notes = [72, 76, 79, 84, 79, 84, 88];
  notes.forEach((note, index) => {
    tone(target, start + index * 0.13, note, 0.5, 0.2);
    tone(target, start + index * 0.13, note - 12, 0.4, 0.07, "triangle");
  });
}

export type SoundtrackOptions = {
  timeline: MathTimeline;
  music: AudioBuffer | null;
  musicVolume: number;
  effects: boolean;
};

export async function buildSoundtrack({
  timeline,
  music,
  musicVolume,
  effects,
}: SoundtrackOptions): Promise<AudioBuffer> {
  const durationSec = timeline.totalMs / 1000;
  const ctx = new OfflineAudioContext(2, Math.ceil(durationSec * RATE), RATE);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  const target: Out = { ctx, out: master };

  if (music) {
    startMusic(ctx, master, music, { volume: musicVolume, durationSec, offsetSec: 0 });
  }

  if (effects) {
    whoosh(target, 0.3);
    timeline.slots.forEach((slot) => {
      whoosh(target, slot.start / 1000);

      for (let step = 0; step < timeline.seconds; step++) {
        const left = timeline.seconds - step;
        tick(target, slot.countStart / 1000 + step, left <= 3);
      }

      chime(target, slot.revealStart / 1000);
    });
    jingle(target, timeline.outroStart / 1000 + 0.2);
  }

  return ctx.startRendering();
}
