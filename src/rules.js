const B=a=>a[0].trim().split(/\s+/);
const NS=B`নিঃশ্বাস শ্বাস-নেওয়া শ্বাস-ছাড়া দীর্ঘশ্বাস শোঁকা হাঁফ ফুঁ হাসি মৃদু-হাসি খিলখিল-হাসি নাসিকাধ্বনি বিদ্রূপ ঘোঁৎঘোঁৎ গোঙানি কান্না গুঞ্জন উল্লাসধ্বনি শিস টকাস-শব্দ চুকচুক-শব্দ চপচপ দাঁত-চোষার-শব্দ ঠোঁট-ট্রিল চুপ ঢোক-গেলা গলা-পরিষ্কার কাশি হাঁচি হাই হেঁচকি অবোধগম্য অন্যান্য-শব্দ অন্যান্য-মৌখিক-শব্দ বৈদেশিক`;
const ST=B`হাসিমাখা-কথা গান/সুর প্রসারিত অভিনয়ধর্মী বিকৃত উচ্ছ্বসিত বিষণ্ণ ক্রুদ্ধ ভীত আস্থাশীল ঘৃণাপূর্ণ প্রত্যাশামূলক বিস্মিত বৈদেশিক`;
const BG=/^(গান|বাতাস|অন্যান্য-আবহাওয়া|ঘেউ-ঘেউ|পাখির-কিচিরমিচির|অন্যান্য-পশু-ডাক|হর্ন|সাইরেন|রেলগাড়ি|রাস্তা-অন্যান্য|পাখা|অ্যালার্ম|দরজা|ঠকঠক|পটভূমি-কথা|শিশু-কান্না|পিছনের শব্দ-অন্যান্য|স্ট্যাটিক|যান্ত্রিক-গুঞ্জন)(-(ধীর|পরিষ্কার|উচ্চস্বর|ক্ষীণ|[০-২]))?$/;
function lint(x){const m=[];const core=x.replace(/(\s*(\[[^\]]*\]|<\/[^>]*>|\{[^}]*\}))+\s*$/,'').trim();
 if(!x.trim())m.push('Empty text');
 if(core&&!/(।|\?|!|…|--)["”’']?$/.test(core)&&!/\[অবোধগম্য\]$/.test(core))m.push('Segment must end with punctuation (tag goes after it)');
 (x.match(/\[[^\]]+\]/g)||[]).forEach(t=>{const k=t.slice(1,-1);if(!NS.includes(k)&&!BG.test(k))m.push('Unknown tag '+t)});
 const op={};for(const r of x.matchAll(/<(\/?)([^>=\s]+)[^>]*>/g)){const k=r[2];if(!ST.includes(k))m.push('Unknown tag <'+k+'>');op[k]=(op[k]||0)+(r[1]?-1:1);if(op[k]<0)m.push('Closing tag without opening: '+k)}
 for(const k in op)if(op[k]>0)m.push('Unclosed tag <'+k+'>');
 if(/\{(PRO|MIS):[^}]*[\[<]/.test(x))m.push('Tag inside {PRO}/{MIS}');
 if(/[০-৯0-9]/.test(x.replace(/[০-৯0-9][০-৯0-9,.:%৳$'-]*\s*\{PRO:[^}]*\}/g,'').replace(/\{[^}]*\}/g,'')))m.push('Number needs a {PRO: …} tag (not needed for names like PlayStation 5)');
 if(/--[^\s"”’'.\])>]/.test(x))m.push('"--" must be followed by a space');
 if(/([ঀ-৿A-Za-z]+)-\1(?![ঀ-৿A-Za-z])/.test(x))m.push('Stutter dash needs a space: "আমি - আমি"');
 if(/(\[[^\]]+\])\s*\1/.test(x))m.push('Repeated tag');if(/(.)\1{3,}/.test(x.replace(/[.…-]/g,'')))m.push('Letters stretched (use <প্রসারিত>)');
 if(/\s{2,}/.test(x))m.push('Double space');return m}
function fix(x){const L='[ঀ-৿A-Za-z]';const M={'আহহ':'আহ','আআ':'আ','অঅঅ':'অ','হুমম':'হুম','হম':'হুম','হুহহ':'হুহ','ওহহ':'ওহ','উউহ':'উহ'};
 x=x.replace(/\s+/g,' ').trim();for(const k in M)x=x.replace(new RegExp('(?<!'+L+')'+k+'(?!'+L+')','g'),M[k]);
 x=x.replace(/--(?=[^\s"”’'.\])>-])/g,'-- ').replace(new RegExp('('+L+'+)-(?=\\1(?!'+L+'))','g'),'$1 - ').replace(/(\[[^\]]+\])(\s*\1)+/g,'$1');
 const m=x.match(/(\s*(\[[^\]]*\]|<\/[^>]*>|\{[^}]*\}))+$/),tail=m?m[0]:'',core=m?x.slice(0,x.length-tail.length):x;
 if(core&&!/(।|\?|!|…|--)["”’']?$/.test(core)&&!/\[অবোধগম্য\]$/.test(core))x=core+'।'+tail;return x.replace(/\s+/g,' ').trim()}
const fmt=t=>{t=Math.max(0,t);const m=Math.floor(t/60);return String(m).padStart(2,'0')+':'+(t-m*60).toFixed(2).padStart(5,'0')};
const parseT=s=>{s=String(s).trim();if(!s)return null;const p=s.split(':').map(Number);if(p.some(isNaN)||p.length>3)return null;return p.reduce((a,b)=>a*60+b,0)};
export {NS,ST,BG,lint,fix,fmt,parseT};
