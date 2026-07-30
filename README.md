# Make a Video

**Make a Video** is an agent skill that guides you from an initial idea to a checked, locally rendered MP4. It combines a conversational production workflow with [HyperFrames](https://github.com/heygen-com/hyperframes) for video creation and Google's Gemini text-to-speech for optional voice-over.

You can use it for explainers, promos, social clips, slideshows, motion graphics, and other video formats. The skill works in the language of your conversation and does not assume a fixed brand, person, voice, aspect ratio, or visual style.

## What it does

The skill helps you:

- turn an idea into a clear brief, concept, script, and storyboard;
- collect and verify source material;
- choose the audience, channel, duration, aspect ratio, style, and pace;
- build and preview the production with HyperFrames;
- generate one voice-over file per scene with your own Gemini API key;
- check visuals, timing, audio, resolution, codecs, and transitions;
- render and deliver a verified MP4.

The agent asks only for information that is still missing and recommends sensible defaults when useful.

## Requirements

- Node.js 22 or newer
- `npx`
- FFmpeg and `ffprobe`
- an agent that supports installable skills
- the [HyperFrames skill](https://hyperframes.heygen.com/quickstart)
- a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) when you want Gemini voice-over

Gemini TTS is a preview service. Availability, usage limits, and possible costs are managed through your own Google project.

## Installation

Install Make a Video globally:

```bash
npx skills add robbertvanempel/makeavideo -g
```

Install HyperFrames as well:

```bash
npx skills add heygen-com/hyperframes
```

Restart your agent if it does not discover newly installed skills immediately.

## Getting started

Start a new conversation with your agent and say, for example:

> Create a 60-second video explaining how solar panels work for secondary-school students.

The skill will:

1. check whether the required local tools and API key are available;
2. help you complete and confirm the creative brief;
3. create the script, storyboard, visuals, timing, and optional voice-over;
4. open and inspect a browser preview;
5. render and verify the final MP4.

You can supply your own text, URLs, documents, images, video clips, logos, music, data, or brand guidelines. If you want the agent to choose, it can recommend defaults and continue.

## Gemini API key setup

The skill never asks you to paste an API key into chat. It accepts `GEMINI_API_KEY` or `GOOGLE_API_KEY` from your environment, or stores the key outside your projects using a hidden terminal prompt:

```bash
node "/absolute/path/to/makeavideo/scripts/setup.mjs" --set-key
```

Check the local setup with:

```bash
node "/absolute/path/to/makeavideo/scripts/setup.mjs" --status
```

Optionally verify the configured key:

```bash
node "/absolute/path/to/makeavideo/scripts/setup.mjs" --verify-key
```

The stored credential is readable only by the current user. It is never passed as a command-line argument, written into a video project, or committed to Git.

## Workflow

### 1. Brief and sources

The agent captures the goal, core message, audience, destination, format, duration, language, style, brand rules, supplied media, and factual sources. User-provided information remains separate from assumptions.

### 2. Production

The installed HyperFrames workflow is selected for the requested format. The agent creates the production files, ingests media, builds the scenes, and aligns animation with the narrative.

### 3. Voice-over

When requested, Gemini TTS creates a separate WAV file for each scene using a suitable voice and performance direction. Each file is checked for valid audio, duration, audibility, pronunciation, and completeness.

### 4. Quality control and delivery

The agent runs HyperFrames checks, inspects snapshots and the browser preview, fixes visual or timing problems, renders the MP4, and verifies its video and audio streams before delivery.

## Repository contents

- `SKILL.md` — the complete agent workflow and safety rules
- `scripts/setup.mjs` — dependency checks and secure Gemini key setup
- `scripts/gemini_tts.mjs` — per-scene Gemini TTS generation with retry and WAV output
- `agents/openai.yaml` — agent metadata

## Privacy and publishing

All production work is local unless you explicitly ask the agent to upload or publish the result. No API key, personal identity, fixed voice, brand, or private content is bundled with this skill.
