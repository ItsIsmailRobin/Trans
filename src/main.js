import './style.css';
import {NS,ST,lint,fix,fmt,parseT} from './rules.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const S={f:{},au:{},buf:{},env:{},dur:{},mx:{},pk:{},lis:{},mute:{},wc:{},segs:[],cur:null,pt:0,rate:1,loop:false,both:false,hist:[],fut:[],ta:null,zoom:1,playing:false,master:1,rest:false};
const ctx=new (window.AudioContext||window.webkitAudioContext)(),LH=84,RH=18;
let pps=100,Wd=900,D=0,rng=null,raf=0,tmr=0;
const st=(m,e)=>{const x=$('#st');x.textContent=m;x.className=e?'err':''};
const ns=()=>[1,2].filter(n=>S.buf[n]);
const thr=n=>Math.max((S.mx[n]||0)*$('#sens').value/100,.003);

/* ---------- load audio ---------- */
[1,2].forEach(n=>$('#f'+n).onchange=async e=>{const f=e.target.files[0];if(!f)return;
 S.f[n]=f;$('#n'+n).textContent=f.name;if(S.au[n])S.au[n].src='';S.au[n]=new Audio(URL.createObjectURL(f));S.au[n].preservesPitch=true;
 try{const b=await ctx.decodeAudioData(await f.arrayBuffer()),d=b.getChannelData(0),fr=Math.floor(b.sampleRate/100),L=Math.floor(d.length/fr),en=new Float32Array(L);let pk=0,mx=0;
  for(let i=0;i<L;i++){let s=0;for(let j=0;j<fr;j+=4){const v=d[i*fr+j];s+=v*v;if(Math.abs(v)>pk)pk=Math.abs(v)}en[i]=Math.sqrt(s/(fr/4));if(en[i]>mx)mx=en[i]}
  Object.assign(S.buf,{[n]:d});S.env[n]=en;S.dur[n]=b.duration;S.pk[n]=pk||1;S.mx[n]=mx;S.lis[n]=new Uint8Array(Math.ceil(b.duration));
  layout();restore();render();st('Loaded '+f.name+'. Use Auto-segment or drag on the waveform.')}catch(x){st('Could not decode '+f.name,1)}});

/* ---------- waveform ---------- */
function layout(){const l=ns();if(!l.length)return;$('#wave').hidden=false;D=Math.max(...l.map(n=>S.dur[n]));const vw=$('#cv').clientWidth;Wd=Math.min(30000,Math.floor(vw*S.zoom));pps=Wd/D;$('#in').style.width=Wd+'px';
 [1,2].forEach(n=>{const on=!!S.buf[n];$('#c'+n).style.display=on?'block':'none';$('#lb'+n).style.display=on?'flex':'none'});S.wc={};draw()}
function cache(n){const k=S.wc[n];if(k)return k;const c=document.createElement('canvas');c.width=Wd;c.height=LH;const g=c.getContext('2d');g.fillStyle=n==1?'#9a4a1a':'#3B4A5A';
 const a=S.buf[n],N=a.length,k2=N/S.dur[n],sc=LH*.46/S.pk[n];
 for(let x=0;x<Wd;x++){const i0=Math.floor(x/pps*k2),i1=Math.floor((x+1)/pps*k2);if(i0>=N)break;let mn=0,mx=0;const sp=Math.max(1,Math.floor((i1-i0)/10));for(let i=i0;i<i1&&i<N;i+=sp){const v=a[i];if(v<mn)mn=v;if(v>mx)mx=v}g.fillRect(x,LH/2-mx*sc,1,Math.max(1,(mx-mn)*sc))}
 return S.wc[n]=c}
function draw(){ns().forEach(n=>{const c=$('#c'+n);c.width=Wd;c.height=LH;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,Wd,LH);
 S.segs.filter(s=>s.sp===n).forEach(s=>{const sel=s===S.cur,x=s.start*pps,w=Math.max(2,(s.end-s.start)*pps);g.fillStyle=n==1?`rgba(249,115,22,${sel?.38:.17})`:`rgba(59,74,90,${sel?.34:.15})`;g.fillRect(x,0,w,LH);
  g.fillStyle=n==1?'#F97316':'#3B4A5A';g.fillRect(x,0,sel?3:1.5,LH);g.fillRect(x+w-(sel?3:1.5),0,sel?3:1.5,LH);if(lintAll(s).some(m=>m[0]!=='~')){g.fillStyle='#e5381f';g.fillRect(x,0,w,3)}});
 g.drawImage(cache(n),0,0)});ruler();head()}
function ruler(){const c=$('#rl');c.width=Wd;c.height=RH;const g=c.getContext('2d');g.fillStyle='#fff7ee';g.fillRect(0,0,Wd,RH);g.fillStyle='#8a7667';g.font='10px Inter';
 const stp=[.5,1,2,5,10,30,60,120].find(v=>v*pps>=70)||120;for(let t=0;t<D;t+=stp){g.fillRect(t*pps,RH-6,1,6);g.fillText(fmt(t).replace(/^00:/,''),t*pps+3,11)}}
function head(){const x=S.pt*pps;$('#ph').style.left=x+'px';$('#tm').textContent=fmt(S.pt)+' / '+fmt(D);const cv=$('#cv');if(S.playing&&(x<cv.scrollLeft||x>cv.scrollLeft+cv.clientWidth-40))cv.scrollLeft=Math.max(0,x-60)}
const lp=n=>{const a=S.lis[n];return a?Math.round(a.reduce((x,y)=>x+y,0)/a.length*100):0};
const lbl=()=>[1,2].forEach(n=>$('#ls'+n).textContent='Listened '+lp(n)+'%');
const tAt=(e,c)=>(e.clientX-c.getBoundingClientRect().left)/pps;
[1,2].forEach(n=>{const c=$('#c'+n);let m=null;
 const edge=t=>{const px=6/pps;return S.segs.find(s=>s.sp===n&&(Math.abs(s.start-t)<px||Math.abs(s.end-t)<px))};
 c.onmousemove=e=>{if(!m)c.style.cursor=edge(tAt(e,c))?'ew-resize':'crosshair'};
 c.onmousedown=e=>{const t=tAt(e,c),ed=edge(t);
  if(ed){hist();m={k:Math.abs(ed.start-t)<6/pps?'s':'e',s:ed}}
  else{const hit=S.segs.find(s=>s.sp===n&&t>=s.start&&t<=s.end);if(hit){select(hit,{});S.pt=t;head();return}m={k:'n',a:t,b:t}}
  window.onmousemove=ev=>{const x=Math.max(0,Math.min(S.dur[n],tAt(ev,c)));if(m.k=='s')m.s.start=Math.min(x,m.s.end-.05);else if(m.k=='e')m.s.end=Math.max(x,m.s.start+.05);else m.b=x;
   draw();if(m.k=='n'){const g=c.getContext('2d');g.fillStyle='rgba(229,56,31,.25)';g.fillRect(Math.min(m.a,m.b)*pps,0,Math.abs(m.b-m.a)*pps,LH)}};
  window.onmouseup=()=>{window.onmousemove=window.onmouseup=null;const q=m;m=null;
   if(q.k=='n'){if(Math.abs(q.b-q.a)<.08){select(null);S.pt=q.a;head();return}hist();const g={sp:n,start:Math.min(q.a,q.b),end:Math.max(q.a,q.b),text:''};snap(g,15);S.segs.push(g);sortSegs();render();select(g,{focus:true});save()}else fin()}};
 c.ondblclick=e=>{const t=tAt(e,c),h=S.segs.find(s=>s.sp===n&&t>=s.start&&t<=s.end);if(h)select(h,{play:true})}});
$('#rl').onclick=e=>{S.pt=tAt(e,$('#rl'));S.cur=null;$$('#rows tr').forEach(r=>r.classList.remove('sel'));draw()};
$$('.mu').forEach(b=>b.onclick=()=>{const n=+b.dataset.n;S.mute[n]=!S.mute[n];b.classList.toggle('on',S.mute[n]);b.textContent=S.mute[n]?'Muted':'Mute';if(S.au[n])S.au[n].muted=!!S.mute[n]});
$('#zm').oninput=e=>{S.zoom=+e.target.value;layout()};$('#sens').oninput=()=>draw();window.onresize=()=>{clearTimeout(tmr);tmr=setTimeout(layout,150)};

/* ---------- playback ---------- */
function ui(){$('#pp').textContent=S.playing?'⏸':'▶'}
function stop(){Object.values(S.au).forEach(a=>a.pause());S.playing=false;cancelAnimationFrame(raf);rng=null;ui()}
function playRange(s,e,sps){stop();sps=sps.filter(n=>S.au[n]);if(!sps.length)return;rng={s,e,sps};S.master=sps[0];
 sps.forEach(n=>{const a=S.au[n];a.currentTime=s;a.playbackRate=S.rate;a.muted=!!S.mute[n];a.play()});S.playing=true;ui();tick()}
function tick(){const a=S.au[S.master];if(!a||!rng)return;S.pt=a.currentTime;rng.sps.forEach(n=>{const l=S.lis[n],i=Math.floor(S.au[n].currentTime);if(l&&i<l.length)l[i]=1});lbl();
 if(a.currentTime>=rng.e||a.ended){if(S.loop)return playRange(rng.s,rng.e,rng.sps);const e=rng.e;stop();S.pt=Math.min(e,D);head();return}
 head();raf=requestAnimationFrame(tick)}
const trk=s=>S.both?[s.sp,...ns().filter(n=>n!==s.sp)]:[s.sp];
const playSeg=s=>playRange(s.start,s.end,trk(s));
function toggle(){if(S.playing)return stop();if(S.cur)playSeg(S.cur);else playRange(S.pt>=D-.05?0:S.pt,D,ns())}
function jump(d){S.pt=Math.max(0,Math.min(D,S.pt+d));if(S.playing&&rng)playRange(S.pt,rng.e,rng.sps);else head()}
function step(d,play){const g=S.segs[S.segs.indexOf(S.cur)+d];if(g)select(g,{play,focus:true})}
$('#pp').onclick=toggle;$('#bk').onclick=()=>jump(-2);$('#fw').onclick=()=>jump(2);$('#pv').onclick=()=>step(-1,true);$('#nx').onclick=()=>step(1,true);
$('#lp').onclick=e=>{S.loop=!S.loop;e.target.classList.toggle('on',S.loop)};$('#bt').onclick=e=>{S.both=!S.both;e.target.classList.toggle('on',S.both)};
$('#rt').onchange=e=>{S.rate=+e.target.value;Object.values(S.au).forEach(a=>a.playbackRate=S.rate)};

/* ---------- lint (text rules + timing rules) ---------- */
function tl(s){const m=[],e=S.env[s.sp];if(s.end<=s.start)m.push('End must be after start');if(S.dur[s.sp]&&s.end>S.dur[s.sp]+.01)m.push('Past end of audio');
 const own=S.segs.filter(q=>q.sp===s.sp),p=own[own.indexOf(s)-1];if(p){if(p.end>s.start+.001)m.push('Overlaps previous line');else if(s.start-p.end<1)m.push('Gap under 1s to previous line: merge them (4.3)')}
 if(e){const th=thr(s.sp),a=Math.round(s.start*100),b=Math.min(Math.round(s.end*100),e.length-1);let f=a;while(f<b&&e[f]<=th)f++;let l=b;while(l>a&&e[l]<=th)l--;
  if(f-a>30)m.push('~Silence padding at start (over 0.3s)');if(b-l>30)m.push('~Silence padding at end (over 0.3s)');
  if(a>2&&e[a]>th*2.5&&e[a-3]>th)m.push('~Word may be clipped at start');if(e[b]>th*2.5&&e[Math.min(e.length-1,b+3)]>th)m.push('~Word may be clipped at end')}
 return m}
const lintAll=s=>lint(s.text).concat(tl(s));
function snap(g,w=40){const e=S.env[g.sp];if(!e)return;const th=thr(g.sp),a=Math.round(g.start*100),b=Math.round(g.end*100);let s=null,t=null;
 for(let i=Math.max(0,a-w);i<=Math.min(e.length-1,a+w);i++)if(e[i]>th){s=i;break}
 for(let i=Math.min(e.length-1,b+w);i>=Math.max(0,b-w);i--)if(e[i]>th){t=i;break}
 if(s!==null)g.start=Math.max(0,s/100-.03);if(t!==null)g.end=Math.min(S.dur[g.sp],t/100+.05);if(g.end<=g.start)g.end=g.start+.1}

/* ---------- lines ---------- */
const sortSegs=()=>S.segs.sort((a,b)=>a.start-b.start||a.sp-b.sp);
function fin(){sortSegs();render();draw();save()}
function render(){const f=+$('#flt').value,tb=$('#rows');tb.textContent='';
 S.segs.forEach((s,i)=>{if(f&&s.sp!==f)return;const tr=document.createElement('tr');tr._s=s;
  tr.innerHTML=`<td>${i+1}</td><td class="x${s.sp}">S${s.sp}</td><td><input class="tm" value="${fmt(s.start)}"></td><td><input class="tm" value="${fmt(s.end)}"></td><td><textarea class="tx" rows="1" spellcheck="false"></textarea><div class="msg"></div></td><td class="a"><span class="dot"></span><input type="checkbox" class="rv" title="Reviewed by ear"><button title="Play (Ctrl+Enter)">▶</button><button title="Delete">✕</button></td>`;
  const [t0,t1]=tr.querySelectorAll('.tm'),ta=tr.querySelector('.tx'),rv=tr.querySelector('.rv'),[pb,db]=tr.querySelectorAll('button');ta.value=s.text;rv.checked=!!s.ok;
  t0.onchange=()=>{const v=parseT(t0.value);if(v!==null){hist();s.start=v}fin()};t1.onchange=()=>{const v=parseT(t1.value);if(v!==null){hist();s.end=v}fin()};
  ta.onfocus=()=>{S.ta=ta;if(S.cur!==s)select(s,{scroll:false})};ta.onblur=()=>{s._h=0};
  ta.oninput=()=>{if(!s._h){hist();s._h=1}if(/\n/.test(ta.value))ta.value=ta.value.replace(/\n/g,' ');s.text=ta.value;row(tr);cnt();save()};
  ta.onkeydown=e=>{if(e.key==='Enter'&&!e.ctrlKey){e.preventDefault();step(1,true)}};
  tr.onclick=e=>{if(!/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName))select(s,{play:true})};
  rv.onchange=()=>{s.ok=rv.checked;cnt();save()};pb.onclick=()=>select(s,{play:true});
  db.onclick=()=>{hist();S.segs.splice(S.segs.indexOf(s),1);if(S.cur===s)S.cur=null;fin()};
  tb.appendChild(tr);row(tr)});cnt();$$('#rows tr').forEach(r=>r.classList.toggle('sel',r._s===S.cur))}
function row(tr){const m=lintAll(tr._s),bad=m.some(x=>x[0]!=='~');tr.querySelector('.dot').className='dot'+(bad?' bad':m.length?' warn':'');tr.querySelector('.msg').textContent=m.map(x=>x.replace(/^~/,'⚠ ')).join(' · ')}
function cnt(){let e=0,w=0;S.segs.forEach(s=>{const m=lintAll(s);if(m.some(x=>x[0]!=='~'))e++;else if(m.length)w++});const p=$('#cnt');p.textContent=`${e} errors · ${w} warnings · reviewed ${S.segs.filter(g=>g.ok).length}/${S.segs.length}`;p.className='pill'+(e?' bad':'')}
function select(s,o={}){S.cur=s;const rs=$$('#rows tr');rs.forEach(r=>r.classList.toggle('sel',r._s===s));
 if(s){const tr=rs.find(r=>r._s===s);S.pt=s.start;const cv=$('#cv'),x=s.start*pps;if(x<cv.scrollLeft||x>cv.scrollLeft+cv.clientWidth-60)cv.scrollLeft=Math.max(0,x-80);
  if(tr&&o.scroll!==false)tr.scrollIntoView({block:'nearest'});if(o.focus&&tr)tr.querySelector('.tx').focus();if(o.play)playSeg(s)}draw()}
$('#flt').onchange=render;

/* ---------- editing tools ---------- */
const snapJ=()=>JSON.stringify(S.segs.map(({_h,...r})=>r));
function hist(){S.hist.push([snapJ(),S.segs.indexOf(S.cur)]);if(S.hist.length>150)S.hist.shift();S.fut=[]}
function jump2(a,b){const[j,i]=a.pop();b.push([snapJ(),S.segs.indexOf(S.cur)]);S.segs=JSON.parse(j);S.cur=S.segs[i]||null;render();draw();save()}
const undo=()=>S.hist.length&&jump2(S.hist,S.fut),redo=()=>S.fut.length&&jump2(S.fut,S.hist);
$('#un').onclick=undo;$('#re').onclick=redo;
function region(n,t){const e=S.env[n];if(!e)return null;const th=thr(n);let i=Math.round(t*100);while(i<e.length&&e[i]<=th)i++;if(i>=e.length)return null;let j=i,q=0;while(j<e.length&&q<50){q=e[j]>th?0:q+1;j++}return{start:Math.max(0,i/100-.03),end:Math.min(S.dur[n],(j-q)/100+.05)}}
function addAt(n){if(!S.buf[n])return st('Load Speaker '+n+' audio first.',1);const r=region(n,S.pt)||{start:S.pt,end:Math.min(S.dur[n],S.pt+1.5)};hist();const g={sp:n,start:r.start,end:r.end,text:''};S.segs.push(g);sortSegs();render();select(g,{focus:true});save()}
$('#a1').onclick=()=>addAt(1);$('#a2').onclick=()=>addAt(2);
function autoSeg(){if(!ns().length)return st('Load audio first.',1);if(S.segs.some(g=>g.text.trim())&&!confirm('Replace existing lines with auto-segments? (You can undo.)'))return;hist();
 ns().forEach(n=>{const e=S.env[n],th=thr(n),r=[];let s=-1,last=-1;for(let i=0;i<e.length;i++){if(e[i]>th){if(s<0)s=i;last=i}else if(s>=0&&i-last>=100){r.push([s,last]);s=-1}}if(s>=0)r.push([s,last]);
  S.segs=S.segs.filter(g=>g.sp!==n);r.filter(([a,b])=>b-a>=12).forEach(([a,b])=>S.segs.push({sp:n,start:Math.max(0,a/100-.03),end:Math.min(S.dur[n],b/100+.05),text:''}))});
 S.cur=null;fin();st(S.segs.length+' lines created at 1s+ silences. Adjust edges, then type the text.')}
$('#as').onclick=autoSeg;
function split(){const s=S.cur&&S.pt>S.cur.start+.05&&S.pt<S.cur.end-.05?S.cur:S.segs.find(q=>S.pt>q.start+.05&&S.pt<q.end-.05);if(!s)return st('Put the playhead inside a line to split it.',1);hist();const b={sp:s.sp,start:S.pt,end:s.end,text:''};s.end=S.pt;S.segs.push(b);sortSegs();render();select(b,{focus:true});save()}
function merge(){const s=S.cur;if(!s)return st('Select a line first.',1);const n=S.segs.find(q=>q.sp===s.sp&&q.start>s.start);if(!n)return st('No next line for this speaker.',1);hist();s.text=(s.text+' '+n.text).trim();s.end=n.end;S.segs.splice(S.segs.indexOf(n),1);fin();select(s,{})}
function snapSel(){if(!S.cur)return st('Select a line first.',1);hist();snap(S.cur,60);fin()}
$('#sp').onclick=split;$('#mg').onclick=merge;$('#sn').onclick=snapSel;
$('#af').onclick=()=>{if(!S.segs.length)return;hist();S.segs.forEach(g=>g.text=fix(g.text));render();save();st('Rule fixes applied (spacing, dashes, fillers, end punctuation). Check by ear.')};

/* ---------- tag palette ---------- */
const sounds=NS.filter(t=>!['বৈদেশিক','অবোধগম্য','অন্যান্য-মৌখিক-শব্দ'].includes(t)).map(t=>({l:'['+t+']',o:'['+t+']',p:1}));
const P=[['Sounds',[{l:'[অবোধগম্য]',o:'[অবোধগম্য]',p:1},...sounds]],
 ['Style',ST.filter(t=>t!=='বৈদেশিক').map(t=>({l:'<'+t+'>',o:'<'+t+'>',c:'</'+t+'>',p:1})).concat([{l:'<বৈদেশিক="EN">',o:'<বৈদেশিক="EN">',c:'</বৈদেশিক>',p:1}])],
 ['Marks',[{l:'{PRO: }',o:'{PRO: ',c:'}',t:1},{l:'{MIS: }',o:'{MIS: ',c:'}',t:1},{l:'*জোর*',o:'*',c:'*',t:1},{l:'{{note}}',o:'{{',c:'}}',t:1},{l:'--',o:'-- '},{l:' - ',o:' - '},{l:'...',o:'...'}]]];
const pal=$('#pal');P.forEach(([g,a])=>{const em=document.createElement('em');em.textContent=g;pal.appendChild(em);a.forEach(k=>{const b=document.createElement('button');b.textContent=k.l;b.onmousedown=e=>{e.preventDefault();put(k)};pal.appendChild(b)})});
function put(k){const ta=S.ta;if(!ta)return st('Click inside a line first, then insert tags.',1);const a=ta.selectionStart,b=ta.selectionEnd,v=ta.value,sel=v.slice(a,b);let s,c;
 if(k.c){s=k.t?k.o+sel+k.c:k.o+' '+sel+(sel?' ':'')+k.c;c=k.t?k.o.length+sel.length:k.o.length+1+sel.length}else{s=k.o;c=s.length}
 if(k.p){const L=a>0&&v[a-1]!==' '?' ':'',R=v[b]&&v[b]!==' '?' ':'';s=L+s+R;c=k.c?c+L.length:s.length}
 ta.value=v.slice(0,a)+s+v.slice(b);ta.setSelectionRange(a+c,a+c);ta.focus();ta.dispatchEvent(new Event('input'))}

/* ---------- save / import / export ---------- */
const key=()=>'tf:'+[1,2].map(n=>S.f[n]?S.f[n].name+S.f[n].size:'-').join('|');
function save(){clearTimeout(save.t);save.t=setTimeout(()=>{try{localStorage[key()]=snapJ()}catch(e){}},400)}
function restore(){if(S.segs.length&&!S.rest)return;try{const j=localStorage[key()];if(j){S.segs=JSON.parse(j);S.rest=true;st('Restored your saved work for these files.')}}catch(e){}}
$('#imp').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const t=await f.text();let a=[];
 try{a=JSON.parse(t).map(g=>({sp:+(g.speaker||g.sp||1),start:+g.start,end:+g.end,text:String(g.text||''),ok:!!g.ok}))}
 catch{const T='(\\d+:\\d+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';for(const l of t.split(/\r?\n/)){const m=l.match(new RegExp('^\\s*\\[?\\s*'+T+'\\s*-\\s*'+T+'\\s*\\]?\\s*(?:Speaker\\s*(\\d)\\s*:)?\\s*(.*)$','i'));if(m)a.push({sp:+(m[3]||1),start:parseT(m[1]),end:parseT(m[2]),text:m[4]})}}
 if(!a.length)return st('No lines found. Use JSON, or lines like [00:01.20 - 00:03.50] Speaker 1: text',1);hist();S.segs=a;S.cur=null;fin();st('Imported '+a.length+' lines.')};
const dl=(n,t)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));a.download=n;a.click()};
$('#xj').onclick=()=>dl('transcript.json',JSON.stringify(S.segs.map((s,i)=>({id:i+1,speaker:s.sp,start:+s.start.toFixed(2),end:+s.end.toFixed(2),text:s.text,ok:!!s.ok})),null,2));
$('#xt').onclick=()=>dl('transcript.txt',S.segs.map(s=>`[${fmt(s.start)} - ${fmt(s.end)}] Speaker ${s.sp}: ${s.text}`).join('\n'));

/* ---------- hotkeys ---------- */
document.onkeydown=e=>{const inp=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
 if((e.key==='Enter'&&e.ctrlKey)||(e.code==='Space'&&!inp)){e.preventDefault();return toggle()}
 if(!e.altKey)return;const m={ArrowDown:()=>step(1,true),ArrowUp:()=>step(-1,true),ArrowLeft:()=>jump(-2),ArrowRight:()=>jump(2),KeyL:()=>$('#lp').click(),KeyB:()=>$('#bt').click(),KeyN:()=>addAt(S.cur?S.cur.sp:ns()[0]||1),KeyS:split,KeyM:merge,KeyT:snapSel,KeyZ:undo,KeyY:redo}[e.code];
 if(m){e.preventDefault();m()}};
render();lbl();
