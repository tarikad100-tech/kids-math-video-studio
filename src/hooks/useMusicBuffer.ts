import { useEffect, useState } from "react";
import {
  loadMusicBuffer,
  type MusicSource,
  type MusicTrackId,
} from "../audio/music";

export type MusicChoice = "none" | "file" | MusicTrackId;

export type MusicState = {
  buffer: AudioBuffer | null;
  status: "none" | "loading" | "ready" | "error";
  message: string;
};

function sourceFor(track: MusicChoice, file: File | null): MusicSource | null {
  if (track === "none") return null;
  if (track === "file") return file ? { kind: "file", file } : null;

  return { kind: "generated", id: track };
}

/** Prepares the music AudioBuffer for the selected track (generated or imported). */
export function useMusicBuffer(track: MusicChoice, file: File | null): MusicState {
  const source = sourceFor(track, file);
  const key = source
    ? source.kind === "file"
      ? `file:${source.file.name}:${source.file.size}:${source.file.lastModified}`
      : source.id
    : "none";

  const [loaded, setLoaded] = useState<{
    key: string;
    buffer: AudioBuffer | null;
    message: string;
  } | null>(null);

  useEffect(() => {
    const wanted = sourceFor(track, file);
    if (!wanted) return;

    let cancelled = false;

    loadMusicBuffer(wanted)
      .then((buffer) => {
        if (!cancelled) setLoaded({ key, buffer, message: "" });
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setLoaded({
            key,
            buffer: null,
            message:
              failure instanceof Error ? failure.message : "Music could not be loaded.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, track, file]);

  if (key === "none") {
    return { buffer: null, status: "none", message: "" };
  }

  if (!loaded || loaded.key !== key) {
    return { buffer: null, status: "loading", message: "" };
  }

  return loaded.buffer
    ? { buffer: loaded.buffer, status: "ready", message: "" }
    : { buffer: null, status: "error", message: loaded.message };
}
