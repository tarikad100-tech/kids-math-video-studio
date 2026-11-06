# Mathsy Studio (first version)

Run: `npm install`, then `npm run lint`, `npm run build`, `npm run dev`.

Each video: title card -> N questions (appear, countdown with tick sounds, answer
with chime and confetti) -> ending card. A small original mascot ("Mimo")
reacts. Text language is switchable (English, Arabic, French, Spanish); the
equations themselves use only digits and symbols.

Topics: multiplication, addition, subtraction, simple division, simple fractions
(with a pie picture). Answers are calculated by the program; you can edit any
question (the answer updates for simple forms) or add/delete questions.

Tested here: type-check (with a React stub), real browser run of the whole app,
preview playback, an exported 26 s WebM (VP9 + Opus, 720x1280) whose frames and
sound were inspected. Not tested: `npm run lint`/`build` on your machine,
1080p, landscape export, Arabic export.

Limits: WebM only; needs Chrome or Edge for export; no custom music file yet.
