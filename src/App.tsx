import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { GENERATED_TRACKS, isMusicTrackId, type MusicTrackId } from "./audio/music";
import { buildSoundtrack } from "./audio/soundtrack";
import { DEFAULT_PROFILE_PICTURE } from "./branding/defaultProfile";
import { useImageUrl } from "./hooks/useLoadedImage";
import { useMusicBuffer } from "./hooks/useMusicBuffer";
import { BACKGROUND_OPTIONS, isBackgroundPreset, type BackgroundPreset } from "./math/background";
import {
  BADGE_POSITIONS,
  MAX_BADGE_NAME,
  createBadge,
  isBadgePosition,
  type BadgePosition,
} from "./math/badge";
import { createMathRenderer } from "./math/frame";
import { LANGUAGES, TEXTS, isLanguage, type Language } from "./math/i18n";
import {
  LEVELS,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  TOPICS,
  generateQuestions,
  isLevel,
  isTopic,
  type Level,
  type Question,
  type Topic,
} from "./math/questions";
import { solve, visualFor } from "./math/solve";
import { MAX_SECONDS, MIN_SECONDS, buildTimeline } from "./math/timeline";
import { exportSupported, exportVideo, type ExportQuality } from "./video/exportVideo";
import "./App.css";

type Settings = {
  topics: Topic[];
  level: Level;
  count: number;
  seconds: number;
  language: Language;
  vertical: boolean;
  quality: ExportQuality;
  background: BackgroundPreset;
  music: MusicTrackId | "none";
  musicVolume: number;
  effects: boolean;
  showMascot: boolean;
  showBadge: boolean;
  badgeName: string;
  badgePosition: BadgePosition;
  titleText: string;
  outroText: string;
};

const DEFAULT_SETTINGS: Settings = {
  topics: ["multiplication", "addition", "subtraction"],
  level: "progressive",
  count: 10,
  seconds: 8,
  language: "English",
  vertical: true,
  quality: "720p",
  background: "meadow",
  music: "bouncy",
  musicVolume: 0.45,
  effects: true,
  showMascot: true,
  showBadge: true,
  badgeName: "Story & Info",
  badgePosition: "top-left",
  titleText: "",
  outroText: "",
};

const STORAGE_KEY = "mathsy-studio-v1";
const PROFILE_KEY = "mathsy-studio-profile-v1";

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value * 100) / 100))
    : fallback;
}

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readText(value: unknown, max: number, fallback: string): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function parseSettings(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_SETTINGS;

  const r = raw as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const topics = Array.isArray(r.topics) ? r.topics.filter(isTopic) : d.topics;

  return {
    topics: topics.length > 0 ? topics : d.topics,
    level: isLevel(r.level) ? r.level : d.level,
    count: clampNumber(r.count, MIN_QUESTIONS, MAX_QUESTIONS, d.count),
    seconds: clampNumber(r.seconds, MIN_SECONDS, MAX_SECONDS, d.seconds),
    language: isLanguage(r.language) ? r.language : d.language,
    vertical: readBool(r.vertical, d.vertical),
    quality: r.quality === "1080p" ? "1080p" : "720p",
    background: isBackgroundPreset(r.background) ? r.background : d.background,
    music: r.music === "none" || isMusicTrackId(r.music) ? r.music : d.music,
    musicVolume: clampNumber(r.musicVolume, 0, 1, d.musicVolume),
    effects: readBool(r.effects, d.effects),
    showMascot: readBool(r.showMascot, d.showMascot),
    showBadge: readBool(r.showBadge, d.showBadge),
    badgeName: readText(r.badgeName, MAX_BADGE_NAME, d.badgeName),
    badgePosition: isBadgePosition(r.badgePosition) ? r.badgePosition : d.badgePosition,
    titleText: readText(r.titleText, 70, ""),
    outroText: readText(r.outroText, 70, ""),
  };
}

function parseQuestions(raw: unknown): Question[] | null {
  if (!Array.isArray(raw)) return null;

  const list: Question[] = [];

  for (const item of raw.slice(0, MAX_QUESTIONS)) {
    if (typeof item !== "object" || item === null) continue;

    const q = item as Record<string, unknown>;
    if (typeof q.text !== "string" || typeof q.answer !== "string") continue;

    const text = q.text.slice(0, 40);
    list.push({ id: list.length + 1, text, answer: q.answer.slice(0, 8), visual: visualFor(text) });
  }

  return list.length > 0 ? list : null;
}

function loadSaved(): { settings: Settings; questions: Question[] } {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");

    if (typeof parsed === "object" && parsed !== null) {
      const p = parsed as Record<string, unknown>;
      const settings = parseSettings(p.settings);
      const questions = parseQuestions(p.questions);

      if (questions) return { settings, questions };
      return { settings, questions: makeQuestions(settings, 1) };
    }
  } catch {
    // Start fresh.
  }

  return { settings: DEFAULT_SETTINGS, questions: makeQuestions(DEFAULT_SETTINGS, 1) };
}

function makeQuestions(settings: Settings, seed: number): Question[] {
  return generateQuestions({
    topics: settings.topics,
    level: settings.level,
    count: settings.count,
    seed,
  });
}

function readProfile(): string {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    return saved && saved.startsWith("data:image/") ? saved : DEFAULT_PROFILE_PICTURE;
  } catch {
    return DEFAULT_PROFILE_PICTURE;
  }
}

function squareThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");

      if (!ctx || side === 0) {
        reject(new Error("The picture could not be read."));
        return;
      }

      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        image,
        (image.naturalWidth - side) / 2,
        (image.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      );
      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The picture could not be read."));
    };

    image.src = url;
  });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const PREVIEW_SHORT = 540;

export default function App() {
  const [initial] = useState(loadSaved);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [questions, setQuestions] = useState<Question[]>(initial.questions);
  const [seed, setSeed] = useState(1);
  const [profileSrc, setProfileSrc] = useState(readProfile);
  const [profileError, setProfileError] = useState("");
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeRef = useRef(0);

  const badgeImage = useImageUrl(profileSrc);
  const music = useMusicBuffer(settings.music, null);
  const texts = TEXTS[settings.language];
  const timeline = useMemo(
    () => buildTimeline(questions.length, settings.seconds),
    [questions.length, settings.seconds],
  );

  const [soundtrack, setSoundtrack] = useState<{ buffer: AudioBuffer | null; for: unknown } | null>(null);
  const soundKey = useMemo(
    () => ({ timeline, music: music.buffer, volume: settings.musicVolume, effects: settings.effects }),
    [timeline, music.buffer, settings.musicVolume, settings.effects],
  );
  const soundReady = soundtrack !== null && soundtrack.for === soundKey;
  const musicLoading = music.status === "loading";

  // Persist.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, questions }));
    } catch {
      // Private mode: the video still works, it just is not remembered.
    }
  }, [settings, questions]);

  const stopAudio = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      // Already stopped.
    }
    sourceRef.current = null;
  }, []);

  // Build the whole soundtrack (music + effects) whenever its inputs change.
  useEffect(() => {
    if (musicLoading) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      buildSoundtrack({
        timeline: soundKey.timeline,
        music: soundKey.music,
        musicVolume: soundKey.volume,
        effects: soundKey.effects,
      })
        .then((buffer) => {
          if (!cancelled) setSoundtrack({ buffer, for: soundKey });
        })
        .catch(() => {
          if (!cancelled) setSoundtrack({ buffer: null, for: soundKey });
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [soundKey, musicLoading]);

  const renderer = useMemo(() => {
    const width = settings.vertical ? PREVIEW_SHORT : Math.round((PREVIEW_SHORT * 16) / 9);
    const height = settings.vertical ? Math.round((PREVIEW_SHORT * 16) / 9) : PREVIEW_SHORT;

    return makeRenderer(width, height);
    // eslint-disable-next-line no-use-before-define
  }, [settings, questions, timeline, badgeImage]);

  function makeRenderer(width: number, height: number) {
    return createMathRenderer({
      width,
      height,
      questions,
      timeline,
      texts,
      background: settings.background,
      badge: settings.showBadge
        ? createBadge(width, height, settings.badgeName, badgeImage, settings.badgePosition)
        : null,
      titleText: settings.titleText,
      outroText: settings.outroText,
      showMascot: settings.showMascot,
    });
  }

  // Draw the current frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = renderer.width;
    canvas.height = renderer.height;
    renderer.drawFrame(ctx, Math.min(timeMs, timeline.totalMs));
  }, [renderer, timeMs, timeline.totalMs]);

  function seek(ms: number) {
    timeRef.current = ms;
    setTimeMs(ms);
  }

  function pause() {
    stopAudio();
    setPlaying(false);
  }

  // Anything that changes the video stops playback.
  useEffect(() => {
    stopAudio();
    setPlaying(false);
  }, [soundKey, stopAudio]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  // Playback clock: the audio clock when there is sound, otherwise the wall clock.
  useEffect(() => {
    if (!playing) return;

    const startTime = timeRef.current >= timeline.totalMs ? 0 : timeRef.current;
    const wallStart = performance.now();
    let audioStart: number | null = null;
    let frame = 0;

    if (soundReady && soundtrack?.buffer) {
      try {
        const ctx = audioRef.current ?? new AudioContext();
        audioRef.current = ctx;
        void ctx.resume();
        const source = ctx.createBufferSource();
        source.buffer = soundtrack.buffer;
        source.connect(ctx.destination);
        source.start(0, startTime / 1000);
        sourceRef.current = source;
        audioStart = ctx.currentTime;
      } catch {
        audioStart = null;
      }
    }

    const tick = () => {
      const elapsed =
        audioStart !== null && audioRef.current
          ? (audioRef.current.currentTime - audioStart) * 1000
          : performance.now() - wallStart;
      const next = startTime + elapsed;

      if (next >= timeline.totalMs) {
        timeRef.current = timeline.totalMs;
        setTimeMs(timeline.totalMs);
        stopAudio();
        setPlaying(false);
        return;
      }

      timeRef.current = next;
      setTimeMs(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      stopAudio();
    };
  }, [playing, timeline.totalMs, soundReady, soundtrack, stopAudio]);

  function update(patch: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function toggleTopic(topic: Topic) {
    const has = settings.topics.includes(topic);
    const next = has ? settings.topics.filter((t) => t !== topic) : [...settings.topics, topic];
    if (next.length === 0) return;
    update({ topics: TOPICS.map(([id]) => id).filter((id) => next.includes(id)) });
  }

  function generate(newSeed: number) {
    setSeed(newSeed);
    setQuestions(makeQuestions(settings, newSeed));
    seek(0);
  }

  function editQuestion(index: number, text: string) {
    setQuestions((list) =>
      list.map((q, i) => {
        if (i !== index) return q;
        const solved = solve(text);
        return { ...q, text, answer: solved ?? q.answer, visual: visualFor(text) };
      }),
    );
  }

  function editAnswer(index: number, answer: string) {
    setQuestions((list) => list.map((q, i) => (i === index ? { ...q, answer: answer.slice(0, 8) } : q)));
  }

  function removeQuestion(index: number) {
    setQuestions((list) => (list.length <= 1 ? list : list.filter((_, i) => i !== index)));
  }

  function addQuestion() {
    setQuestions((list) =>
      list.length >= MAX_QUESTIONS
        ? list
        : [...list, { id: list.length + 1, text: "2 × 2 = ?", answer: "4", visual: null }],
    );
  }

  async function chooseProfile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;

    if (!/^image\/(png|jpeg|webp)$/.test(picked.type) || picked.size > 8 * 1024 * 1024) {
      setProfileError("Choose a PNG, JPG or WebP picture under 8 MB.");
      return;
    }

    try {
      const thumbnail = await squareThumbnail(picked);
      setProfileSrc(thumbnail);
      setProfileError("");

      try {
        localStorage.setItem(PROFILE_KEY, thumbnail);
      } catch {
        // Still works for this session.
      }
    } catch (failure) {
      setProfileError(failure instanceof Error ? failure.message : "The picture could not be used.");
    }
  }

  async function runExport() {
    pause();
    setError("");
    setStatus("");

    if (!soundReady) {
      setError("The sound is still being prepared. Try again in a moment.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setExporting(true);
    setProgress(0);

    try {
      const result = await exportVideo({
        makeRenderer,
        vertical: settings.vertical,
        quality: settings.quality,
        durationSec: timeline.totalMs / 1000,
        soundtrack: soundtrack?.buffer ?? null,
        signal: controller.signal,
        onProgress: setProgress,
      });

      if (!result) {
        setError("This browser cannot encode video. Please use a recent Chrome or Edge.");
      } else {
        download(result.blob, "mathsy-video.webm");
        setStatus(
          `Done: ${(result.blob.size / 1024 / 1024).toFixed(1)} MB (${result.codec}${result.hasAudio ? ", with sound" : ", no sound"}).`,
        );
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The export failed.");
    } finally {
      setExporting(false);
      abortRef.current = null;
    }
  }

  function saveThumbnail() {
    const width = 1280;
    const height = 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const thumbRenderer = makeRenderer(width, height);
    const slot = timeline.slots[0];
    thumbRenderer.drawFrame(ctx, slot ? slot.countStart + 400 : 0);
    canvas.toBlob((blob) => {
      if (blob) download(blob, "mathsy-thumbnail.png");
    }, "image/png");
  }

  const soundMessage = musicLoading
    ? "Preparing music…"
    : !soundReady
      ? "Preparing sound…"
      : "";

  return (
    <div className="app">
      <header className="top">
        <h1>Mathsy Studio</h1>
        <p>Timed math challenges for kids aged 7–9, ready to publish.</p>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>1. Questions</h2>

          <fieldset className="topics">
            <legend>Topics</legend>
            {TOPICS.map(([id, label]) => (
              <label key={id} className="check">
                <input
                  type="checkbox"
                  checked={settings.topics.includes(id)}
                  onChange={() => toggleTopic(id)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <div className="row">
            <div>
              <label htmlFor="level">Level</label>
              <select
                id="level"
                value={settings.level}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isLevel(value)) update({ level: value });
                }}
              >
                {LEVELS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="count">Questions: {settings.count}</label>
              <input
                id="count"
                type="range"
                min={MIN_QUESTIONS}
                max={MAX_QUESTIONS}
                value={settings.count}
                onChange={(e) => update({ count: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="actions">
            <button type="button" className="primary" onClick={() => generate(seed + 1)}>
              Generate questions
            </button>
          </div>
          <p className="hint">
            Answers are calculated by the program. Edit any question below; the answer updates
            by itself for simple forms like 7 × 8 = ?, 12 ÷ 3 = ?, 3/4 × 12 = ?.
          </p>

          <ol className="questions">
            {questions.map((q, i) => (
              <li key={`${i}-${q.id}`}>
                <span className="num">{i + 1}</span>
                <input
                  className="q-text"
                  aria-label={`Question ${i + 1}`}
                  value={q.text}
                  maxLength={40}
                  onChange={(e) => editQuestion(i, e.target.value)}
                />
                <input
                  className="q-answer"
                  aria-label={`Answer ${i + 1}`}
                  value={q.answer}
                  maxLength={8}
                  onChange={(e) => editAnswer(i, e.target.value)}
                />
                <button
                  type="button"
                  className="icon"
                  aria-label={`Delete question ${i + 1}`}
                  disabled={questions.length <= 1}
                  onClick={() => removeQuestion(i)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="ghost"
            onClick={addQuestion}
            disabled={questions.length >= MAX_QUESTIONS}
          >
            + Add a question
          </button>

          <h2>2. Video</h2>
          <div className="row">
            <div>
              <label htmlFor="language">Text language</label>
              <select
                id="language"
                value={settings.language}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isLanguage(value)) update({ language: value });
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="seconds">Seconds per question: {settings.seconds}</label>
              <input
                id="seconds"
                type="range"
                min={MIN_SECONDS}
                max={MAX_SECONDS}
                value={settings.seconds}
                onChange={(e) => update({ seconds: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="ratio">Format</label>
              <select
                id="ratio"
                value={settings.vertical ? "v" : "h"}
                onChange={(e) => update({ vertical: e.target.value === "v" })}
              >
                <option value="v">Vertical 9:16 (Shorts, Reels, TikTok)</option>
                <option value="h">Landscape 16:9 (YouTube)</option>
              </select>
            </div>
            <div>
              <label htmlFor="quality">Quality</label>
              <select
                id="quality"
                value={settings.quality}
                onChange={(e) => update({ quality: e.target.value === "1080p" ? "1080p" : "720p" })}
              >
                <option value="720p">720p (faster)</option>
                <option value="1080p">1080p (sharper)</option>
              </select>
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="background">Background</label>
              <select
                id="background"
                value={settings.background}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isBackgroundPreset(value)) update({ background: value });
                }}
              >
                {BACKGROUND_OPTIONS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="music">Music</label>
              <select
                id="music"
                value={settings.music}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "none" || isMusicTrackId(value)) update({ music: value });
                }}
              >
                <option value="none">No music</option>
                {GENERATED_TRACKS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label htmlFor="volume">Music volume: {Math.round(settings.musicVolume * 100)}%</label>
          <input
            id="volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.musicVolume}
            onChange={(e) => update({ musicVolume: Number(e.target.value) })}
          />
          {music.status === "error" ? <p className="error">{music.message}</p> : null}

          <label className="check">
            <input
              type="checkbox"
              checked={settings.effects}
              onChange={(e) => update({ effects: e.target.checked })}
            />
            Sound effects (clock ticks, answer chime)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showMascot}
              onChange={(e) => update({ showMascot: e.target.checked })}
            />
            Show the little mascot
          </label>

          <label htmlFor="title">Title card text (empty = default)</label>
          <input
            id="title"
            value={settings.titleText}
            maxLength={70}
            placeholder={texts.title}
            onChange={(e) => update({ titleText: e.target.value })}
          />
          <label htmlFor="outro">Ending text (empty = default)</label>
          <input
            id="outro"
            value={settings.outroText}
            maxLength={70}
            placeholder={texts.outro}
            onChange={(e) => update({ outroText: e.target.value })}
          />

          <h2>3. My account</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showBadge}
              onChange={(e) => update({ showBadge: e.target.checked })}
            />
            Show my account (name and picture) in the video
          </label>
          {settings.showBadge ? (
            <>
              <div className="badge-preview">
                <img src={profileSrc} alt="Profile" />
                <button type="button" className="ghost" onClick={() => profileInputRef.current?.click()}>
                  Change picture
                </button>
                <input
                  ref={profileInputRef}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void chooseProfile(e)}
                />
              </div>
              {profileError ? <p className="error">{profileError}</p> : null}
              <div className="row">
                <div>
                  <label htmlFor="badge-name">Account name</label>
                  <input
                    id="badge-name"
                    value={settings.badgeName}
                    maxLength={MAX_BADGE_NAME}
                    onChange={(e) => update({ badgeName: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="badge-position">Position</label>
                  <select
                    id="badge-position"
                    value={settings.badgePosition}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (isBadgePosition(value)) update({ badgePosition: value });
                    }}
                  >
                    {BADGE_POSITIONS.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <section className="panel preview-panel">
          <h2>Preview</h2>
          <canvas
            ref={canvasRef}
            className={settings.vertical ? "preview vertical" : "preview landscape"}
            aria-label="Video preview"
          />

          <div className="player">
            <button
              type="button"
              className="primary"
              disabled={exporting}
              onClick={() => (playing ? pause() : setPlaying(true))}
            >
              {playing ? "Pause" : timeMs >= timeline.totalMs ? "Replay" : "Play"}
            </button>
            <input
              type="range"
              aria-label="Position"
              min={0}
              max={timeline.totalMs}
              value={Math.min(timeMs, timeline.totalMs)}
              onChange={(e) => {
                pause();
                seek(Number(e.target.value));
              }}
            />
            <span className="time">
              {formatTime(timeMs)} / {formatTime(timeline.totalMs)}
            </span>
          </div>
          {soundMessage ? <p className="hint">{soundMessage}</p> : null}

          <div className="actions">
            {exporting ? (
              <button type="button" className="ghost" onClick={() => abortRef.current?.abort()}>
                Cancel ({Math.round(progress * 100)}%)
              </button>
            ) : (
              <button
                type="button"
                className="primary big"
                disabled={!exportSupported() || !soundReady}
                onClick={() => void runExport()}
              >
                Export video (WebM)
              </button>
            )}
            <button type="button" className="ghost" onClick={saveThumbnail}>
              Save thumbnail (PNG)
            </button>
          </div>
          {exporting ? (
            <progress className="bar" max={1} value={progress} />
          ) : null}
          {!exportSupported() ? (
            <p className="error">Video export needs a recent Chrome or Edge.</p>
          ) : null}
          {status ? <p className="ok">{status}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <p className="hint">
            Length: {formatTime(timeline.totalMs)}. The file is WebM with sound; YouTube accepts
            it directly.
          </p>
        </section>
      </main>
    </div>
  );
}
