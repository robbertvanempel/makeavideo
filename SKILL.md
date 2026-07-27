---
name: makeavideo
description: "Creates a complete video with the user about any user-selected subject, from onboarding, sources, concept, script, and voice-over through a checked HyperFrames preview and rendered MP4. Use when someone wants to create a video, explainer, promo, social clip, animation, slideshow, or other HyperFrames production with step-by-step guidance. Includes a one-time, user-neutral setup for the user's own Google AI Studio Gemini TTS API key; includes no bundled key, brand identity, fixed person, fixed voice, or personal data."
---

# Makeavideo

Create a complete, locally playable video using the user's content and preferences. Respond in the user's language. Never assume a fixed owner, content source, organization, brand style, directory structure, or voice.

## 1. Check the one-time setup

Set `SKILL_DIR` to the directory containing this `SKILL.md` file. Run this before the content intake:

```bash
node "$SKILL_DIR/scripts/setup.mjs" --status --json
```

Never read aloud or display the value of an existing API key. Accept `GEMINI_API_KEY` or `GOOGLE_API_KEY` from the environment; otherwise use this skill's local credential store.

### Missing Gemini TTS key

Guide a new user when `keyConfigured` is `false`:

1. Provide [Google AI Studio – API Keys](https://aistudio.google.com/apikey).
2. Explain: sign in, accept the terms if needed, select or create a project, click **Create API key**, and copy the new key. New keys created in AI Studio are intended for the Gemini API.
3. State that Gemini TTS is a preview service and may have usage limits or costs managed in the user's own Google project.
4. Ask the user to run this command in a local terminal and paste the key once into the hidden prompt:

   ```bash
   node "<absolute-path-to-the-skill>/scripts/setup.mjs" --set-key
   ```

5. Never ask for the key in chat, place it in a project file, or commit it to Git.
6. Wait until the user says setup is complete, rerun the status check, and optionally verify with `--verify-key`.

Refer to [Gemini TTS in AI Studio](https://aistudio.google.com/generate-speech) for voices and examples and to the [Gemini TTS documentation](https://ai.google.dev/gemini-api/docs/speech-generation) for current API details.

### Missing HyperFrames components

During first-time setup, always provide [Install HyperFrames](https://hyperframes.heygen.com/quickstart) and the [heygen-com/hyperframes source repository](https://github.com/heygen-com/hyperframes).

HyperFrames requires Node.js 22 or newer and FFmpeg. Report exactly which check from `setup.mjs` is missing. Install the HyperFrames skills, when the environment and authorization allow it, with:

```bash
npx skills add heygen-com/hyperframes
```

Otherwise ask the user to run this command and restart the agent if necessary. Continue only when Node.js, `npx`, `ffmpeg`, `ffprobe`, the API key, and the HyperFrames skill are available.

## 2. Ask what the user wants to create

After setup succeeds, if the subject has not yet been provided, ask exactly this question, translated into the conversation language:

> What would you like to make a video about?

Use the answer and any supplied files, text, or URLs. Then collect only unanswered choices, one concise question at a time:

- the goal and single core message;
- the audience;
- destination/channel and aspect ratio;
- desired length;
- language and whether to use a voice-over;
- desired style, pace, and any brand rules;
- the user's own images, clips, logos, data, music, or sources.

Recommend a suitable default for every meaningful choice. Skip questions already answered. If the user asks you to decide, record the chosen defaults briefly and continue.

Confirm the completed brief before building. Keep user-provided answers visibly separate from assumptions.

## 3. Lock the content and sources

- Treat supplied text as the content source; do not change facts or meaning without good reason.
- Verify current or disputed claims with primary and authoritative sources, and record links and the as-of date.
- Never invent missing facts, quotes, figures, or private data.
- Ask permission before reusing third-party material when rights or reuse terms are unclear.
- Save final input and sources in the project according to the active HyperFrames workflow, normally in `BRIEF.md` and a concise `SOURCE.md`.

## 4. Build with HyperFrames

Load and follow the installed `hyperframes` skill. Let it choose the correct workflow for the requested deliverable; do not force a faceless explainer when a promo, existing clip, slideshow, motion graphic, or another route fits better.

For a new project, create a descriptive, user-neutral directory in the current workspace unless the user chooses a location. Read applicable `AGENTS.md` files before creating files. Then follow the selected HyperFrames workflow for:

- concept and design;
- `BRIEF.md`, script, and storyboard;
- compositions, timing, and media ingestion;
- preview, checks, snapshots, and visual quality control;
- rendering and technical verification.

Use the requested aspect ratio and duration; do not assume 16:9 or a fixed scene structure. Give each scene one clear narrative movement and make animation support the message.

## 5. Create the voice-over with the user's Gemini key

Skip this step if the user does not want a voice-over. Otherwise choose a suitable Gemini voice and performance direction with the user. Do not use a fixed person's voice as the default.

Create one text file and one WAV file per scene. Generate each clip with:

```bash
node "$SKILL_DIR/scripts/gemini_tts.mjs" \
  --input "<scene-text.txt>" \
  --output "<voice_001.wav>" \
  --voice "<Gemini-voice>" \
  --style "<language, tone, pace, and pronunciation>"
```

Never pass the API key as a command-line argument. The helper reads it from the environment or local credential store. `GEMINI_TTS_MODEL` may override the default model when Google publishes a new TTS model.

Check every audio file with `ffprobe`: require a valid WAV, positive duration, and audible content. Also confirm that the last words were spoken. Regenerate only an empty, truncated, or incorrectly spoken scene. Use actual audio durations for HyperFrames timing.

## 6. Check and deliver

Run at least the active HyperFrames check, midpoint snapshots/contact sheet, browser preview, and visual inspection. Fix text clipping, poor contrast, repetitive scenes, timing errors, and media errors before rendering.

Render the final result to MP4 when the confirmed brief requests it. Use `ffprobe` to verify codec, resolution, frame rate, duration, and audio stream, and sample the beginning, transitions, and ending.

Always include in the final response:

- an absolute local link to the valid MP4;
- duration and aspect ratio;
- the preview link when useful;
- only relevant limitations or source notes.

Do not finish a successful video run with only source files, audio, a contact sheet, or a preview.

## Safety and error handling

- Never log, echo, or commit an API key. Redact errors that could contain secrets.
- On an invalid key, provide the AI Studio link and `setup.mjs --set-key`; never create a temporary key.
- On transient Gemini failures, retry only the affected clip using the helper's retry logic.
- On a HyperFrames check or render failure, repair the smallest affected scope and rerun the relevant check.
- Publish or upload a video only when the user explicitly asks; local rendering and delivery are authorized by a request to create the video.
