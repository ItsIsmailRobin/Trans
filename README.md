# TranscribeFix 2.1

Bengali 2-speaker transcription workbench, synced with the BN Style Guide v3.1.5 and the BN Tag Taxonomy.
Runs fully in the browser: no AI, no server, no API keys.

## Run
    npm install
    npm run dev      # http://localhost:5173
    npm run build    # outputs dist/

## Deploy on Vercel
Push this folder to GitHub and import it in Vercel (Vite project: build `npm run build`, output `dist`). No environment variables.
The style guide is confidential: turn on Vercel Deployment Protection (password).

## Workflow
1. Add Speaker 1 and Speaker 2 audio. Click a file name to replace it, ✕ to remove it.
2. **Auto-segment**: splits only at silences of 1s or more and keeps every sound (detection is fixed at Low, all channels are checked).
3. Fix the line edges: drag on the waveform, type times, or Snap.
4. **Add transcript**: paste or upload the text from your transcription site (TXT, JSON, SRT/VTT).
   - Plain lines fill your lines in time order (or per speaker if each line starts with `Speaker 1:` / `Speaker 2:`).
   - Timed lines go into the line they overlap. Anything that doesn't fit stays in the box.
5. **Fix transcript** (Alt+F): fixes spacing, দাঁড়ি, punctuation before tags, stutter dashes, `--`, fillers, tag spelling and spacing,
   English tag names ([laugh] → [হাসি]), intensity, AM/PM, end punctuation. Changed lines show "Auto-fixed" (hover to see the text before).
   Red dots are what only you can fix (for example {PRO:} after numbers). Filter "With errors" to see them.
6. Listen, tick Reviewed, Export.
