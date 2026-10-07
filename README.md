# TranscribeFix

Manual Bengali 2-speaker transcription workbench. No AI, no API, no server: it runs fully in the browser.

## Run
    npm install
    npm run dev      # http://localhost:5173
    npm run build    # outputs dist/

## Deploy on Vercel
Push this folder to GitHub, then import it in Vercel. It is detected as a Vite project (build `npm run build`, output `dist`). No environment variables.
The style guide is confidential: enable Vercel Deployment Protection (password) on the project.

## Workflow
1. Pick Speaker 1 and Speaker 2 audio. Import a machine transcript (JSON or `[00:01.20 - 00:03.50] Speaker 1: text`) if you have one, or press Auto-segment.
2. Select a line: it plays. Type the text; insert tags from the palette. Enter moves to the next line.
3. Fix timestamps by dragging edges, typing times, or Snap. Use Both to hear both speakers on hard parts.
4. Clear every red dot, tick Reviewed, export.

Hotkeys: Space / Ctrl+Enter play-pause, Alt+Up/Down line, Alt+Left/Right 2s, Alt+L loop, Alt+B both, Alt+N new line, Alt+S split, Alt+M merge, Alt+T snap, Alt+Z / Alt+Y undo / redo.
Work autosaves in this browser per pair of audio files.
