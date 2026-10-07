// Runs Whisper in the browser (WebGPU when available, otherwise WASM).
// Model files download once from Hugging Face and are cached by the browser.
import { pipeline, env } from '@huggingface/transformers';
env.allowLocalModels = false;

let asr = null, loaded = '';

async function load(model) {
  if (asr && loaded === model) return;
  let device = 'wasm', f16 = false;
  try {
    const ad = self.navigator.gpu && await self.navigator.gpu.requestAdapter();
    if (ad) { device = 'webgpu'; f16 = ad.features.has('shader-f16') }
  } catch {}
  const big = /large/.test(model);
  const dtype = device === 'webgpu'
    ? { encoder_model: big ? (f16 ? 'fp16' : 'q4') : 'fp32', decoder_model_merged: 'q4' }
    : 'q8';
  const progress = p => {
    if (p.status === 'progress') self.postMessage({ type: 'dl', file: p.file, loaded: p.loaded, total: p.total });
  };
  asr = await pipeline('automatic-speech-recognition', model, { device, dtype, progress_callback: progress });
  loaded = model;
  self.postMessage({ type: 'ready', device });
}

self.onmessage = async ({ data: m }) => {
  try {
    if (m.type === 'load') { await load(m.model); return }
    if (m.type === 'run') {
      await load(m.model);
      const out = await asr(m.audio, { language: 'bengali', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
      self.postMessage({ type: 'result', id: m.id, text: (out.text || '').trim() });
    }
  } catch (e) {
    self.postMessage({ type: 'error', id: m.id, error: String(e && e.message || e) });
  }
};
