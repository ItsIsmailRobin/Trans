// Speech-to-text for TranscribeFix: in-browser Whisper or an OpenAI-compatible API.
export const LOCAL_MODELS = [
  ['onnx-community/whisper-base', 'Whisper Base: fast, about 80 MB'],
  ['onnx-community/whisper-small', 'Whisper Small: better, about 250 MB'],
  ['onnx-community/whisper-large-v3-turbo', 'Whisper Large v3 Turbo: best, about 1 GB, needs a GPU browser'],
];
export const API_PRESETS = {
  groq: { name: 'Groq', url: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3' },
  openai: { name: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-transcribe' },
  custom: { name: 'Other (OpenAI-compatible)', url: '', model: '' },
};
export const DEFAULT_PROMPT = 'হ্যাঁ, আমি জানি। আপনি কি আসবেন? আচ্ছা, ঠিক আছে।';

/* ---------- local worker ---------- */
let worker = null, seq = 0;
const pending = new Map();
let dlHandler = null;
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./asr-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data: m }) => {
    if (m.type === 'dl') return dlHandler && dlHandler(m);
    if (m.type === 'ready') return dlHandler && dlHandler(m);
    const p = pending.get(m.id); if (!p) return;
    pending.delete(m.id);
    m.type === 'result' ? p.res(m.text) : p.rej(new Error(m.error));
  };
  worker.onerror = e => { pending.forEach(p => p.rej(new Error(e.message || 'Speech model failed to load'))); pending.clear(); worker = null };
  return worker;
}
export function onModelProgress(fn) { dlHandler = fn }
export function localTranscribe(audio, model) {
  const id = ++seq;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); getWorker().postMessage({ type: 'run', id, model, audio }, [audio.buffer]) });
}
export function stopLocal() {
  if (worker) worker.terminate();
  worker = null;
  pending.forEach(p => p.rej(new Error('Stopped'))); pending.clear();
}

/* ---------- API ---------- */
export function wav(f32, sr = 16000) {
  const b = new ArrayBuffer(44 + f32.length * 2), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + f32.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, f32.length * 2, true);
  for (let i = 0; i < f32.length; i++) { const s = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true) }
  return new Blob([b], { type: 'audio/wav' });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function apiTranscribe(audio, cfg, signal) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const fd = new FormData();
    fd.append('file', wav(audio), 'segment.wav');
    fd.append('model', cfg.model);
    fd.append('language', 'bn');
    fd.append('response_format', 'json');
    fd.append('temperature', '0');
    if (cfg.prompt) fd.append('prompt', cfg.prompt);
    const r = await fetch(cfg.url.replace(/\/+$/, '') + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.key }, body: fd, signal });
    if (r.status === 429) { await sleep((+r.headers.get('retry-after') || 5 * (attempt + 1)) * 1000); continue }
    if (!r.ok) {
      let msg = r.status + ' ' + r.statusText;
      try { const j = await r.json(); msg = (j.error && (j.error.message || j.error)) || msg } catch {}
      if (r.status === 401) msg = 'API key was rejected. Check the key in Transcribe settings.';
      throw new Error(msg);
    }
    const j = await r.json();
    return (j.text || '').trim();
  }
  throw new Error('Rate limit reached. Wait a minute and run Transcribe again.');
}
