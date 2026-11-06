/*
 * A small WebM (Matroska) writer. It collects encoded video and audio chunks
 * and writes one complete file with a known duration and seek index, so the
 * result plays and seeks normally in browsers and players.
 */

export type MuxChunk = {
  track: 1 | 2;
  /** Presentation time in milliseconds. */
  timeMs: number;
  keyframe: boolean;
  data: Uint8Array;
};

export type MuxOptions = {
  width: number;
  height: number;
  videoCodec: "V_VP8" | "V_VP9";
  durationMs: number;
  /** Present when the file has audio. */
  audio: { sampleRate: number; channels: number; preSkip: number } | null;
  chunks: MuxChunk[];
};

const encoder = new TextEncoder();

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}

function idBytes(id: number): Uint8Array {
  const bytes: number[] = [];

  for (let shift = 24; shift >= 0; shift -= 8) {
    const byte = (id >>> shift) & 0xff;
    if (byte !== 0 || bytes.length > 0) bytes.push(byte);
  }

  return Uint8Array.from(bytes);
}

/** EBML variable-length size. */
function sizeBytes(size: number): Uint8Array {
  let length = 1;
  while (length < 8 && size >= 2 ** (7 * length) - 1) length += 1;

  const out = new Uint8Array(length);
  let value = size;

  for (let i = length - 1; i >= 0; i--) {
    out[i] = value % 256;
    value = Math.floor(value / 256);
  }

  out[0] |= 1 << (8 - length);

  return out;
}

function element(id: number, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(payload);

  return concat([idBytes(id), sizeBytes(body.length), body]);
}

function uint(value: number): Uint8Array {
  const bytes: number[] = [];
  let rest = value;

  do {
    bytes.unshift(rest % 256);
    rest = Math.floor(rest / 256);
  } while (rest > 0);

  return Uint8Array.from(bytes);
}

function float64(value: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, value);

  return out;
}

function text(value: string): Uint8Array {
  return encoder.encode(value);
}

function opusHead(sampleRate: number, channels: number, preSkip: number): Uint8Array {
  const out = new Uint8Array(19);
  const view = new DataView(out.buffer);

  out.set(text("OpusHead"), 0);
  out[8] = 1;
  out[9] = channels;
  view.setUint16(10, preSkip, true);
  view.setUint32(12, sampleRate, true);
  view.setUint16(16, 0, true);
  out[18] = 0;

  return out;
}

function simpleBlock(chunk: MuxChunk, clusterMs: number): Uint8Array {
  const relative = Math.round(chunk.timeMs) - clusterMs;
  const header = new Uint8Array(4);

  header[0] = 0x80 | chunk.track;
  header[1] = (relative >> 8) & 0xff;
  header[2] = relative & 0xff;
  header[3] = chunk.keyframe ? 0x80 : 0;

  return element(0xa3, header, chunk.data);
}

export function muxWebm(options: MuxOptions): Uint8Array {
  const { width, height, videoCodec, durationMs, audio } = options;
  const chunks = [...options.chunks].sort(
    (a, b) => a.timeMs - b.timeMs || a.track - b.track,
  );

  const ebmlHeader = element(
    0x1a45dfa3,
    element(0x4286, uint(1)),
    element(0x42f7, uint(1)),
    element(0x42f2, uint(4)),
    element(0x42f3, uint(8)),
    element(0x4282, text("webm")),
    element(0x4287, uint(4)),
    element(0x4285, uint(2)),
  );

  const info = element(
    0x1549a966,
    element(0x2ad7b1, uint(1_000_000)),
    element(0x4489, float64(durationMs)),
    element(0x4d80, text("Drawsy Studio")),
    element(0x5741, text("Drawsy Studio")),
  );

  const videoTrack = element(
    0xae,
    element(0xd7, uint(1)),
    element(0x73c5, uint(1)),
    element(0x83, uint(1)),
    element(0x86, text(videoCodec)),
    element(0xe0, element(0xb0, uint(width)), element(0xba, uint(height))),
  );

  const tracks = element(
    0x1654ae6b,
    videoTrack,
    ...(audio
      ? [
          element(
            0xae,
            element(0xd7, uint(2)),
            element(0x73c5, uint(2)),
            element(0x83, uint(2)),
            element(0x86, text("A_OPUS")),
            element(0x63a2, opusHead(audio.sampleRate, audio.channels, audio.preSkip)),
            element(0x56aa, uint(6_500_000)),
            element(0x56bb, uint(80_000_000)),
            element(
              0xe1,
              element(0xb5, float64(audio.sampleRate)),
              element(0x9f, uint(audio.channels)),
            ),
          ),
        ]
      : []),
  );

  // Clusters start at every video keyframe, so each one is a place to seek to.
  const clusters: { timeMs: number; body: Uint8Array[] }[] = [];

  for (const chunk of chunks) {
    const last = clusters[clusters.length - 1];
    const startNew =
      !last ||
      (chunk.track === 1 && chunk.keyframe) ||
      Math.round(chunk.timeMs) - last.timeMs > 30_000;

    if (startNew) {
      const timeMs = Math.round(chunk.timeMs);
      clusters.push({ timeMs, body: [element(0xe7, uint(timeMs))] });
    }

    const current = clusters[clusters.length - 1];
    current.body.push(simpleBlock(chunk, current.timeMs));
  }

  const clusterElements = clusters.map((cluster) => element(0x1f43b675, ...cluster.body));

  // Cues: where each cluster begins, counted from the start of the segment data.
  const headLength = info.length + tracks.length;
  let position = headLength;
  const cuePoints: Uint8Array[] = [];

  clusters.forEach((cluster, index) => {
    cuePoints.push(
      element(
        0xbb,
        element(0xb3, uint(cluster.timeMs)),
        element(0xb7, element(0xf7, uint(1)), element(0xf1, uint(position))),
      ),
    );
    position += clusterElements[index].length;
  });

  const cues = element(0x1c53bb6b, ...cuePoints);
  const segment = element(0x18538067, info, tracks, ...clusterElements, cues);

  return concat([ebmlHeader, segment]);
}
