'use strict';
/* SETI: SIGNAL UNKNOWN - vanilla JS, no dependencies */
const $=(s,e=document)=>e.querySelector(s),$$=(s,e=document)=>[...e.querySelectorAll(s)];
const app=$('#app'),CFG={time:720,pts:[500,500,750,1000,1500],speed:200,speedWindow:90,tries:3};
const R=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const shuf=a=>a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* Leaderboard storage adapter. To use Firebase/Supabase, replace save() and list()
   with async calls to your backend; the rest of the game only uses these two methods. */
const Store={
  async save(r){const l=await this.list();l.push(r);localStorage.setItem('seti-lb',JSON.stringify(l))},
  async list(){try{return JSON.parse(localStorage.getItem('seti-lb'))||[]}catch(e){return[]}}
};

let G,anim=null,warp=0,tmr;

/* ---------- starfield ---------- */
const sc=$('#stars'),sx=sc.getContext('2d'),still=matchMedia('(prefers-reduced-motion:reduce)').matches;let stars=[];
function rs(){sc.width=innerWidth;sc.height=innerHeight;stars=Array.from({length:Math.min(420,innerWidth*innerHeight/3000|0)},()=>({x:Math.random()*sc.width,y:Math.random()*sc.height,z:R(.2,1)}))}
addEventListener('resize',rs);rs();
function tick(t){
  sx.clearRect(0,0,sc.width,sc.height);
  for(const s of stars){
    if(!still){s.x-=(.08+warp*4)*s.z;if(s.x<0)s.x=sc.width}
    sx.globalAlpha=.22+.6*s.z;sx.fillStyle=s.z>.9?'#bff':'#cde';sx.fillRect(s.x,s.y,s.z*1.6+warp*14*s.z,s.z*1.6);
  }
  warp*=.94;if(anim)anim(t/1000);requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- canvas helpers ---------- */
function fit(c){const d=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=w*d;c.height=h*d}
  const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);x.w=w;x.h=h;x.clearRect(0,0,w,h);return x}
function grid(x){x.strokeStyle='#17304a';x.lineWidth=1;x.beginPath();for(let i=1;i<10;i++){x.moveTo(x.w*i/10,0);x.lineTo(x.w*i/10,x.h)}for(let j=1;j<6;j++){x.moveTo(0,x.h*j/6);x.lineTo(x.w,x.h*j/6)}x.stroke()}

/* ---------- state & shared UI ---------- */
function newGame(name){G={name,score:0,ok:0,bad:0,done:0,stage:0,decoded:false,cls:false,over:false,start:0,sStart:0,id:Date.now()}}
function show(h){warp=1;anim=null;app.innerHTML=h;scrollTo(0,0)}
function hud(){$('#sc').textContent=G.score.toLocaleString();$$('#seg i').forEach((e,i)=>e.className=i<G.done?'d':i===G.stage?'c':'')}
function modal(t,b,btn,cb){const m=$('#modal');m.hidden=false;m.innerHTML=`<div class="card"><h2>${t}</h2><p>${b}</p><button class="btn" id="mo">${btn}</button></div>`;$('#mo').onclick=()=>{m.hidden=true;cb&&cb()};$('#mo').focus()}
function add(n){G.score=Math.max(0,G.score+n);hud();const t=document.createElement('div');t.className='toast '+(n<0?'neg':'pos');t.textContent=(n>0?'+':'')+n;$('#toasts').append(t);setTimeout(()=>t.remove(),1500)}
function good(i){G.ok++;add(CFG.pts[i]);if(!G.over){const e=(Date.now()-G.sStart)/1000,sp=Math.round(CFG.speed*Math.max(0,1-e/CFG.speedWindow));if(sp)setTimeout(()=>add(sp),350)}}
function bad(n){G.bad++;add(-n)}
const say=(t,c)=>{const m=$('#msg');m.textContent=t;m.className='msg '+c};
const cont=()=>{$('#ph').innerHTML='<button class="btn" id="nx">CONTINUE</button>';$('#nx').onclick=next;$('#nx').focus()};
const head=(n,t,s)=>`<div class="sh"><span class="mono dim">STAGE ${n} OF 5</span><h2>${t}</h2><p>${s}</p></div>`;
function stage(i){G.stage=i;G.sStart=Date.now();hud();[s1,s2,s3,s4,s5][i]()}
function next(){G.done++;G.stage<4?stage(G.stage+1):end()}
function startClock(){
  G.start=Date.now();$('#hud').hidden=false;hud();
  tmr=setInterval(()=>{const left=CFG.time-(Date.now()-G.start)/1000;$('#tm').textContent=fmt(Math.max(0,left));$('#tm').classList.toggle('low',left<60);
    if(left<=0&&!G.over){G.over=true;modal('OBSERVATION SESSION TERMINATED','Mission time has expired. You can keep analyzing the signal, but the speed bonus is no longer awarded.','CONTINUE')}},500);
}
function options(items,onPick,cls){ // items: [text, isCorrect]
  return `<div class="opts">${items.map((o,i)=>`<button class="opt" data-i="${i}"><b class="mono ok">${'ABCD'[i]}.</b> ${o[0]}</button>`).join('')}</div>`;
}
function wire(items,pts,penalty,fb,extra){
  let done=0;
  $$('.opt').forEach(b=>b.onclick=()=>{if(done)return;done=1;const i=+b.dataset.i,ok=items[i][1];
    b.classList.add(ok?'right':'wrong');if(!ok)$$('.opt')[items.findIndex(o=>o[1])].classList.add('right');
    ok?good(pts):bad(penalty);extra&&extra(ok);say(ok?fb[0]:fb[1],ok?'ok':'bad');$('#why').hidden=false;cont()});
}

/* ---------- start / name / intro ---------- */
function start(){
  $('#hud').hidden=true;clearInterval(tmr);
  show(`<section class="hero"><p class="mono dim">DEEP SPACE LISTENING ARRAY</p><h1>SETI<span>SIGNAL UNKNOWN</span></h1>
  <p class="tag">The universe is transmitting.<br>Can you decode it?</p>
  <button class="btn" id="go">[ INITIALIZE OBSERVATION ]</button><button class="btn ghost" id="lb">VIEW LEADERBOARD</button>
  <p class="fine">Fictional educational simulation inspired by radio astronomy and SETI research.</p></section>`);
  $('#go').onclick=nameScreen;$('#lb').onclick=()=>board(start);
}
function nameScreen(){
  show(`<section class="card narrow"><h2>PLAYER NAME</h2><input id="nm" maxlength="20" placeholder="Enter your name" autocomplete="off" aria-label="Player name"><button class="btn" id="bg" style="width:100%">[ BEGIN MISSION ]</button></section>`);
  const go=()=>{const n=$('#nm').value.trim();if(!n){$('#nm').focus();return}newGame(n);intro()};
  $('#bg').onclick=go;$('#nm').onkeydown=e=>{if(e.key==='Enter')go()};$('#nm').focus();
}
function intro(){
  $('#hud').hidden=true;clearInterval(tmr);
  const L=['SYSTEM INITIALIZING...','DEEP SPACE LISTENING ARRAY: <b class="ok">ONLINE</b>','Telescope alignment: <b class="ok">COMPLETE</b>','Frequency scanner: <b class="ok">ONLINE</b>','Background noise: <b class="warn">NORMAL</b>','Scanning...','Scanning...','Scanning...'];
  show('<section class="card term"><div id="tl"></div></section>');const tl=$('#tl');let i=0;
  (function n(){if(tl!==$('#tl'))return;
    if(i<L.length){tl.insertAdjacentHTML('beforeend',`<p>${L[i++]}</p>`);setTimeout(n,i<6?500:700)}
    else setTimeout(()=>{if(tl!==$('#tl'))return;warp=2;
      tl.insertAdjacentHTML('beforeend',`<div class="alert"><h2>⚠ ANOMALOUS SIGNAL DETECTED</h2><dl><div><dt>Frequency</dt><dd>1420.37 MHz</dd></div><div><dt>Signal-to-noise ratio</dt><dd>8.42</dd></div><div><dt>Origin</dt><dd>UNKNOWN</dd></div></dl></div><button class="btn" id="inv">[ INVESTIGATE SIGNAL ]</button>`);
      $('#inv').onclick=()=>{startClock();stage(0)};$('#inv').focus()},800);
  })();
}

/* ---------- stage 1: signal detection ---------- */
function s1(){
  const T=Math.floor(Math.random()*4),dec=shuf(['burst','drift','noise']);
  const S=[0,1,2,3].map(i=>({k:i===T?'pulse':dec[i>T?i-1:i],p:R(38,58),seed:R(0,99)}));
  let sel=0,tries=CFG.tries,done=0;
  const W=(s,x,t)=>{
    const o=x+t*60,n=(Math.sin(Math.floor(o/2)*12.9898+s.seed)*43758.5453)%1;let v=n*.28;
    if(s.k==='pulse'){const ph=(((o%s.p)+s.p)%s.p)/s.p;if(ph<.1)v+=Math.sin(ph*31.4)*.8}
    else if(s.k==='burst'){const b=Math.floor(o/170),h=Math.abs(Math.sin(b*7.7+s.seed)),d=(((o%170)+170)%170)-h*120;if(Math.abs(d)<16)v+=Math.sin(d*.9)*h*.9}
    else if(s.k==='drift')v+=.35*Math.sin(o*.04+Math.sin(o*.011)*3);
    else v=n*.6;
    return v};
  const line=(x,s,t,col,lw)=>{x.strokeStyle=col;x.lineWidth=lw;x.beginPath();for(let i=0;i<=x.w;i+=2){const y=x.h/2-W(s,i,t)*x.h*.42;i?x.lineTo(i,y):x.moveTo(i,y)}x.stroke()};
  show(`${head(1,'Signal Detection','Four candidate channels are open. Select each one, find the repeating artificial-looking pattern, then lock it.')}
  <div class="card scope"><canvas id="big"></canvas></div>
  <div class="tel"><div><small>FREQUENCY</small><b>1420.37 MHz</b></div><div><small>SIGNAL STRENGTH</small><b id="t1"></b></div><div><small>SNR</small><b id="t2"></b></div><div><small>TELESCOPE</small><b class="ok">TRACKING</b></div></div>
  <div class="cands">${'ABCD'.split('').map((l,i)=>`<button class="cand ${i?'':'on'}" data-i="${i}"><canvas></canvas>SIGNAL ${l}</button>`).join('')}</div>
  <div class="row"><span class="mono" id="tr">ATTEMPTS ${tries}</span><span id="ph"><button class="btn" id="lock">LOCK SIGNAL</button></span></div><p id="msg" class="msg"></p>`);
  $$('.cand').forEach(b=>b.onclick=()=>{sel=+b.dataset.i;$$('.cand').forEach(c=>c.classList.toggle('on',c===b))});
  $('#lock').onclick=()=>{
    if(done)return;
    if(sel===T){done=1;good(0);say('SIGNAL LOCKED','ok');cont()}
    else{bad(150);tries--;$('#tr').textContent='ATTEMPTS '+tries;
      if(tries<=0){done=1;say('SIGNAL NOT CONSISTENT WITH TARGET. Target was SIGNAL '+'ABCD'[T]+': a pulse repeating at a fixed interval.','bad');cont()}
      else say('SIGNAL NOT CONSISTENT WITH TARGET','bad')}};
  let last=0;
  anim=t=>{const b=fit($('#big'));grid(b);line(b,S[sel],t,'#4fe3d0',1.6);
    $$('.cand canvas').forEach((c,i)=>{const x=fit(c);line(x,S[i],t,i===sel?'#4fe3d0':'#5d7d8f',1)});
    if(t-last>.25){last=t;$('#t1').textContent=(-98+Math.sin(t*3)*2+S[sel].seed%3).toFixed(1)+' dBm';$('#t2').textContent=(3.5+S[sel].seed%5+Math.sin(t*2)*.3).toFixed(2)}};
}

/* ---------- stage 2: frequency analysis ---------- */
function s2(){
  const nar=R(.2,.8),br=[];
  while(br.length<4){const c=R(.08,.92);if(Math.abs(c-nar)>.12&&br.every(b=>Math.abs(b.c-c)>.12))br.push({c,w:R(.035,.06),h:R(.3,.7)})}
  const seed=R(0,99);let tries=CFG.tries,done=0,mark=null;
  const P=(f,t)=>{let v=.06+.04*Math.abs(Math.sin(f*300+t*8+seed)*Math.sin(f*95-t*5));for(const b of br)v+=b.h*Math.exp(-(((f-b.c)/b.w)**2));return v+.85*Math.exp(-(((f-nar)/.006)**2))};
  show(`${head(2,'Frequency Analysis','Natural astronomical sources generally exhibit characteristic spectral behavior. Identify the narrow-band anomaly and tap its peak.')}
  <div class="card scope"><canvas id="sp"></canvas></div>
  <div class="row"><span class="mono" id="tr">ATTEMPTS ${tries}</span><span id="ph"></span></div><p id="msg" class="msg"></p>`);
  $('#sp').onpointerdown=e=>{
    if(done)return;const r=e.target.getBoundingClientRect(),f=(e.clientX-r.left)/r.width;mark=f;
    if(Math.abs(f-nar)<.035){done=1;mark=nar;good(1);say('TARGET FREQUENCY LOCKED','ok');cont()}
    else{bad(100);tries--;$('#tr').textContent='ATTEMPTS '+tries;
      if(tries<=0){done=1;mark=nar;say('INCORRECT FREQUENCY. The narrow spike is the anomaly: broad humps are typical of natural emission.','bad');cont()}
      else say('INCORRECT FREQUENCY. Look for a much narrower spike.','bad')}};
  anim=t=>{const x=fit($('#sp')),pl=34,pb=24,w=x.w-pl,h=x.h-pb;grid(x);
    x.beginPath();x.moveTo(pl,h);for(let i=0;i<=w;i++)x.lineTo(pl+i,h-P(i/w,t)*h*.95);x.lineTo(pl+w,h);
    x.fillStyle='rgba(79,227,208,.1)';x.fill();x.strokeStyle='#4fe3d0';x.lineWidth=1.4;x.stroke();
    x.fillStyle='#7f98a8';x.font='11px ui-monospace,monospace';
    for(let i=0;i<=4;i++)x.fillText((1419.87+i/4).toFixed(2),pl+w*i/4-(i===4?36:i?16:0),x.h-8);
    x.save();x.translate(11,h/2+20);x.rotate(-Math.PI/2);x.fillText('POWER',0,0);x.restore();x.fillText('MHz',x.w-30,14);
    if(mark!==null){const mx=pl+mark*w;x.strokeStyle='#ffb441';x.setLineDash([4,4]);x.beginPath();x.moveTo(mx,0);x.lineTo(mx,h);x.stroke();x.setLineDash([])}};
}

/* ---------- stage 3: pattern recognition ---------- */
function s3(){
  const u=pick(['101','110','1001','0111','1100','10110']),bits=u.repeat(Math.ceil(18/u.length));
  const items=shuf([['It is completely random',0],['It contains a repeating mathematical pattern',1],['It is pure background noise',0],['It is a typical broadband signal',0]]);
  show(`${head(3,'Pattern Recognition','The receiver is now streaming a demodulated pulse sequence.')}
  <div class="card pat"><small class="dim">SIGNAL PATTERN</small><canvas id="pc"></canvas><div class="bitsrow">${bits}</div></div>
  <h2>What property makes this signal unusual?</h2>${options(items)}
  <div class="note" id="why" hidden>Repeating mathematical structure can be interesting in SETI research, although a pattern alone is not proof of an artificial origin. Pulsars, for example, are natural and repeat very regularly.</div>
  <div class="row"><span id="ph"></span></div><p id="msg" class="msg"></p>`);
  wire(items,2,100,['PATTERN CLASSIFIED','NOT CONSISTENT WITH THE DATA']);
  anim=t=>{const x=fit($('#pc')),cw=x.w/18,off=t*cw*3;x.strokeStyle='#4fe3d0';x.lineWidth=2;x.beginPath();
    for(let px=0;px<=x.w;px+=1){const k=Math.floor((px+off)/cw),b=bits[((k%bits.length)+bits.length)%bits.length]==='1',y=b?x.h*.2:x.h*.8;px?x.lineTo(px,y):x.moveTo(px,y)}x.stroke()};
}

/* ---------- stage 4: signal decoding ---------- */
function s4(){
  const w=pick(['HELLO','ORBIT','STAR','EARTH','LISTEN','SIGNAL','HOME']),codes=[...w].map(c=>(c.charCodeAt(0)-64).toString(2).padStart(5,'0'));
  const open=codes.map(()=>0);let wrong=0,done=0;
  const letters=`<option value="0">_</option>`+[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c,i)=>`<option value="${i+1}">${c}</option>`).join('');
  show(`${head(4,'Signal Decoding','SIGNAL ENCODING DETECTED. BIT LENGTH: 5. Each group is one binary number. Convert it to decimal, then map the number to a letter.')}
  <div class="card"><div class="note">Step 1: tap a group to add up its place values (16, 8, 4, 2, 1). Step 2: use the table to turn the number into a letter. Step 3: pick the letter.</div>
  <div class="place"><span>16</span><span>8</span><span>4</span><span>2</span><span>1</span></div><div id="dec"></div>
  <div class="chips" style="margin-top:12px">${[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c,i)=>`<span>${c}=${i+1}</span>`).join('')}</div></div>
  <div class="row"><span id="ph"><button class="btn" id="tx">TRANSMIT DECODED MESSAGE</button></span></div><p id="msg" class="msg"></p>`);
  const draw=()=>{const keep=$$('#dec select').map(s=>s.value);$('#dec').innerHTML=codes.map((c,i)=>`<div class="gl"><button class="bits" data-i="${i}" aria-label="Convert ${c}">${[...c].map(b=>`<i>${b}</i>`).join('')}</button>
    <div class="dv">${open[i]?[...c].map((b,j)=>b==='1'?16>>j:0).filter(Boolean).join(' + ')+' = <b>'+parseInt(c,2)+'</b>':'tap to convert'}</div>
    <select aria-label="Letter ${i+1}">${letters}</select></div>`).join('');
    $$('#dec select').forEach((s,i)=>s.value=keep[i]||0);$$('.bits').forEach(b=>b.onclick=()=>{open[+b.dataset.i]=1;draw()})};
  draw();
  $('#tx').onclick=()=>{if(done)return;const g=$$('#dec select').map(s=>+s.value?String.fromCharCode(64+ +s.value):'_').join('');
    if(g===w){done=1;G.decoded=true;good(3);warp=4;say('MESSAGE DECODED','ok');
      $('#dec').insertAdjacentHTML('beforebegin',`<div class="word flash">${w}</div>`);$$('#dec,.chips,.note,.place').forEach(e=>e.hidden=true);
      $('#msg').insertAdjacentHTML('afterend','<p class="dim" style="font-size:14px">This is a fictional message for training. It is not a real extraterrestrial transmission.</p>');cont()}
    else{bad(100);wrong++;
      if(wrong>=3){done=1;say('MESSAGE NOT DECODED. The message was '+w+'.','bad');cont()}
      else say(wrong>1?'MESSAGE NOT RECOGNIZED. Check each group: add only the place values above the 1s.':'MESSAGE NOT RECOGNIZED','bad')}};
}

/* ---------- stage 5: classification ---------- */
function s5(){
  const items=shuf([['Confirmed extraterrestrial civilization',0],['Definitely human interference',0],['Interesting candidate signal requiring further observation',1],['Alien communication confirmed',0]]);
  show(`${head(5,'Signal Classification','Review the accumulated evidence before you report.')}
  <div class="card"><small class="dim">SIGNAL SUMMARY</small><div class="sum" style="margin-top:8px">
  <div><small>Frequency</small>1420.37 MHz</div><div><small>Bandwidth</small>Narrow</div><div><small>Pattern</small>Repeating</div><div><small>Modulation</small>Structured</div><div><small>Duration</small>47.2 s</div><div><small>Origin</small>Unknown</div></div></div>
  <h2>What is the most scientifically appropriate conclusion?</h2>${options(items)}
  <div class="note" id="why" hidden>A candidate needs independent confirmation: a second telescope seeing it, a source that moves with the sky, and human interference ruled out. Until then, "interesting candidate" is the honest answer.</div>
  <div class="row"><span id="ph"></span></div><p id="msg" class="msg"></p>`);
  wire(items,4,150,['CLASSIFICATION ACCEPTED','CONCLUSION NOT SUPPORTED BY THE EVIDENCE'],ok=>G.cls=ok);
}

/* ---------- results & leaderboard ---------- */
async function end(){
  clearInterval(tmr);$('#hud').hidden=true;
  G.time=Math.round((Date.now()-G.start)/1000);G.acc=G.ok+G.bad?Math.round(100*G.ok/(G.ok+G.bad)):0;
  await Store.save({id:G.id,name:G.name,score:G.score,acc:G.acc,time:G.time,at:Date.now()});res();
}
function res(){
  show(`<section class="card res"><h1>OBSERVATION COMPLETE</h1><p class="mono dim">PLAYER: ${esc(G.name)}</p><small class="dim">FINAL SCORE</small><div class="big">${G.score.toLocaleString()}</div>
  <div class="sum"><div><small>SIGNALS ANALYZED</small>${G.done}</div><div><small>ACCURACY</small>${G.acc}%</div><div><small>DECODING</small>${G.decoded?'SUCCESSFUL':'INCOMPLETE'}</div><div><small>TIME</small>${fmt(G.time)}</div></div>
  <div class="badge">${G.cls?'★ SIGNAL CANDIDATE IDENTIFIED ★':'MISSION INCONCLUSIVE'}</div>
  <p>${G.cls?'Your team has identified an unusual signal.<br>However, extraordinary claims require extraordinary evidence.':'The evidence supported a cautious conclusion. Review the data and try again.'}</p>
  <div class="btns"><button class="btn" id="pa">[ PLAY AGAIN ]</button><button class="btn" id="vl">[ VIEW LEADERBOARD ]</button><button class="btn" id="sh">[ SHARE RESULT ]</button></div></section>`);
  $('#pa').onclick=()=>{newGame(G.name);intro()};$('#vl').onclick=()=>board(res);
  $('#sh').onclick=()=>{const t=`I scored ${G.score.toLocaleString()} in SETI: SIGNAL UNKNOWN with ${G.acc}% accuracy. Can you decode it?`;
    if(navigator.share)navigator.share({text:t,url:location.href}).catch(()=>{});
    else(navigator.clipboard?navigator.clipboard.writeText(t+' '+location.href):Promise.reject()).then(()=>modal('RESULT COPIED',esc(t),'OK')).catch(()=>modal('SHARE RESULT',esc(t),'OK'))};
}
async function board(back,sort='score'){
  const l=(await Store.list()).sort((a,b)=>sort==='score'?b.score-a.score:sort==='acc'?b.acc-a.acc||b.score-a.score:a.time-b.time).slice(0,25);
  show(`<section class="card lb"><h2>SIGNAL UNKNOWN<br>LEADERBOARD</h2>
  <div class="tabs">${[['score','SCORE'],['acc','ACCURACY'],['time','FASTEST']].map(([k,n])=>`<button data-s="${k}" class="${k===sort?'on':''}">${n}</button>`).join('')}</div>
  <ol>${l.length?l.map((r,i)=>`<li class="${G&&r.id===G.id?'me':''}"><span>${String(i+1).padStart(2,'0')}</span><b>${esc(r.name)}${G&&r.id===G.id?' (you)':''}</b><em>${r.score.toLocaleString()}</em><small>${r.acc}% accuracy / ${fmt(r.time)}</small></li>`).join(''):'<li><span></span><b class="dim">No results yet. Be the first.</b></li>'}</ol>
  <div class="btns"><button class="btn" id="bk">BACK</button></div></section>`);
  $$('.tabs button').forEach(b=>b.onclick=()=>board(back,b.dataset.s));$('#bk').onclick=back;
}

start();
