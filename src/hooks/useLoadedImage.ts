import { useEffect, useState } from "react";

/**
 * Decodes the selected file into an HTMLImageElement entirely in the browser.
 * The temporary object URL is revoked when the file changes or the component unmounts.
 */
export function useLoadedImage(file: File | null): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{
    file: File;
    image: HTMLImageElement;
  } | null>(null);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (!cancelled) setLoaded({ file, image });
    };
    image.src = url;

    return () => {
      cancelled = true;
      image.onload = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return loaded && loaded.file === file ? loaded.image : null;
}

/** Decodes an image from a URL or data URL (for example the saved profile picture). */
export function useImageUrl(src: string | null): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{
    src: string;
    image: HTMLImageElement;
  } | null>(null);

  useEffect(() => {
    if (!src) return;

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (!cancelled) setLoaded({ src, image });
    };
    image.src = src;

    return () => {
      cancelled = true;
      image.onload = null;
    };
  }, [src]);

  return loaded && loaded.src === src ? loaded.image : null;
}
