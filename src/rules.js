/* TranscribeFix rules, synced with:
   - BN 2-speaker Style Guide v3.1.5 (Sep 1, 2026)
   - BN Tag Taxonomy (preliminary)
   Messages starting with "~" are warnings; everything else is an error. */

const LET = '\\u0980-\\u09FFA-Za-z';
const NB = `(?<![${LET}])`, NA = `(?![${LET}])`;

/* ---------------- tag taxonomy ---------------- */
// [tag, english hint]
const NS_GROUPS = [
  ['শ্বাস ও বাতাস', [['নিঃশ্বাস','breath'],['শ্বাস-নেওয়া','inhale'],['শ্বাস-ছাড়া','exhale'],['দীর্ঘশ্বাস','sigh'],['শোঁকা','sniff'],['হাঁফ','gasp'],['ফুঁ','blow']]],
  ['হাসি', [['হাসি','laugh'],['মৃদু-হাসি','chuckle'],['খিলখিল-হাসি','giggle'],['নাসিকাধ্বনি','snort'],['বিদ্রূপ','scoff']]],
  ['প্রচেষ্টা ও আবেগ', [['ঘোঁৎঘোঁৎ','grunt'],['গোঙানি','groan'],['কান্না','cry']]],
  ['স্বরভঙ্গি', [['গুঞ্জন','hum a tune'],['উল্লাসধ্বনি','whoop'],['শিস','whistle']]],
  ['মুখের ক্লিক ও পপ', [['টকাস-শব্দ','tongue click'],['চুকচুক-শব্দ','tsk'],['চপচপ','lip smack'],['দাঁত-চোষার-শব্দ','teeth suck'],['ঠোঁট-ট্রিল','lip trill'],['চুপ','shush']]],
  ['স্বাভাবিক প্রতিক্রিয়া', [['ঢোক-গেলা','swallow'],['গলা-পরিষ্কার','clear throat'],['কাশি','cough'],['হাঁচি','sneeze'],['হাই','yawn'],['হেঁচকি','hiccup']]],
  ['অন্যান্য', [['অবোধগম্য','unintelligible'],['অন্যান্য-মৌখিক-শব্দ','other mouth sound, add a {{note}}'],['বৈদেশিক','foreign speech you cannot transcribe']]],
];
const STYLE = [['হাসিমাখা-কথা','laugh-speak'],['গান/সুর','sing-song'],['প্রসারিত','elongated word'],['অভিনয়ধর্মী','affected voice'],['বিকৃত','distorted audio']];
const EMO = [['উচ্ছ্বসিত','excited, joyful'],['বিষণ্ণ','sad'],['ক্রুদ্ধ','angry'],['ভীত','fearful'],['আস্থাশীল','reassuring, calm'],['ঘৃণাপূর্ণ','contempt, disgust'],['প্রত্যাশামূলক','anticipation'],['বিস্মিত','surprised']];
const BG_PLAIN = [['গান','music'],['বাতাস','wind'],['অন্যান্য-আবহাওয়া','other weather'],['ঘেউ-ঘেউ','dog bark'],['পাখির-কিচিরমিচির','birds'],['অন্যান্য-পশুর-ডাক','other animal'],['হর্ন','horn'],['সাইরেন','siren'],['রেলগাড়ি','train'],['রাস্তা-অন্যান্য','street noise'],['পাখা','fan'],['অ্যালার্ম','alarm, beep, ringtone'],['দরজা','door'],['পটভূমি-কথা','background speech'],['শিশুর-কান্না','baby crying']];
// these require an intensity suffix
const BG_INT = [['ঠকঠক','tap, knock, typing'],['পিছনের শব্দ-অন্যান্য','other background noise'],['স্ট্যাটিক','static (degraded gold only)'],['যান্ত্রিক-গুঞ্জন','mechanical hum (degraded gold only)']];
const INT = [['ধীর','faint: needs focused listening'],['পরিষ্কার','clear at normal volume'],['উচ্চস্বর','as loud as speech or louder']];
const INT_DIGIT = { '০':'ধীর','১':'পরিষ্কার','২':'উচ্চস্বর','0':'ধীর','1':'পরিষ্কার','2':'উচ্চস্বর' };

const NS = NS_GROUPS.flatMap(g => g[1].map(x => x[0]));
const ST = [...STYLE, ...EMO].map(x => x[0]).concat('বৈদেশিক');
const EMO_N = EMO.map(x => x[0]);
const BGP = BG_PLAIN.map(x => x[0]);
const BGI = BG_INT.map(x => x[0]);

const FILLERS = { 'ওহহহো':'ওহহো','হুহ-হুহ':'হু-হু','আহ-হা':'আহা','আআআ':'আ','অঅঅ':'অ','হুউউ':'হু','হুমম':'হুম','হুহহ':'হুহ','হেহহ':'হেহ','ম-হুম':'মহুম','আহহ':'আহ','অউউ':'অউ','এহহ':'এহ','ওহহ':'ওহ','অহহ':'ওহ','উউহ':'উহ','মহম':'মহুম','হুউ':'হু','আআ':'আ','অঅ':'অ','হম':'হুম' };
const FILL_RE = new RegExp(NB + '(' + Object.keys(FILLERS).join('|') + ')' + NA, 'g');
const REDUP_OK = new Set(['হু','হা','হি','হে','টুক','ঘেউ','মিউ']); // real reduplicated words, not stutters
const MONTHS = 'জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর|January|February|March|April|May|June|July|August|September|October|November|December';

/* tokens: {{note}}, {PRO:..}, [..], <..> */
const TOK = /(\{\{[^}]*\}\}|\{[^}]*\}|\[[^\]]*\]|<[^>]*>)/;
const plain = x => x.replace(/\{\{[^}]*\}\}|\{[^}]*\}|\[[^\]]*\]|<[^>]*>/g, ' ');
const TAIL = /(?:\s*(?:\[[^\]]*\]|<\/[^>]*>|\{\{[^}]*\}\}|\{[^}]*\}))+\s*$/;
const ENDP = /(।|\?|!|…|\.\.\.|--)["”’'»)]*$/;

function sqTag(k) {
  if (NS.includes(k) || BGP.includes(k)) return null;
  if (k === 'অন্যান্য-শব্দ') return 'Renamed tag: use [অন্যান্য-মৌখিক-শব্দ] (v3.1.4)';
  for (const b of BGI) {
    if (k === b) return `[${b}] needs intensity: [${b}-ধীর], [${b}-পরিষ্কার] or [${b}-উচ্চস্বর]`;
    if (k.startsWith(b + '-')) {
      const s = k.slice(b.length + 1);
      if (INT.some(i => i[0] === s)) return null;
      if (INT_DIGIT[s]) return `~Use the word intensity: [${b}-${INT_DIGIT[s]}]`;
      return `Unknown intensity "${s}": use ধীর, পরিষ্কার or উচ্চস্বর`;
    }
  }
  for (const b of BGP) if (k.startsWith(b + '-')) return `[${b}] takes no intensity suffix`;
  return `Unknown tag [${k}]`;
}

function lint(x) {
  const m = [], add = s => { if (!m.includes(s)) m.push(s) };
  if (!x.trim()) return ['Not transcribed yet'];

  // end punctuation (tags go after it)
  const tm = x.match(TAIL), tail = tm ? tm[0] : '', core = (tm ? x.slice(0, x.length - tail.length) : x).trim();
  const unint = /^\s*\[অবোধগম্য\]/.test(tail);
  if (core && !ENDP.test(core) && !unint) {
    if (/[A-Za-z0-9]["”’']*\.$/.test(core)) { /* English sentence ending with "." */ }
    else if (/\.$/.test(core)) add('Use দাঁড়ি "।" to end a Bengali sentence, not "."');
    else add('Segment must end with punctuation: । ? ! … or -- (3.1)');
  }
  if (/(\]|>|\})\s*([।?!]+|…|\.\.\.)\s*$/.test(x) && /\S/.test(core)) {
    if (/\{MIS:[^}]*\}\s*[।?!….]+\s*$/.test(x)) add('~Punctuation goes before a trailing {MIS:}: "ফলাফল। {MIS: ফলাফব}" (3.1)');
    else if (!/\}\s*[।?!….]+\s*$/.test(x)) add('Put punctuation before the tag, e.g. "কি বললে এটা? [হাঁফ]" (3.1)');
  }

  // square tags
  for (const r of x.matchAll(/\[([^\]]+)\]/g)) { const e = sqTag(r[1]); if (e) add(e) }
  if (/(\[[^\]]+\])\s*\1/.test(x)) add('Same tag twice in a row: tag it once (6.2.3)');

  // angle tags: known, closed, properly nested, emotions not overlapping
  const stack = []; let emoOpen = 0, emoStart = -1;
  for (const r of x.matchAll(/<(\/?)\s*([^>=\s]+)\s*(=\s*["“”']?([A-Za-z]{2,3})?["“”']?)?\s*>/g)) {
    const close = !!r[1], k = r[2];
    if (!ST.includes(k)) { add(`Unknown tag <${k}>`); continue }
    if (r[3] && k !== 'বৈদেশিক') add(`<${k}> takes no attribute`);
    if (r[3] && !r[4]) add('Language code needed, e.g. <বৈদেশিক="EN">');
    if (!close) {
      if (EMO_N.includes(k)) { if (emoOpen) add('Emotion tags must not overlap (6.5.3)'); emoOpen++; emoStart = r.index + r[0].length }
      stack.push(k);
    } else {
      if (!stack.length) { add('Closing tag without opening: </' + k + '>'); continue }
      const top = stack.pop();
      if (top !== k) add(`Tags cross: <${top}> must close before </${k}>`);
      if (EMO_N.includes(k)) {
        emoOpen = Math.max(0, emoOpen - 1);
        const words = plain(x.slice(emoStart, r.index)).trim().split(/\s+/).filter(Boolean).length;
        if (words > 50) add('~Emotion tag over 50 words: is all of it clearly emotional? (6.5.4)');
      }
    }
  }
  stack.forEach(k => add(`Unclosed tag <${k}>: add </${k}>`));

  // curly
  if (/\{(PRO|MIS):[^}]*[\[<]/.test(x)) add('No tags inside {PRO:} or {MIS:} (6.2.3)');
  for (const r of x.replace(/\{\{[^}]*\}\}/g, '').matchAll(/\{([^}]*)\}/g)) if (!/^(PRO|MIS):/.test(r[1])) add(`Unknown {${r[1]}}: use {PRO: …}, {MIS: …} or {{note}}`);
  if (/\{(PRO|MIS):\s*\}/.test(x)) add('Empty {PRO:} or {MIS:}');

  // numbers need {PRO: …} right after them
  const nx = x.replace(/\{\{[^}]*\}\}/g, s => ' '.repeat(s.length));
  for (const r of nx.matchAll(/[০-৯0-9]+(?:[,.:ঃ/][০-৯0-9]+)*/g)) {
    const i = r.index, before = nx.slice(0, i), after = nx.slice(i + r[0].length);
    if (/\{[^}]*$/.test(before)) continue; // inside {PRO:/MIS:}
    const win = after.slice(0, 45), p = win.indexOf('{PRO:');
    if (p >= 0 && !/[।?!]/.test(win.slice(0, p))) continue;
    if (new RegExp('^(ই|শে|’শে|\'শে|’এ|\'এ|এ|লা|রা|ঠা)?\\s*(' + MONTHS + ')').test(after)) continue; // ১৬ই ডিসেম্বর
    if (/[A-Za-z][-\s]?$/.test(before) || /^[-\s]?[A-Za-z]/.test(after) || /\//.test(r[0])) { add('~Number without {PRO:}: fine only for names and events like PlayStation 5, COVID-19, 9/11 (2.7.5)'); continue }
    add('Number needs {PRO: …} right after it, e.g. ১৪ {PRO: চোদ্দ} (2.7.3)');
  }

  // dashes
  if (/--[^\s"”’'.\])>-]/.test(x)) add('"--" must be followed by a space (3.4.2)');
  if (/\S\s+--(\s|$)/.test(x)) add('~"--" attaches to the word before it: "চাই-- আমি" (3.4.2)');
  if (/[—–]/.test(x)) add('Use a floating dash " - " instead of "—" (3.4.2)');
  const px = plain(x);
  for (const r of px.matchAll(new RegExp(NB + `([${LET}]+)-\\1` + NA, 'g'))) if (!REDUP_OK.has(r[1])) { add('Stutter needs dash + space: "আমি - আমি" (2.5.1)'); break }

  // spacing, fillers, stretched letters
  if (/\S\s{2,}\S/.test(x)) add('Double space');
  if (/^\s|\s$/.test(x)) add('~Leading or trailing space');
  if (/(\.\.\.|…)\s+[^\s<\[{]/.test(x.replace(/(\.\.\.|…)\s*$/, ''))) add('~Resumed text joins the ellipsis: "...এরপরে" (3.4.1)');
  for (const r of px.matchAll(FILL_RE)) add(`Filler spelling: "${r[1]}" → "${FILLERS[r[1]]}" (2.8)`);
  if (/([\u0980-\u09FFA-Za-z])\1{3,}/.test(px.replace(/[০-৯0-9]/g, ''))) add('Letters stretched: write the word once inside <প্রসারিত> (6.3)');
  if (/(।|\?|!){2,}/.test(x.replace(/\?!/g, ''))) add('~Repeated punctuation');

  // tag spacing
  for (const r of x.matchAll(/\[[^\]]+\]/g)) {
    const b = x[r.index - 1], a = x[r.index + r[0].length];
    if ((b !== undefined && !/[\s“"‘'(]/.test(b)) || (a !== undefined && !/[\s।?!]/.test(a) && !x.startsWith('{{', r.index + r[0].length))) { add('Space needed around [tag] (6.2.3)'); break }
  }
  for (const r of x.matchAll(/<\/?[^>]+>/g)) {
    const close = r[0][1] === '/', b = x[r.index - 1], a = x[r.index + r[0].length];
    const bad = close ? (b !== undefined && !/\s/.test(b)) || (a !== undefined && !/[\s।?!]/.test(a))
                      : (a !== undefined && !/\s/.test(a)) || (b !== undefined && !/[\s“"‘'(]/.test(b));
    if (bad) { add('Style tags need a space between tag and words: "<প্রসারিত> কঠিন </প্রসারিত>" (6.3.2)'); break }
  }

  // light style checks
  if ((x.match(/\*[^*\s][^*]*\*/g) || []).length > 2) add('~Too much emphasis: keep *জোর* for clear cases (6.6)');
  if (/^[a-z]/.test(x.replace(/^[^A-Za-z\u0980-\u09FF]+/, ''))) add('~Capitalize the first English word (3.2)');
  if (/(ডঃ|ডা\.|মিঃ|(^|\s)(Dr|Mr|Mrs|Ms)\.|&|(^|\s)(kg|km|cm)(?![A-Za-z]))/.test(px)) add('~Abbreviation or symbol: write it in full as spoken (2.7.1)');
  if (/[০-৯0-9]\s*(am|pm|a\.m\.?|p\.m\.?|A\.M\.?|P\.M\.?)(?![A-Za-z])/.test(x) || /[০-৯0-9](AM|PM)/.test(x)) add('~Write time like "2:30 PM": capitals, no dots, one space (2.7.8)');
  return m;
}

/* ---------------- automatic fixes ---------------- */
function fix(x) {
  x = String(x).replace(/\s+/g, ' ').trim();
  if (!x) return x;
  x = x.replace(/\s*[—–]\s*/g, ' - ').replace(/\[অন্যান্য-শব্দ\]/g, '[অন্যান্য-মৌখিক-শব্দ]');
  x = x.replace(/\[([^\]]+)-([০-২0-2])\]/g, (s, b, d) => BGI.includes(b) ? `[${b}-${INT_DIGIT[d]}]` : s);

  // text-only fixes (never touch anything inside tags)
  const parts = x.split(TOK);
  for (let i = 0; i < parts.length; i += 2) {
    let p = parts[i];
    p = p.replace(FILL_RE, k => FILLERS[k]);
    p = p.replace(new RegExp(NB + `([${LET}]+)-(?=\\1` + NA + ')', 'g'), (s, w) => REDUP_OK.has(w) ? s : w + ' - ');
    p = p.replace(/--(?=[^\s"”’'.\])>-])/g, '-- ');
    parts[i] = p;
  }
  // spaces around [..] and <..>; one space before {..}
  let out = '';
  parts.forEach((p, i) => {
    if (i % 2 === 0) { out += p; return }
    const curly = p[0] === '{', note = p.startsWith('{{');
    if (out && !/\s$/.test(out) && !(note && /\]$/.test(out)) && !/[“"‘'(]$/.test(out)) out += ' ';
    out += p;
    const nx = parts[i + 1] || '';
    if (nx && /^[^\s।?!]/.test(nx) && !(curly && /^[,]/.test(nx))) out += ' ';
  });
  x = out.replace(/(\[[^\]]+\])(\s*\1)+/g, '$1').replace(/\s+/g, ' ').trim();

  // move end punctuation from after the trailing tags to before them
  const mv = x.match(/^(.*?\S)((?:\s*(?:\[[^\]]*\]|<\/[^>]*>|\{\{[^}]*\}\}|\{[^}]*\}))+)\s*([।?!]+|…|\.\.\.)$/);
  if (mv && !ENDP.test(mv[1])) x = mv[1] + mv[3] + mv[2];

  // add missing end punctuation
  const tm = x.match(TAIL), tail = tm ? tm[0] : '', core = tm ? x.slice(0, x.length - tail.length) : x;
  if (/<[^>]*$|\[[^\]]*$|\{[^}]*$/.test(x)) return x.replace(/\s+/g, ' ').trim(); // broken tag: leave for the user
  if (core.trim() && !ENDP.test(core.trim()) && !/^\s*\[অবোধগম্য\]/.test(tail) && !/\.["”’']*$/.test(core.trim()))
    x = core.trimEnd() + (/[A-Za-z]["”’']*$/.test(core.trim()) ? '.' : '।') + tail;
  return x.replace(/\s+/g, ' ').trim();
}

const fmt = t => { t = Math.max(0, t); const m = Math.floor(t / 60); return String(m).padStart(2, '0') + ':' + (t - m * 60).toFixed(2).padStart(5, '0') };
const parseT = s => { s = String(s).trim(); if (!s) return null; const p = s.split(':').map(Number); if (p.some(isNaN) || p.length > 3) return null; return p.reduce((a, b) => a * 60 + b, 0) };

export { NS_GROUPS, STYLE, EMO, BG_PLAIN, BG_INT, INT, NS, ST, lint, fix, fmt, parseT };
