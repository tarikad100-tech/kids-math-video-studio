import { exportOffline, offlineExportSupported, type FrameRenderer } from "./offlineExport";

export type ExportQuality = "720p" | "1080p";

export function exportSupported(): boolean {
  return offlineExportSupported();
}

/** Short side in pixels for each quality. */
export function shortSide(quality: ExportQuality): number {
  return quality === "1080p" ? 1080 : 720;
}

export type ExportRequest = {
  /** Builds a renderer for the exact export size. */
  makeRenderer: (width: number, height: number) => FrameRenderer;
  vertical: boolean;
  quality: ExportQuality;
  durationSec: number;
  soundtrack: AudioBuffer | null;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
};

export type ExportResult = { blob: Blob; hasAudio: boolean; codec: string };

/** Returns null when this browser cannot encode video (use Chrome or Edge). */
export async function exportVideo(request: ExportRequest): Promise<ExportResult | null> {
  const short = shortSide(request.quality);
  const long = Math.round((short * 16) / 9 / 2) * 2;
  const width = request.vertical ? short : long;
  const height = request.vertical ? long : short;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the video canvas.");

  const bitrate = request.quality === "1080p" ? 8_000_000 : 5_000_000;

  return exportOffline({
    renderer: request.makeRenderer(width, height),
    canvas,
    context,
    durationSec: request.durationSec,
    bitrate,
    soundtrack: request.soundtrack,
    signal: request.signal,
    onProgress: request.onProgress,
  });
}
