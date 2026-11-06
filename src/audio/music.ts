/*
 * Background music, all local:
 *  - three original kids-style tunes synthesized with the Web Audio API
 *    (drums, bouncy bass, marimba, bells; no audio files),
 *  - or an audio file the user imports.
 * The same AudioBuffer is used by the live preview and the exported video.
 *
 * These tunes are written for this app in the playful style of children's pop.
 * They are NOT any existing song (famous kids' songs are copyrighted), and
 * they are still simple synthesized music. For a richer sound, import a
 * royalty-free track you have the rights to use.
 */

export type MusicTrackId =
  | "bouncy"
  | "marimba"
  | "musicbox"
  | "sunny"
  | "adventure"
  | "dance"
  | "lullaby"
  | "piano"
  | "magic";

export const GENERATED_TRACKS: ReadonlyArray<readonly [MusicTrackId, string]> = [
  ["bouncy", "Bouncy kids pop (original)"],
  ["sunny", "Sunny ukulele day (original)"],
  ["dance", "Kids dance party (original)"],
  ["adventure", "Little adventure (original)"],
  ["marimba", "Playful marimba (original)"],
  ["magic", "Magic sparkle (original)"],
  ["musicbox", "Sweet music box (original)"],
  ["piano", "Soft piano (original)"],
  ["lullaby", "Calm lullaby (original)"],
];

export function isMusicTrackId(value: unknown): value is MusicTrackId {
  return GENERATED_TRACKS.some(([id]) => id === value);
}

export type MusicSource =
  | { kind: "generated"; id: MusicTrackId }
  | { kind: "file"; file: File };

export type MusicPlayback = { stop: () => void };

const SAMPLE_RATE = 44100;
const BARS = 16;
export const MAX_AUDIO_FILE_BYTES = 25 * 1024 * 1024;
const FADE_IN_SECONDS = 1.2;
const FADE_OUT_SECONDS = 2.5;

type Chord = { root: number; triad: readonly number[] };
type Lead = "marimba" | "bell" | "pluck" | "piano" | "flute";

const C_MAJOR: readonly Chord[] = [
  { root: 36, triad: [60, 64, 67] },
  { root: 43, triad: [59, 62, 67] },
  { root: 45, triad: [57, 60, 64] },
  { root: 41, triad: [60, 65, 69] },
];
const C_POP: readonly Chord[] = [
  { root: 36, triad: [60, 64, 67] },
  { root: 45, triad: [60, 64, 69] },
  { root: 41, triad: [60, 65, 69] },
  { root: 43, triad: [59, 62, 67] },
];
const C_SOFT: readonly Chord[] = [
  { root: 36, triad: [60, 64, 67] },
  { root: 45, triad: [60, 64, 69] },
  { root: 38, triad: [62, 65, 69] },
  { root: 43, triad: [59, 62, 67] },
];
const G_SUNNY: readonly Chord[] = [
  { root: 43, triad: [67, 71, 74] },
  { root: 38, triad: [66, 69, 74] },
  { root: 40, triad: [64, 67, 71] },
  { root: 36, triad: [64, 67, 72] },
];
const F_LULLABY: readonly Chord[] = [
  { root: 41, triad: [60, 65, 69] },
  { root: 36, triad: [60, 64, 67] },
  { root: 38, triad: [62, 65, 69] },
  { root: 46, triad: [62, 65, 70] },
];
const A_MINOR: readonly Chord[] = [
  { root: 45, triad: [57, 60, 64] },
  { root: 41, triad: [57, 60, 65] },
  { root: 36, triad: [60, 64, 67] },
  { root: 43, triad: [59, 62, 67] },
];
const E_MAGIC: readonly Chord[] = [
  { root: 40, triad: [59, 64, 67] },
  { root: 36, triad: [60, 64, 67] },
  { root: 43, triad: [59, 62, 67] },
  { root: 38, triad: [62, 66, 69] },
];

const SCALE_C = [72, 74, 76, 79, 81, 84];
const SCALE_G = [74, 76, 79, 81, 83, 86];
const SCALE_F = [72, 74, 77, 79, 81, 84];
const SCALE_A_MINOR = [69, 72, 74, 76, 79, 81];
const SCALE_E_MINOR = [76, 79, 81, 83, 86, 88];

// Four two-bar phrases of 16 eighth-note slots; numbers index SCALE, -1 is a rest.
const PHRASES: ReadonlyArray<readonly number[]> = [
  [2, -1, 2, 4, 3, -1, 2, 0, 1, -1, 1, 3, 2, -1, 1, -1],
  [4, -1, 4, 5, 4, -1, 3, 2, 3, -1, 3, 4, 3, -1, 2, -1],
  [5, -1, 4, -1, 5, -1, 4, 2, 3, -1, 2, -1, 1, -1, 0, -1],
  [0, 1, 2, -1, 2, 3, 4, -1, 4, 3, 2, -1, 2, -1, 0, -1],
];
// Which phrase plays in each pair of bars.
const ARRANGEMENT = [0, 1, 0, 3, 2, 1, 2, 0];

const BOUNCE = [1, 0, 1, 0, 1, 0, 0.7, 0];
const ARPEGGIO = [0, 1, 2, 1, 0, 1, 2, 1];

type Settings = {
  bpm: number;
  drums: boolean;
  /** Kick on every beat (dance feel) instead of beats 1 and 3. */
  fourOnFloor: boolean;
  shaker: boolean;
  bounceBass: boolean;
  stabs: boolean;
  lead: Lead;
  arpeggio: boolean;
  pad: boolean;
  /** Quiet high bell notes on top, for a magical feel. */
  sparkle: boolean;
  chords: readonly Chord[];
  scale: readonly number[];
};

const TRACK_SETTINGS: Record<MusicTrackId, Settings> = {
  bouncy: {
    bpm: 118, drums: true, fourOnFloor: false, shaker: false, bounceBass: true,
    stabs: true, lead: "marimba", arpeggio: false, pad: false, sparkle: false,
    chords: C_MAJOR, scale: SCALE_C,
  },
  marimba: {
    bpm: 100, drums: false, fourOnFloor: false, shaker: true, bounceBass: false,
    stabs: false, lead: "marimba", arpeggio: true, pad: false, sparkle: false,
    chords: C_MAJOR, scale: SCALE_C,
  },
  musicbox: {
    bpm: 84, drums: false, fourOnFloor: false, shaker: false, bounceBass: false,
    stabs: false, lead: "bell", arpeggio: true, pad: true, sparkle: false,
    chords: C_MAJOR, scale: SCALE_C,
  },
  sunny: {
    bpm: 124, drums: false, fourOnFloor: false, shaker: true, bounceBass: true,
    stabs: true, lead: "pluck", arpeggio: false, pad: false, sparkle: false,
    chords: G_SUNNY, scale: SCALE_G,
  },
  dance: {
    bpm: 112, drums: true, fourOnFloor: true, shaker: false, bounceBass: true,
    stabs: true, lead: "flute", arpeggio: false, pad: false, sparkle: false,
    chords: C_POP, scale: SCALE_C,
  },
  adventure: {
    bpm: 132, drums: true, fourOnFloor: false, shaker: false, bounceBass: true,
    stabs: false, lead: "marimba", arpeggio: true, pad: false, sparkle: false,
    chords: A_MINOR, scale: SCALE_A_MINOR,
  },
  lullaby: {
    bpm: 70, drums: false, fourOnFloor: false, shaker: false, bounceBass: false,
    stabs: false, lead: "flute", arpeggio: true, pad: true, sparkle: false,
    chords: F_LULLABY, scale: SCALE_F,
  },
  piano: {
    bpm: 88, drums: false, fourOnFloor: false, shaker: false, bounceBass: false,
    stabs: false, lead: "piano", arpeggio: true, pad: true, sparkle: false,
    chords: C_SOFT, scale: SCALE_C,
  },
  magic: {
    bpm: 96, drums: false, fourOnFloor: false, shaker: false, bounceBass: false,
    stabs: false, lead: "bell", arpeggio: true, pad: true, sparkle: true,
    chords: E_MAGIC, scale: SCALE_E_MINOR,
  },
};

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function createSynth(ctx: OfflineAudioContext, master: AudioNode, limit: number) {
  const noiseBuffer = (() => {
    const length = Math.round(0.25 * SAMPLE_RATE);
    const buffer = ctx.createBuffer(1, length, SAMPLE_RATE);
    const data = buffer.getChannelData(0);
    let state = 12345;

    for (let i = 0; i < length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      data[i] = (state / 4294967296) * 2 - 1;
    }

    return buffer;
  })();

  const tone = (
    midi: number,
    start: number,
    duration: number,
    type: OscillatorType,
    peak: number,
    attack = 0.006,
    multiple = 1,
  ) => {
    const end = Math.min(start + duration, limit - 0.03);
    if (end <= start + attack) return;

    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = midiToFrequency(midi) * multiple;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(end + 0.01);
  };

  const noise = (
    start: number,
    duration: number,
    peak: number,
    filterType: BiquadFilterType,
    frequency: number,
  ) => {
    if (start + duration >= limit) return;

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.01);
  };

  return {
    tone,
    marimba: (midi: number, start: number, duration: number) => {
      tone(midi, start, duration, "sine", 0.2, 0.004);
      tone(midi, start, 0.09, "sine", 0.07, 0.002, 4);
    },
    bell: (midi: number, start: number, duration: number) => {
      tone(midi, start, duration, "sine", 0.14, 0.003);
      tone(midi, start, duration * 0.5, "sine", 0.04, 0.003, 2.76);
    },
    pluck: (midi: number, start: number, duration: number) => {
      tone(midi, start, duration, "triangle", 0.2, 0.003);
      tone(midi, start, duration * 0.4, "sine", 0.07, 0.002, 2);
    },
    piano: (midi: number, start: number, duration: number) => {
      tone(midi, start, duration, "sine", 0.2, 0.004);
      tone(midi, start, duration * 0.6, "sine", 0.07, 0.003, 2);
      tone(midi, start, duration * 0.35, "sine", 0.03, 0.003, 3);
    },
    flute: (midi: number, start: number, duration: number) => {
      const end = Math.min(start + duration, limit - 0.03);
      if (end <= start + 0.08) return;

      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = midiToFrequency(midi);

      // A gentle vibrato makes the sine wave sound like a breathy flute.
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5.2;
      const depth = ctx.createGain();
      depth.gain.value = midiToFrequency(midi) * 0.006;
      vibrato.connect(depth);
      depth.connect(oscillator.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.17, start + 0.07);
      gain.gain.setValueAtTime(0.15, Math.max(start + 0.08, end - 0.12));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      vibrato.start(start);
      oscillator.stop(end + 0.01);
      vibrato.stop(end + 0.01);
    },
    kick: (start: number) => {
      if (start + 0.3 >= limit) return;

      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(150, start);
      oscillator.frequency.exponentialRampToValueAtTime(45, start + 0.12);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.3);
    },
    clap: (start: number) => {
      noise(start, 0.14, 0.28, "bandpass", 1800);
      noise(start + 0.012, 0.1, 0.18, "bandpass", 2400);
    },
    hat: (start: number, peak: number) => noise(start, 0.05, peak, "highpass", 7000),
  };
}

async function renderGenerated(id: MusicTrackId): Promise<AudioBuffer> {
  const settings = TRACK_SETTINGS[id];
  const beat = 60 / settings.bpm;
  const bar = beat * 4;
  const eighth = beat / 2;
  const limit = bar * BARS;

  const ctx = new OfflineAudioContext(2, Math.ceil(limit * SAMPLE_RATE), SAMPLE_RATE);
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  const synth = createSynth(ctx, master, limit);

  for (let index = 0; index < BARS; index++) {
    const chord = settings.chords[index % settings.chords.length];
    const barStart = index * bar;
    const phrase = PHRASES[ARRANGEMENT[Math.floor(index / 2) % ARRANGEMENT.length]];
    const half = index % 2 === 0 ? 0 : 8;

    if (settings.drums) {
      for (let b = 0; b < 4; b++) {
        const time = barStart + b * beat;
        if (b % 2 === 0 || settings.fourOnFloor) synth.kick(time);
        if (b % 2 === 1) synth.clap(time);
      }
    }

    if (settings.pad) {
      synth.tone(chord.root + 12, barStart, bar * 0.95, "sine", 0.12, 0.1);
      synth.tone(chord.triad[0] - 12, barStart, bar * 0.95, "sine", 0.05, 0.1);
    }

    for (let slot = 0; slot < 8; slot++) {
      const time = barStart + slot * eighth;

      if (settings.bounceBass && BOUNCE[slot] > 0) {
        const note = slot === 6 ? chord.root + 7 : slot === 2 ? chord.root + 12 : chord.root;
        synth.tone(note, time, eighth * 0.85, "triangle", 0.3 * BOUNCE[slot], 0.004);
      }

      if (!settings.bounceBass && !settings.pad && slot % 4 === 0) {
        synth.tone(chord.root + 12, time, beat * 1.6, "triangle", 0.2, 0.01);
      }

      if (settings.stabs && slot % 2 === 1) {
        for (const note of chord.triad) {
          synth.tone(note, time, eighth * 0.6, "triangle", 0.045, 0.004);
        }
      }

      if (settings.arpeggio) {
        const note = chord.triad[ARPEGGIO[slot]] + (settings.lead === "bell" ? 12 : 0);

        if (settings.lead === "bell") synth.bell(note, time, 0.9);
        else synth.tone(note, time, 0.3, "triangle", 0.07, 0.004);
      }

      if (settings.sparkle && (slot === 3 || slot === 7)) {
        synth.bell(settings.scale[(index + slot) % settings.scale.length] + 12, time, 1.4);
      }

      const noteIndex = phrase[half + slot];
      if (noteIndex >= 0) {
        const note = settings.scale[noteIndex];

        if (settings.lead === "bell") synth.bell(note, time, 1.0);
        else if (settings.lead === "pluck") synth.pluck(note, time, eighth * 1.5);
        else if (settings.lead === "piano") synth.piano(note, time, eighth * 2.4);
        else if (settings.lead === "flute") synth.flute(note, time, eighth * 1.9);
        else synth.marimba(note, time, eighth * 1.8);
      }

      if (settings.drums) synth.hat(time, slot % 2 === 1 ? 0.07 : 0.04);
      if (settings.shaker && slot % 2 === 1) synth.hat(time, 0.05);
    }
  }

  return levelOut(await ctx.startRendering());
}

/** Gives every generated track a similar loudness without ever clipping. */
function levelOut(buffer: AudioBuffer): AudioBuffer {
  let peak = 0;
  let energy = 0;
  let count = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);

    for (let i = 0; i < data.length; i++) {
      const value = Math.abs(data[i]);
      if (value > peak) peak = value;
      energy += data[i] * data[i];
      count += 1;
    }
  }

  const rms = Math.sqrt(energy / Math.max(1, count));
  if (peak === 0 || rms === 0) return buffer;

  const gain = Math.min(0.9 / peak, 0.075 / rms, 3);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }

  return buffer;
}

const generatedCache = new Map<MusicTrackId, Promise<AudioBuffer>>();

export async function loadMusicBuffer(source: MusicSource): Promise<AudioBuffer> {
  if (typeof OfflineAudioContext === "undefined") {
    throw new Error("This browser does not support Web Audio, so music is unavailable.");
  }

  if (source.kind === "generated") {
    let cached = generatedCache.get(source.id);

    if (!cached) {
      cached = renderGenerated(source.id);
      generatedCache.set(source.id, cached);
      cached.catch(() => generatedCache.delete(source.id));
    }

    return cached;
  }

  if (source.file.size > MAX_AUDIO_FILE_BYTES) {
    throw new Error("Audio files must be under 25 MB.");
  }

  const data = await source.file.arrayBuffer();

  try {
    return await new OfflineAudioContext(2, 1, SAMPLE_RATE).decodeAudioData(data);
  } catch {
    throw new Error(
      "This audio file could not be decoded. Try an MP3, WAV, OGG, or M4A file.",
    );
  }
}

/**
 * Starts the loop now, as if the video were already `offsetSec` seconds in,
 * with a fade-in at the start and a fade-out before `durationSec`.
 */
export function startMusic(
  ctx: BaseAudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  options: { volume: number; durationSec: number; offsetSec: number },
): MusicPlayback {
  const { volume, durationSec, offsetSec } = options;
  const now = ctx.currentTime;

  const levelAt = (t: number) =>
    volume *
    Math.min(1, Math.max(0, t / FADE_IN_SECONDS)) *
    Math.min(1, Math.max(0, (durationSec - t) / FADE_OUT_SECONDS));

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(levelAt(offsetSec), now);

  if (offsetSec < FADE_IN_SECONDS) {
    gain.gain.linearRampToValueAtTime(volume, now + FADE_IN_SECONDS - offsetSec);
  }

  const fadeOutAt = durationSec - FADE_OUT_SECONDS;

  if (offsetSec < fadeOutAt) {
    gain.gain.setValueAtTime(volume, now + fadeOutAt - offsetSec);
  }

  gain.gain.linearRampToValueAtTime(0, now + Math.max(0.01, durationSec - offsetSec));

  source.connect(gain);
  gain.connect(destination);
  source.start(now, offsetSec % buffer.duration);

  return {
    stop: () => {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }

      source.disconnect();
      gain.disconnect();
    },
  };
}
