import './style.css';
import { NS_GROUPS, STYLE, EMO, BG_PLAIN, BG_INT, INT, lint, fix, fmt, parseT } from './rules.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const S = { f: {}, url: {}, au: {}, ab: {}, buf: {}, env: {}, dur: {}, mx: {}, pk: {}, lis: {}, mute: {}, wc: {}, pcm: {},
  segs: [], cur: null, pt: 0, rate: 1, loop: false, both: false, hist: [], fut: [], ta: null, zoom: 1, playing: false, master: 1 };
let ctx = null;
const actx = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
const LH = 64, RH = 18;
const COL = { 1: { wave: '#B8450A', fill: 'rgba(232,89,12,', edge: '#E8590C' }, 2: { wave: '#14599C', fill: 'rgba(25,113,194,', edge: '#1971C2' } };
let pps = 100, Wd = 900, D = 0, rng = null, raf = 0, tmr = 0;
const st = (m, e) => { const x = $('#st'); x.textContent = m; x.className = e ? 'err' : '' };
const ns = () => [1, 2].filter(n => S.buf[n]);
const LOW = .03; // detection sensitivity is always Low: catches quiet sounds too
const thr = n => Math.max((S.mx[n] || 0) * LOW, .002);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ================= audio: add / replace / remove ================= */
async function loadFile(n, f) {
  if (!f) return;
  if (!/^(audio|video)\//.test(f.type) && !/\.(wav|mp3|m4a|aac|ogg|oga|opus|flac|webm|mp4)$/i.test(f.name)) return st(f.name + ' is not an audio file.', 1);
  stop();
  st('Loading ' + f.name + '…');
  try {
    const b = await actx().decodeAudioData(await f.arrayBuffer());
    clearAudio(n);
    S.f[n] = f; S.url[n] = URL.createObjectURL(f);
    S.au[n] = new Audio(S.url[n]); S.au[n].preservesPitch = true; S.au[n].muted = !!S.mute[n];
    const d = mix(b), fr = Math.floor(b.sampleRate / 100), L = Math.floor(d.length / fr), en = new Float32Array(L);
    let pk = 0, mx = 0;
    for (let i = 0; i < L; i++) { let s = 0; for (let j = 0; j < fr; j += 4) { const v = d[i * fr + j]; s += v * v; if (Math.abs(v) > pk) pk = Math.abs(v) } en[i] = Math.sqrt(s / (fr / 4)); if (en[i] > mx) mx = en[i] }
    S.ab[n] = b; S.buf[n] = d; S.env[n] = en; S.dur[n] = b.duration; S.pk[n] = pk || 1; S.mx[n] = mx; S.lis[n] = new Uint8Array(Math.ceil(b.duration));
    chips(); layout(); restore(n); render(); lbl();
    st('Loaded ' + f.name + '. ' + (S.segs.length ? '' : 'Next: Auto-segment, fix the edges, then Add transcript.'));
  } catch (x) { st('Could not read ' + f.name + '. Try WAV, MP3 or M4A.', 1) }
}
// one track from all channels: keep whichever channel is louder at each sample, so speech on either side is never missed
function mix(b) {
  if (b.numberOfChannels < 2) return b.getChannelData(0);
  const ch = [...Array(b.numberOfChannels)].map((_, i) => b.getChannelData(i)), out = new Float32Array(b.length);
  for (let i = 0; i < b.length; i++) { let v = 0; for (const c of ch) if (Math.abs(c[i]) > Math.abs(v)) v = c[i]; out[i] = v }
  return out;
}
function clearAudio(n) {
  if (S.au[n]) { S.au[n].pause(); S.au[n].src = '' }
  if (S.url[n]) URL.revokeObjectURL(S.url[n]);
  for (const k of ['f', 'url', 'au', 'ab', 'buf', 'env', 'dur', 'mx', 'pk', 'lis', 'wc']) delete S[k][n];
}
function removeAudio(n) {
  const mine = S.segs.filter(g => g.sp === n);
  if (mine.length && !confirm(`Remove Speaker ${n} audio and its ${mine.length} line${mine.length > 1 ? 's' : ''}? Your work stays saved for that file, and Undo brings the lines back.`)) return;
  stop(); save(true);
  hist(); clearAudio(n);
  S.segs = S.segs.filter(g => g.sp !== n); if (S.cur && S.cur.sp === n) S.cur = null;
  chips(); layout(); render(); lbl(); save();
  st(`Speaker ${n} audio removed. Choose a new file for Speaker ${n}.`);
}
function chips() {
  [1, 2].forEach(n => {
    const has = !!S.f[n];
    $('#chip' + n).classList.toggle('has', has);
    $('#n' + n).textContent = has ? S.f[n].name : 'Add audio';
    $('#rm' + n).hidden = !has;
  });
  $('#empty').hidden = ns().length > 0 || S.segs.length > 0;
}
[1, 2].forEach(n => {
  const inp = $('#f' + n);
  inp.onchange = e => { const f = e.target.files[0]; e.target.value = ''; loadFile(n, f) };
  $('#rm' + n).onclick = () => removeAudio(n);
  dropZone($('#chip' + n), f => loadFile(n, f));
});
$$('.drop').forEach(d => {
  const n = +d.dataset.n, inp = d.querySelector('input');
  inp.onchange = e => { const f = e.target.files[0]; e.target.value = ''; loadFile(n, f) };
  dropZone(d, f => loadFile(n, f));
});
function dropZone(el, cb) {
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag') });
  el.addEventListener('dragleave', () => el.classList.remove('drag'));
  el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) cb(f) });
}
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());

/* ================= waveform ================= */
function layout() {
  const l = ns();
  $('#wave').hidden = !l.length;
  [1, 2].forEach(n => { const on = !!S.buf[n]; $('#c' + n).style.display = on ? 'block' : 'none'; $('#lb' + n).style.display = on ? 'flex' : 'none' });
  if (!l.length) { D = 0; head(); return }
  D = Math.max(...l.map(n => S.dur[n]));
  const vw = $('#cv').clientWidth || 800;
  Wd = Math.min(30000, Math.floor(vw * S.zoom)); pps = Wd / D; $('#in').style.width = Wd + 'px';
  S.wc = {}; draw();
}
function cache(n) {
  if (S.wc[n]) return S.wc[n];
  const c = document.createElement('canvas'); c.width = Wd; c.height = LH;
  const g = c.getContext('2d'); g.fillStyle = COL[n].wave;
  const a = S.buf[n], N = a.length, k2 = N / S.dur[n], sc = LH * .46 / S.pk[n];
  for (let x = 0; x < Wd; x++) {
    const i0 = Math.floor(x / pps * k2), i1 = Math.floor((x + 1) / pps * k2); if (i0 >= N) break;
    let mn = 0, mx = 0; const sp = Math.max(1, Math.floor((i1 - i0) / 10));
    for (let i = i0; i < i1 && i < N; i += sp) { const v = a[i]; if (v < mn) mn = v; if (v > mx) mx = v }
    g.fillRect(x, LH / 2 - mx * sc, 1, Math.max(1, (mx - mn) * sc));
  }
  return S.wc[n] = c;
}
function draw() {
  ns().forEach(n => {
    const c = $('#c' + n); c.width = Wd; c.height = LH;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, Wd, LH);
    S.segs.filter(s => s.sp === n).forEach(s => {
      const sel = s === S.cur, x = s.start * pps, w = Math.max(2, (s.end - s.start) * pps);
      g.fillStyle = COL[n].fill + (sel ? .3 : .12) + ')'; g.fillRect(x, 0, w, LH);
      g.fillStyle = COL[n].edge; const ew = sel ? 3 : 1.5; g.fillRect(x, 0, ew, LH); g.fillRect(x + w - ew, 0, ew, LH);
      if (hasErr(s)) { g.fillStyle = '#E03131'; g.fillRect(x, 0, w, 3) }
    });
    g.drawImage(cache(n), 0, 0);
  });
  ruler(); head();
}
function ruler() {
  const c = $('#rl'); c.width = Wd; c.height = RH;
  const g = c.getContext('2d'); g.fillStyle = '#F3F5F8'; g.fillRect(0, 0, Wd, RH); g.fillStyle = '#5E6B7D'; g.font = '600 10px Manrope, sans-serif';
  const stp = [.5, 1, 2, 5, 10, 30, 60, 120].find(v => v * pps >= 70) || 120;
  for (let t = 0; t < D; t += stp) { g.fillRect(t * pps, RH - 6, 1, 6); g.fillText(fmt(t).replace(/^00:/, ''), t * pps + 3, 12) }
}
function head() {
  const x = S.pt * pps; $('#ph').style.left = x + 'px'; $('#tm').textContent = fmt(S.pt) + ' / ' + fmt(D);
  const cv = $('#cv'); if (S.playing && (x < cv.scrollLeft || x > cv.scrollLeft + cv.clientWidth - 40)) cv.scrollLeft = Math.max(0, x - 60);
}
const lp = n => { const a = S.lis[n]; return a && a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 100) : 0 };
const lbl = () => [1, 2].forEach(n => $('#ls' + n).textContent = 'Heard ' + lp(n) + '%');
const tAt = (e, c) => (e.clientX - c.getBoundingClientRect().left) / pps;
[1, 2].forEach(n => {
  const c = $('#c' + n); let m = null;
  const edge = t => { const px = 6 / pps; return S.segs.find(s => s.sp === n && (Math.abs(s.start - t) < px || Math.abs(s.end - t) < px)) };
  c.onmousemove = e => { if (!m) c.style.cursor = edge(tAt(e, c)) ? 'ew-resize' : 'crosshair' };
  c.onmousedown = e => {
    const t = tAt(e, c), ed = edge(t);
    if (ed) { hist(); m = { k: Math.abs(ed.start - t) < 6 / pps ? 's' : 'e', s: ed } }
    else { const hit = S.segs.find(s => s.sp === n && t >= s.start && t <= s.end); if (hit) { select(hit, {}); S.pt = t; head(); return } m = { k: 'n', a: t, b: t } }
    window.onmousemove = ev => {
      const x = Math.max(0, Math.min(S.dur[n], tAt(ev, c)));
      if (m.k == 's') m.s.start = Math.min(x, m.s.end - .05); else if (m.k == 'e') m.s.end = Math.max(x, m.s.start + .05); else m.b = x;
      draw();
      if (m.k == 'n') { const g = c.getContext('2d'); g.fillStyle = 'rgba(22,32,46,.18)'; g.fillRect(Math.min(m.a, m.b) * pps, 0, Math.abs(m.b - m.a) * pps, LH) }
    };
    window.onmouseup = () => {
      window.onmousemove = window.onmouseup = null; const q = m; m = null;
      if (q.k == 'n') {
        if (Math.abs(q.b - q.a) < .08) { select(null); S.pt = q.a; head(); return }
        hist(); const g = { sp: n, start: Math.min(q.a, q.b), end: Math.max(q.a, q.b), text: '' }; snap(g, 15);
        S.segs.push(g); sortSegs(); render(); select(g, { focus: true }); save();
      } else fin();
    };
  };
  c.ondblclick = e => { const t = tAt(e, c), h = S.segs.find(s => s.sp === n && t >= s.start && t <= s.end); if (h) select(h, { play: true }) };
});
$('#rl').onclick = e => { S.pt = tAt(e, $('#rl')); S.cur = null; $$('#rows .row').forEach(r => r.classList.remove('sel')); draw() };
$$('.mu').forEach(b => b.onclick = () => { const n = +b.dataset.n; S.mute[n] = !S.mute[n]; b.classList.toggle('on', S.mute[n]); b.textContent = S.mute[n] ? 'Muted' : 'Mute'; if (S.au[n]) S.au[n].muted = !!S.mute[n] });
$('#zm').oninput = e => { S.zoom = +e.target.value; layout() };
window.onresize = () => { clearTimeout(tmr); tmr = setTimeout(layout, 150) };

/* ================= playback ================= */
const ui = () => { $('#pp').innerHTML = `<svg><use href="#i-${S.playing ? 'pause' : 'play'}"/></svg>` };
function stop() { Object.values(S.au).forEach(a => a.pause()); S.playing = false; cancelAnimationFrame(raf); rng = null; ui() }
function playRange(s, e, sps) {
  stop(); sps = sps.filter(n => S.au[n]); if (!sps.length) return;
  rng = { s, e, sps }; S.master = sps[0];
  sps.forEach(n => { const a = S.au[n]; a.currentTime = s; a.playbackRate = S.rate; a.muted = !!S.mute[n]; a.play().catch(() => {}) });
  S.playing = true; ui(); tick();
}
function tick() {
  const a = S.au[S.master]; if (!a || !rng) return;
  S.pt = a.currentTime;
  rng.sps.forEach(n => { const l = S.lis[n], i = Math.floor(S.au[n].currentTime); if (l && i < l.length) l[i] = 1 }); lbl();
  if (a.currentTime >= rng.e || a.ended) { if (S.loop) return playRange(rng.s, rng.e, rng.sps); const e = rng.e; stop(); S.pt = Math.min(e, D); head(); return }
  head(); raf = requestAnimationFrame(tick);
}
const trk = s => S.both ? [s.sp, ...ns().filter(n => n !== s.sp)] : [s.sp];
const playSeg = s => playRange(s.start, s.end, trk(s));
function toggle() { if (S.playing) return stop(); if (S.cur) playSeg(S.cur); else playRange(S.pt >= D - .05 ? 0 : S.pt, D, ns()) }
function jump(d) { S.pt = Math.max(0, Math.min(D, S.pt + d)); if (S.playing && rng) playRange(S.pt, rng.e, rng.sps); else head() }
function step(d, play) { const v = visible(), i = v.indexOf(S.cur), g = v[i < 0 ? 0 : i + d]; if (g) select(g, { play, focus: true }) }
$('#pp').onclick = toggle; $('#bk').onclick = () => jump(-2); $('#fw').onclick = () => jump(2);
$('#pv').onclick = () => step(-1, true); $('#nx').onclick = () => step(1, true);
$('#lp').onclick = e => { S.loop = !S.loop; e.currentTarget.classList.toggle('on', S.loop) };
$('#bt').onclick = e => { S.both = !S.both; e.currentTarget.classList.toggle('on', S.both) };
$('#rt').onchange = e => { S.rate = +e.target.value; Object.values(S.au).forEach(a => a.playbackRate = S.rate) };

/* ================= checks (text rules + timing) ================= */
function tl(s) {
  const m = [], e = S.env[s.sp];
  if (s.end <= s.start) m.push('End must be after start');
  if (S.dur[s.sp] && s.end > S.dur[s.sp] + .01) m.push('Past the end of the audio');
  const own = S.segs.filter(q => q.sp === s.sp), p = own[own.indexOf(s) - 1];
  if (p) { if (p.end > s.start + .001) m.push('Overlaps the previous line of this speaker'); else if (s.start - p.end < 1) m.push('Under 1s after the previous line: merge them (4.3)') }
  if (e) {
    const th = thr(s.sp), a = Math.round(s.start * 100), b = Math.min(Math.round(s.end * 100), e.length - 1);
    let f = a; while (f < b && e[f] <= th) f++;
    let l = b; while (l > a && e[l] <= th) l--;
    if (f - a > 30) m.push('~Silence padding at start (over 0.3s)');
    if (b - l > 30) m.push('~Silence padding at end (over 0.3s)');
    if (a > 2 && e[a] > th * 2.5 && e[a - 3] > th) m.push('~Word may be clipped at start');
    if (e[b] > th * 2.5 && e[Math.min(e.length - 1, b + 3)] > th) m.push('~Word may be clipped at end');
  }
  return m;
}
const lintAll = s => lint(s.text).concat(tl(s));
const hasErr = s => lintAll(s).some(m => m[0] !== '~');
function snap(g, w = 40) {
  const e = S.env[g.sp]; if (!e) return;
  const th = thr(g.sp), a = Math.round(g.start * 100), b = Math.round(g.end * 100); let s = null, t = null;
  for (let i = Math.max(0, a - w); i <= Math.min(e.length - 1, a + w); i++) if (e[i] > th) { s = i; break }
  for (let i = Math.min(e.length - 1, b + w); i >= Math.max(0, b - w); i--) if (e[i] > th) { t = i; break }
  if (s !== null) g.start = Math.max(0, s / 100 - .03);
  if (t !== null) g.end = Math.min(S.dur[g.sp], t / 100 + .05);
  if (g.end <= g.start) g.end = g.start + .1;
}

/* ================= lines ================= */
const sortSegs = () => S.segs.sort((a, b) => a.start - b.start || a.sp - b.sp);
function fin() { sortSegs(); render(); draw(); save() }
function visible() {
  const f = $('#flt').value;
  return S.segs.filter(s => f === '0' ? true : f === 'e' ? hasErr(s) : f === 'u' ? !s.ok : s.sp === +f);
}
function render() {
  const tb = $('#rows'); tb.textContent = '';
  const vis = new Set(visible());
  S.segs.forEach((s, i) => {
    if (!vis.has(s)) return;
    const el = document.createElement('div'); el.className = 'row s' + s.sp; el._s = s;
    el.innerHTML = `<div class="rn"><span class="no">${i + 1}</span><span class="spk">S${s.sp}</span></div>
<div class="rt"><input class="tm" aria-label="Start time" value="${fmt(s.start)}"><input class="tm" aria-label="End time" value="${fmt(s.end)}"><span class="du">${(s.end - s.start).toFixed(2)}s</span></div>
<div class="rb"><textarea class="tx" rows="1" spellcheck="false" placeholder="Speaker ${s.sp}…"></textarea><div class="msgs"></div></div>
<div class="ra"><span class="dot"></span><label class="rv" title="Reviewed by ear"><input type="checkbox"></label><button class="ic pl" title="Play line"><svg><use href="#i-play"/></svg></button><button class="ic del" title="Delete line"><svg><use href="#i-x"/></svg></button></div>`;
    const [t0, t1] = el.querySelectorAll('.tm'), ta = el.querySelector('.tx'), rv = el.querySelector('.rv input');
    ta.value = s.text; rv.checked = !!s.ok;
    t0.onchange = () => { const v = parseT(t0.value); if (v !== null) { hist(); s.start = v } fin() };
    t1.onchange = () => { const v = parseT(t1.value); if (v !== null) { hist(); s.end = v } fin() };
    ta.onfocus = () => { S.ta = ta; tagHint(); if (S.cur !== s) select(s, { scroll: false }) };
    ta.onblur = () => { s._h = 0 };
    ta.oninput = () => {
      if (!s._h) { hist(); s._h = 1 }
      if (/\n/.test(ta.value)) ta.value = ta.value.replace(/\n/g, ' ');
      s.text = ta.value; delete s.fx; grow(ta); row(el); cnt(); save(); draw();
    };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); step(1, true) } };
    el.onclick = e => { if (!e.target.closest('input,textarea,button,label')) select(s, { play: true }) };
    rv.onchange = () => { s.ok = rv.checked; row(el); cnt(); save() };
    el.querySelector('.pl').onclick = () => select(s, { play: true });
    el.querySelector('.del').onclick = () => { hist(); S.segs.splice(S.segs.indexOf(s), 1); if (S.cur === s) S.cur = null; fin(); chips() };
    tb.appendChild(el); row(el); grow(ta);
  });
  cnt(); chips();
  $$('#rows .row').forEach(r => r.classList.toggle('sel', r._s === S.cur));
}
function grow(ta) { if (CSS.supports && CSS.supports('field-sizing', 'content')) return; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px' }
function row(el) {
  const s = el._s, m = lintAll(s), bad = m.some(x => x[0] !== '~');
  el.querySelector('.dot').className = 'dot' + (bad ? ' bad' : m.length ? ' warn' : '');
  el.querySelector('.dot').title = bad ? 'Has errors' : m.length ? 'Has warnings' : 'No problems found';
  const box = el.querySelector('.msgs'); box.textContent = '';
  if (s.fx !== undefined) { const d = document.createElement('span'); d.className = 'm d'; d.textContent = 'Auto-fixed'; d.title = 'Before: ' + (s.fx || '(empty)'); box.appendChild(d) }
  m.forEach(x => { const d = document.createElement('span'); d.className = 'm' + (x[0] === '~' ? ' w' : x === 'Empty: add text' ? ' n' : ''); d.textContent = x.replace(/^~/, ''); box.appendChild(d) });
}
function refresh(s) { const el = $$('#rows .row').find(r => r._s === s); if (el) { const ta = el.querySelector('.tx'); if (document.activeElement !== ta) ta.value = s.text; grow(ta); row(el) } }
function cnt() {
  let e = 0, w = 0;
  S.segs.forEach(s => { const m = lintAll(s); if (m.some(x => x[0] !== '~')) e++; else if (m.length) w++ });
  const p = $('#cnt');
  p.textContent = S.segs.length ? `${e} with errors, ${w} with warnings, ${S.segs.filter(g => g.ok).length} of ${S.segs.length} reviewed` : 'No lines yet';
  p.className = 'pill' + (e ? ' bad' : '');
}
function select(s, o = {}) {
  S.cur = s; const rs = $$('#rows .row'); rs.forEach(r => r.classList.toggle('sel', r._s === s));
  if (s) {
    const el = rs.find(r => r._s === s); S.pt = s.start;
    const cv = $('#cv'), x = s.start * pps; if (x < cv.scrollLeft || x > cv.scrollLeft + cv.clientWidth - 60) cv.scrollLeft = Math.max(0, x - 80);
    if (el && o.scroll !== false) el.scrollIntoView({ block: 'nearest' });
    if (o.focus && el) el.querySelector('.tx').focus();
    if (o.play) playSeg(s);
  }
  draw();
}
$('#flt').onchange = render;

/* ================= editing tools ================= */
const snapJ = () => JSON.stringify(S.segs.map(({ _h, ...r }) => r));
function hist() { S.hist.push([snapJ(), S.segs.indexOf(S.cur)]); if (S.hist.length > 150) S.hist.shift(); S.fut = [] }
function swap(a, b) { const [j, i] = a.pop(); b.push([snapJ(), S.segs.indexOf(S.cur)]); S.segs = JSON.parse(j); S.cur = S.segs[i] || null; render(); draw(); save() }
const undo = () => S.hist.length && swap(S.hist, S.fut), redo = () => S.fut.length && swap(S.fut, S.hist);
$('#un').onclick = undo; $('#re').onclick = redo;
function region(n, t) {
  const e = S.env[n]; if (!e) return null; const th = thr(n);
  let i = Math.round(t * 100); while (i < e.length && e[i] <= th) i++; if (i >= e.length) return null;
  let j = i, q = 0; while (j < e.length && q < 100) { q = e[j] > th ? 0 : q + 1; j++ }
  return { start: Math.max(0, i / 100 - .03), end: Math.min(S.dur[n], (j - q) / 100 + .05) };
}
function addAt(n) {
  if (!S.buf[n]) return st('Add Speaker ' + n + ' audio first.', 1);
  const r = region(n, S.pt) || { start: S.pt, end: Math.min(S.dur[n], S.pt + 1.5) };
  hist(); const g = { sp: n, start: r.start, end: r.end, text: '' }; S.segs.push(g); sortSegs(); render(); select(g, { focus: true }); save();
}
$('#a1').onclick = () => addAt(1); $('#a2').onclick = () => addAt(2);
function autoSeg(quiet) {
  if (!ns().length) { st('Add audio first.', 1); return false }
  if (!quiet && S.segs.some(g => g.text.trim()) && !confirm('Replace all lines with new auto-segments? Undo brings them back.')) return false;
  hist();
  ns().forEach(n => {
    const e = S.env[n], th = thr(n), r = []; let s = -1, last = -1;
    for (let i = 0; i < e.length; i++) { if (e[i] > th) { if (s < 0) s = i; last = i } else if (s >= 0 && i - last >= 100) { r.push([s, last]); s = -1 } }
    if (s >= 0) r.push([s, last]);
    S.segs = S.segs.filter(g => g.sp !== n);
    // keep every sound, even very short ones; pad a little so no word is clipped
    r.forEach(([a, b]) => {
      const s0 = Math.max(0, a / 100 - .05); let e0 = Math.min(S.dur[n], (b + 1) / 100 + .05);
      if (e0 - s0 < .15) e0 = Math.min(S.dur[n], s0 + .15);
      S.segs.push({ sp: n, start: s0, end: e0, text: '' });
    });
  });
  S.cur = null; fin();
  if (!quiet) st(S.segs.length + ' lines created, split only at 1s+ silences. Check the edges, then Add transcript.');
  return true;
}
$('#as').onclick = () => autoSeg(false);
function split() {
  const s = S.cur && S.pt > S.cur.start + .05 && S.pt < S.cur.end - .05 ? S.cur : S.segs.find(q => S.pt > q.start + .05 && S.pt < q.end - .05);
  if (!s) return st('Put the playhead inside a line to split it.', 1);
  hist(); const b = { sp: s.sp, start: S.pt, end: s.end, text: '' }; s.end = S.pt; S.segs.push(b); sortSegs(); render(); select(b, { focus: true }); save();
}
function merge() {
  const s = S.cur; if (!s) return st('Select a line first.', 1);
  const n = S.segs.find(q => q.sp === s.sp && q.start > s.start); if (!n) return st('No next line for this speaker.', 1);
  hist(); s.text = (s.text + ' ' + n.text).trim(); s.end = n.end; S.segs.splice(S.segs.indexOf(n), 1); fin(); select(s, {});
}
function snapSel() { if (!S.cur) return st('Select a line first.', 1); hist(); snap(S.cur, 60); fin() }
$('#sp').onclick = split; $('#mg').onclick = merge; $('#sn').onclick = snapSel;
function fixAll() {
  if (!S.segs.length) return st('No lines to fix yet.', 1);
  hist(); let c = 0;
  S.segs.forEach(g => { const t = fix(g.text); if (t !== g.text) { if (g.fx === undefined) g.fx = g.text; g.text = t; c++ } });
  render(); draw(); save();
  const bad = S.segs.filter(hasErr).length;
  st(`Fixed ${c} line${c === 1 ? '' : 's'}. ` + (bad ? `${bad} line${bad === 1 ? ' still needs' : 's still need'} you (red dot): choose "With errors" to see only those.` : 'No errors left. Listen and tick Reviewed.'), false);
}
$('#af').onclick = fixAll;

/* ================= tag sidebar ================= */
let inten = 'পরিষ্কার';
const recent = JSON.parse(localStorage['tf:recent'] || '[]');
const sq = (t, en, extra = {}) => ({ l: '[' + t + ']', o: '[' + t + ']', p: 1, en, ...extra });
const pair = (t, en, cls) => ({ l: '<' + t + '>', o: '<' + t + '>', c: '</' + t + '>', p: 1, en, cls });
const TAGS = [
  ...NS_GROUPS.map(([g, a]) => ({ g, items: a.map(([t, en]) => sq(t, en)) })),
  { g: 'বৈদেশিক কথা', items: [pair('বৈদেশিক', 'foreign, language unknown', 'sty'), { l: '<বৈদেশিক="EN">', o: '<বৈদেশিক="EN">', c: '</বৈদেশিক>', p: 1, en: 'foreign, language known (EN, ES, FR…)', cls: 'sty' }] },
  { g: 'কথার ধরন', items: STYLE.map(([t, en]) => pair(t, en, 'sty')) },
  { g: 'আবেগ', note: 'rare: under 1% of words', items: EMO.map(([t, en]) => pair(t, en, 'emo')) },
  { g: 'পটভূমির শব্দ', items: BG_PLAIN.map(([t, en]) => sq(t, en, { bg: 1 })) },
  { g: 'পটভূমি, তীব্রতাসহ', int: 1, items: BG_INT.map(([t, en]) => ({ l: '[' + t + '-…]', base: t, p: 1, en, bg: 1 })) },
  { g: 'চিহ্ন', items: [
    { l: '{PRO: }', o: '{PRO: ', c: '}', t: 1, en: 'how a number or acronym was said', cls: 'mk', pro: 1 },
    { l: '{MIS: }', o: '{MIS: ', c: '}', t: 1, en: 'what was mispronounced', cls: 'mk', pro: 1 },
    { l: '*জোর*', o: '*', c: '*', t: 1, en: 'emphasis', cls: 'mk' },
    { l: '{{note}}', o: '{{', c: '}}', t: 1, en: 'reviewer note', cls: 'mk' },
    { l: '--', o: '-- ', en: 'cut-off / restart', cls: 'mk' },
    { l: ' - ', o: ' - ', en: 'stutter or floating dash', cls: 'mk' },
    { l: '...', o: '...', en: 'trail off / resume', cls: 'mk' },
    { l: '।', o: '।', en: 'দাঁড়ি', cls: 'mk' },
  ] },
];
const ALL = TAGS.flatMap(g => g.items.map(k => ({ ...k, g: g.g })));
const resolve = k => k.base ? { ...k, l: `[${k.base}-${inten}]`, o: `[${k.base}-${inten}]` } : k;
function tagBtn(k, first) {
  const r = resolve(k), b = document.createElement('button');
  b.className = 'tag' + (k.cls ? ' ' + k.cls : '') + (first ? ' first' : '');
  b.innerHTML = `<span>${esc(r.l)}</span><small>${esc(k.en || '')}</small>`;
  b.title = r.l + (k.en ? ' (' + k.en + ')' : '');
  b.onmousedown = e => { e.preventDefault(); put(r) };
  return b;
}
function drawTags() {
  const q = $('#tq').value.trim().toLowerCase(), box = $('#tagbox'); box.textContent = '';
  let first = !!q;
  const mk = (title, items, extra) => {
    if (!items.length) return;
    const g = document.createElement('div'); g.className = 'tgrp';
    g.innerHTML = `<h4><span>${esc(title)}</span>${extra || ''}</h4>`;
    const c = document.createElement('div'); c.className = 'chips';
    items.forEach(k => { c.appendChild(tagBtn(k, first)); first = false });
    g.appendChild(c); box.appendChild(g);
  };
  if (!q && recent.length) mk('সম্প্রতি ব্যবহৃত', recent.map(l => ALL.find(k => k.l === l || (k.base && l.startsWith('[' + k.base + '-')))).filter(Boolean).slice(0, 8));
  TAGS.forEach(G => {
    const items = G.items.filter(k => !q || (k.l + ' ' + (k.base || '') + ' ' + (k.en || '') + ' ' + G.g).toLowerCase().includes(q));
    if (G.int) {
      if (!items.length) return;
      const g = document.createElement('div'); g.className = 'tgrp';
      g.innerHTML = `<h4><span>${esc(G.g)}</span><em>pick intensity</em></h4>`;
      const sw = document.createElement('div'); sw.className = 'intn';
      INT.forEach(([w, en]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = w; b.title = en; b.className = w === inten ? 'on' : ''; b.onmousedown = e => { e.preventDefault(); inten = w; drawTags() }; sw.appendChild(b) });
      const c = document.createElement('div'); c.className = 'chips';
      items.forEach(k => { c.appendChild(tagBtn(k, first)); first = false });
      g.append(sw, c); box.appendChild(g); return;
    }
    mk(G.g, items, G.note ? `<em>${esc(G.note)}</em>` : '');
  });
  if (!box.children.length) box.innerHTML = '<p class="hint">No tag matches. Try an English word like cough, laugh or door.</p>';
}
function tagHint() {
  const h = $('#thint'), s = S.ta && S.ta.closest('.row');
  if (s) { h.textContent = `Inserting into line ${S.segs.indexOf(s._s) + 1}. Select words first to wrap them in a style tag.`; h.className = 'hint on' }
}
function put(k) {
  let ta = S.ta;
  if (!ta || !document.body.contains(ta)) { const el = $$('#rows .row').find(r => r._s === S.cur); ta = el && el.querySelector('.tx') }
  if (!ta) return st('Click inside a line first, then pick a tag.', 1);
  const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value, sel = v.slice(a, b); let s, c;
  if (k.c) { s = k.t ? k.o + sel + k.c : k.o + ' ' + sel + (sel ? ' ' : '') + k.c; c = k.t ? k.o.length + sel.length : k.o.length + 1 + sel.length }
  else { s = k.o; c = s.length }
  if (k.p || k.pro) { const L = a > 0 && v[a - 1] !== ' ' ? ' ' : '', R = !k.pro && v[b] && v[b] !== ' ' ? ' ' : ''; s = L + s + R; c = k.c ? c + L.length : s.length }
  ta.value = v.slice(0, a) + s + v.slice(b); ta.setSelectionRange(a + c, a + c); ta.focus(); ta.dispatchEvent(new Event('input'));
  const i = recent.indexOf(k.l); if (i >= 0) recent.splice(i, 1); recent.unshift(k.l); recent.length = Math.min(recent.length, 12);
  try { localStorage['tf:recent'] = JSON.stringify(recent) } catch {}
}
$('#tq').oninput = drawTags;
$('#tq').onkeydown = e => {
  if (e.key === 'Enter') { e.preventDefault(); const b = $('#tagbox .tag'); if (b) { b.dispatchEvent(new MouseEvent('mousedown')); $('#tq').value = ''; drawTags() } }
  if (e.key === 'Escape') { $('#tq').value = ''; drawTags(); if (S.ta) S.ta.focus() }
};
$$('.tabs button').forEach(b => b.onclick = () => {
  $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  $$('.pane').forEach(p => p.hidden = p.id !== 'tab-' + b.dataset.tab);
});

/* ================= save / import / export ================= */
const key = () => 'tf:' + [1, 2].map(n => S.f[n] ? S.f[n].name + S.f[n].size : '-').join('|');
function save(now) {
  clearTimeout(save.t);
  const w = () => { try { if (S.segs.length) localStorage[key()] = snapJ() } catch {} };
  now === true ? w() : save.t = setTimeout(w, 400);
}
function restore(n) {
  try {
    const j = localStorage[key()]; if (!j) return;
    const saved = JSON.parse(j);
    if (!S.segs.length) S.segs = saved;
    else if (n && !S.segs.some(g => g.sp === n)) { S.segs.push(...saved.filter(g => g.sp === n)); sortSegs() }
    else return;
    setTimeout(() => st('Restored your saved work for these files.'), 0);
  } catch {}
}
/* ================= add transcript (paste or file) ================= */
const tdlg = $('#tdlg');
const info = (m, e) => { const x = $('#tinfo'); x.textContent = m; x.style.color = e ? 'var(--err)' : '' };
$('#addt').onclick = () => { info(''); tdlg.querySelector(`input[name=tmode][value=${S.segs.length ? 'keep' : 'replace'}]`).checked = true; tdlg.showModal(); $('#tin').focus() };
const readInto = async f => { $('#tin').value = await f.text(); info(f.name + ' loaded. Check the text, then press Add transcript.') };
$('#tfile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) readInto(f) };
$('#tin').addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) { e.preventDefault(); e.stopPropagation(); readInto(f) } });
const TIME = '(\\d{1,2}:\\d{2}(?::\\d{2})?(?:[.,]\\d+)?|\\d+(?:\\.\\d+)?)';
const pT = v => v == null || v === '' ? null : typeof v === 'number' ? v : parseT(String(v).replace(',', '.'));
const spOf = v => { if (v == null) return 0; const t = String(v).trim(), m = t.match(/[12১২]/); return m ? (/[1১]/.test(m[0]) ? 1 : 2) : /^a$/i.test(t) ? 1 : /^b$/i.test(t) ? 2 : 0 };
const SPK = /^\s*(?:speaker|spk|s|বক্তা|স্পিকার)\s*[_-]?\s*([12১২])\s*[:：)\-–]\s*/i;
function parseTranscript(t) {
  t = t.replace(/^\uFEFF/, '').trim(); if (!t) return [];
  if (/^[\[{]/.test(t)) {
    try {
      let j = JSON.parse(t); if (!Array.isArray(j)) j = j.segments || j.lines || j.data || j.transcript || j.utterances || [];
      return j.map(g => typeof g === 'string' ? { sp: 0, start: null, end: null, text: g.trim() } : {
        sp: spOf(g.speaker ?? g.sp ?? g.spk ?? g.channel ?? g.speaker_id),
        start: pT(g.start ?? g.start_time ?? g.startTime ?? g.begin ?? g.from), end: pT(g.end ?? g.end_time ?? g.endTime ?? g.to),
        text: String(g.text ?? g.transcript ?? g.content ?? g.sentence ?? '').trim() }).filter(x => x.text);
    } catch {}
  }
  const R = new RegExp('^\\s*\\[?\\s*' + TIME + '\\s*(?:-->|-|–|to)\\s*' + TIME + '\\s*\\]?\\s*(.*)$');
  const out = []; let pend = null;
  for (const line of t.split(/\r?\n/)) {
    if (/^\s*(WEBVTT|NOTE)\b/.test(line)) continue;
    if (!line.trim()) { pend = null; continue }
    if (/^\s*\d+\s*$/.test(line) && !pend) continue; // SRT counter
    const m = line.match(R); let rest = m ? m[3] : line, sp = 0;
    const sm = rest.match(SPK); if (sm) { sp = /[1১]/.test(sm[1]) ? 1 : 2; rest = rest.slice(sm[0].length) }
    rest = rest.trim();
    if (m && !rest) { pend = { start: pT(m[1]), end: pT(m[2]), sp }; continue }
    if (!m && pend) { const last = out[out.length - 1]; if (last && last._p === pend) last.text += ' ' + rest; else out.push({ sp: sp || pend.sp, start: pend.start, end: pend.end, text: rest, _p: pend }); continue }
    out.push({ sp, start: m ? pT(m[1]) : null, end: m ? pT(m[2]) : null, text: rest });
  }
  return out.filter(x => x.text);
}
const itemLine = i => (i.start != null ? `[${fmt(i.start)} - ${fmt(i.end)}] ` : '') + (i.sp ? `Speaker ${i.sp}: ` : '') + i.text;
function addTranscript() {
  const items = parseTranscript($('#tin').value);
  if (!items.length) return info('No text found. Paste one segment per line.', 1);
  const mode = tdlg.querySelector('input[name=tmode]:checked').value;
  const timed = items.every(i => i.start != null && i.end != null && isFinite(i.start) && isFinite(i.end) && i.end > i.start);
  if (mode === 'replace' && !timed) return info('This text has no times on every line. Choose "Into my current lines".', 1);
  if (mode === 'keep' && !S.segs.length) return info('There are no lines yet. Auto-segment first, or choose "Replace my lines".', 1);
  hist();
  const used = new Set(), left = [];
  if (mode === 'replace') {
    S.segs = items.map(i => ({ sp: i.sp || 1, start: i.start, end: i.end, text: i.text })); S.segs.forEach(s => used.add(s));
  } else {
    sortSegs();
    if (timed) {
      items.forEach(i => {
        let best = null, bo = 0;
        S.segs.forEach(s => { if (i.sp && s.sp !== i.sp) return; const o = Math.min(s.end, i.end) - Math.max(s.start, i.start); if (o > bo) { bo = o; best = s } });
        if (!best) return left.push(i);
        best.text = used.has(best) ? best.text + ' ' + i.text : i.text; used.add(best);
      });
    } else {
      const perSp = items.every(i => i.sp);
      const q = { 0: [...S.segs], 1: S.segs.filter(s => s.sp === 1), 2: S.segs.filter(s => s.sp === 2) };
      items.forEach(i => { const s = q[perSp ? i.sp : 0].shift(); if (s) { s.text = i.text; used.add(s) } else left.push(i) });
    }
  }
  if ($('#tfix').checked) used.forEach(s => { const t = fix(s.text); if (t !== s.text) { s.fx = s.text; s.text = t } else delete s.fx });
  else used.forEach(s => delete s.fx);
  used.forEach(s => s.ok = false);
  S.cur = null; fin(); chips();
  const empty = S.segs.filter(s => !s.text.trim()).length, bad = S.segs.filter(hasErr).length;
  const msg = `Added text to ${used.size} line${used.size === 1 ? '' : 's'}.` + (empty ? ` ${empty} line${empty === 1 ? ' is' : 's are'} still empty.` : '') + (bad ? ` ${bad} line${bad === 1 ? ' still needs' : 's still need'} you (red dot).` : '');
  st(msg, false);
  if (left.length) { $('#tin').value = left.map(itemLine).join('\n'); info(`${left.length} text line${left.length === 1 ? '' : 's'} had no matching line and ${left.length === 1 ? 'is' : 'are'} left in the box. Add lines for them, or choose "Replace my lines".`, 1) }
  else { $('#tin').value = ''; tdlg.close() }
}
$('#tgo').onclick = addTranscript;
const download = (n, t) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain;charset=utf-8' })); a.download = n; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) };
$('#xj').onclick = () => { $('.menu').open = false; download('transcript.json', JSON.stringify(S.segs.map((s, i) => ({ id: i + 1, speaker: s.sp, start: +s.start.toFixed(2), end: +s.end.toFixed(2), text: s.text, ok: !!s.ok })), null, 2)) };
$('#xt').onclick = () => { $('.menu').open = false; download('transcript.txt', S.segs.map(s => `[${fmt(s.start)} - ${fmt(s.end)}] Speaker ${s.sp}: ${s.text}`).join('\n')) };
document.addEventListener('click', e => { const m = $('.menu'); if (m.open && !m.contains(e.target)) m.open = false });

/* ================= hotkeys ================= */
document.onkeydown = e => {
  if (tdlg.open) return;
  const inp = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  if ((e.key === 'Enter' && e.ctrlKey) || (e.code === 'Space' && !inp)) { e.preventDefault(); return toggle() }
  if (!e.altKey) return;
  const m = {
    ArrowDown: () => step(1, true), ArrowUp: () => step(-1, true), ArrowLeft: () => jump(-2), ArrowRight: () => jump(2),
    KeyL: () => $('#lp').click(), KeyB: () => $('#bt').click(), KeyN: () => addAt(S.cur ? S.cur.sp : ns()[0] || 1),
    KeyS: split, KeyM: merge, KeyT: snapSel, KeyZ: undo, KeyY: redo,
    KeyK: () => { $$('.tabs button')[0].click(); $('#tq').focus(); $('#tq').select() },
    KeyF: fixAll,
  }[e.code];
  if (m) { e.preventDefault(); m() }
};
window.addEventListener('beforeunload', () => save(true));

drawTags(); chips(); render(); lbl(); head();
