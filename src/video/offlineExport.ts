import { muxWebm, type MuxChunk } from "./webmMuxer";

/*
 * Frame-by-frame export. Every frame is drawn for its exact time and encoded
 * with WebCodecs, so the video is smooth on any computer: a slow computer only
 * takes longer to export, it never produces a laggy video. (Recording the
 * screen in real time with MediaRecorder drops frames when the computer cannot
 * draw 30 frames per second.)
 */

const FPS = 30;
const AUDIO_RATE = 48000;
const AUDIO_CHUNK = 960;
const OPUS_PRE_SKIP = 312;
const KEYFRAME_EVERY = FPS * 2;

export type FrameRenderer = { drawFrame: (ctx: CanvasRenderingContext2D, timeMs: number) => void };

export type OfflineOptions = {
  renderer: FrameRenderer;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  durationSec: number;
  bitrate: number;
  soundtrack: AudioBuffer | null;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
};

export type OfflineResult = { blob: Blob; hasAudio: boolean; codec: "VP9" | "VP8" };

export function offlineExportSupported(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof OfflineAudioContext !== "undefined"
  );
}

function nextTask(): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Export cancelled.");
}

async function pickVideoConfig(
  width: number,
  height: number,
  bitrate: number,
): Promise<{ config: VideoEncoderConfig; codec: "VP9" | "VP8" } | null> {
  const candidates: { codec: "VP9" | "VP8"; string: string }[] = [
    { codec: "VP9", string: "vp09.00.50.08" },
    { codec: "VP8", string: "vp8" },
  ];

  for (const candidate of candidates) {
    const config: VideoEncoderConfig = {
      codec: candidate.string,
      width,
      height,
      bitrate,
      framerate: FPS,
      latencyMode: "quality",
    };

    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return { config, codec: candidate.codec };
    } catch {
      // Try the next codec.
    }
  }

  return null;
}

/** Music rendered faster than real time, then encoded to Opus. Null when it is not possible. */
async function encodeAudio(
  options: OfflineOptions,
  chunks: MuxChunk[],
): Promise<boolean> {
  const { soundtrack, durationSec, signal } = options;

  if (
    !soundtrack ||
    typeof AudioEncoder === "undefined" ||
    typeof AudioData === "undefined"
  ) {
    return false;
  }

  const config: AudioEncoderConfig = {
    codec: "opus",
    sampleRate: AUDIO_RATE,
    numberOfChannels: 2,
    bitrate: 128_000,
  };

  try {
    const support = await AudioEncoder.isConfigSupported(config);
    if (!support.supported) return false;
  } catch {
    return false;
  }

  const frames = Math.ceil(durationSec * AUDIO_RATE);
  const offline = new OfflineAudioContext(2, frames, AUDIO_RATE);

  const source = offline.createBufferSource();
  source.buffer = soundtrack;
  source.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  throwIfAborted(signal);

  let failure: Error | null = null;
  const audioEncoder = new AudioEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({ track: 2, timeMs: chunk.timestamp / 1000, keyframe: true, data });
    },
    error: (error) => {
      failure = new Error(`Audio encoding failed: ${error.message}`);
    },
  });

  audioEncoder.configure(config);

  const left = rendered.getChannelData(0);
  const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;

  for (let start = 0; start < frames; start += AUDIO_CHUNK) {
    throwIfAborted(signal);
    if (failure) throw failure;

    const length = Math.min(AUDIO_CHUNK, frames - start);
    const planar = new Float32Array(length * 2);
    planar.set(left.subarray(start, start + length), 0);
    planar.set(right.subarray(start, start + length), length);

    const data = new AudioData({
      format: "f32-planar",
      sampleRate: AUDIO_RATE,
      numberOfFrames: length,
      numberOfChannels: 2,
      timestamp: Math.round((start / AUDIO_RATE) * 1_000_000),
      data: planar,
    });

    audioEncoder.encode(data);
    data.close();

    if (audioEncoder.encodeQueueSize > 50) await nextTask();
  }

  await audioEncoder.flush();
  audioEncoder.close();
  if (failure) throw failure;

  return true;
}

/** Returns null when this browser cannot encode video frame by frame. */
export async function exportOffline(options: OfflineOptions): Promise<OfflineResult | null> {
  const { renderer, canvas, context, durationSec, bitrate, signal, onProgress } = options;

  if (!offlineExportSupported()) return null;

  const picked = await pickVideoConfig(canvas.width, canvas.height, bitrate);
  if (!picked) return null;

  const chunks: MuxChunk[] = [];
  let failure: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({
        track: 1,
        timeMs: chunk.timestamp / 1000,
        keyframe: chunk.type === "key",
        data,
      });
    },
    error: (error) => {
      failure = new Error(`Video encoding failed: ${error.message}`);
    },
  });

  try {
    videoEncoder.configure(picked.config);

    const totalFrames = Math.max(1, Math.round(durationSec * FPS));
    const totalMs = durationSec * 1000;
    let lastPercent = -1;

    for (let index = 0; index < totalFrames; index++) {
      throwIfAborted(signal);
      if (failure) throw failure;

      const timeMs = (index * 1000) / FPS;
      renderer.drawFrame(context, Math.min(timeMs, totalMs));

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(timeMs * 1000),
        duration: Math.round(1_000_000 / FPS),
      });
      videoEncoder.encode(frame, { keyFrame: index % KEYFRAME_EVERY === 0 });
      frame.close();

      // Let the encoder catch up and keep the page responsive (progress, cancel).
      while (videoEncoder.encodeQueueSize > 6) {
        await nextTask();
        throwIfAborted(signal);
        if (failure) throw failure;
      }

      if (index % 4 === 0) await nextTask();

      const percent = Math.floor((index / totalFrames) * 90);
      if (percent !== lastPercent) {
        lastPercent = percent;
        onProgress?.(percent / 100);
      }
    }

    await videoEncoder.flush();
    if (failure) throw failure;

    onProgress?.(0.92);
    const hasAudio = await encodeAudio(options, chunks);
    onProgress?.(0.98);

    const bytes = muxWebm({
      width: canvas.width,
      height: canvas.height,
      videoCodec: picked.codec === "VP9" ? "V_VP9" : "V_VP8",
      durationMs: totalMs,
      audio: hasAudio
        ? { sampleRate: AUDIO_RATE, channels: 2, preSkip: OPUS_PRE_SKIP }
        : null,
      chunks,
    });

    return {
      blob: new Blob([bytes as BlobPart], { type: "video/webm" }),
      hasAudio,
      codec: picked.codec,
    };
  } finally {
    if (videoEncoder.state !== "closed") videoEncoder.close();
  }
}
