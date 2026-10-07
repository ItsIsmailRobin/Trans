# TranscribeFix 2

Bengali 2-speaker transcription workbench, synced with the BN Style Guide v3.1.5 and the BN Tag Taxonomy.
Runs in the browser; nothing is stored on a server.

## Run
    npm install
    npm run dev      # http://localhost:5173
    npm run build    # outputs dist/

## Deploy on Vercel
Push this folder to GitHub and import it in Vercel. It is detected as a Vite project (build `npm run build`, output `dist`). No environment variables.
The style guide is confidential: turn on Vercel Deployment Protection (password) for the project.

## Workflow
1. Add Speaker 1 and Speaker 2 audio (click or drag a file onto the chip). Click a file name to replace it, or ✕ to remove it.
2. Press **Transcribe** for a Bengali machine draft (it runs Auto-segment first if there are no lines), or Import a machine transcript.
   - **In this browser**: free and private Whisper. The model downloads once (Small ≈ 250 MB), then is cached.
   - **Online API**: best accuracy. Works with Groq (`whisper-large-v3`), OpenAI (`gpt-4o-transcribe`) or any OpenAI-compatible endpoint, using your own key (kept only in this browser).
3. Select a line to play it. Correct the text; insert tags from the Tags panel (search in Bengali or English, Alt+K, Enter inserts the first match).
4. Fix timestamps by dragging edges, typing times, or Snap. Use Both to hear both speakers on hard parts.
5. Run Fix rules, clear every red dot, tick Reviewed, export.

Lines show "Machine draft" until you edit or review them. Work autosaves in this browser per pair of audio files.
