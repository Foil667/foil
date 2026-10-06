(()=>{
'use strict';
/* ================= RUG DODGE =================
 * 16-bit arcade dodge-em-up. You are a tinfoil-hat frog.
 * Rugs rain from above. Don't get pulled.
 * Single-file build for baes.app. $RESCUE flywheel is a DEMO
 * ledger (localStorage only) — no real tokens, no wallets.
 */
const cv=document.getElementById('g'),x=cv.getContext('2d');
const W=416,H=416;
let st,sc,lv,wv,combo,comboT,shieldT,ifrT,hitStop,shakeT,flashT,waveBanner,waveBannerT,dragOn,dragX,dragY;
let rugs=[],telegraphs=[],imps=[],pickups=[],parts=[],floaters=[];
let spawnT=0,toSpawn=0,spawned=0,spdMul=1,spawnInt=1,hitsThisWave=0,survAcc=0,overT=0;
let keys={};
const PX=2; // pixel scale: 1 map pixel = 2 canvas px

/* ---------- 16-bit sprite maps ---------- */
const FROG=[
".....TTTTTTTT.....",
"...TTTTTTTTTTTT...",
"..TTTTttTTTTttTT..",
"..TTttttTTTTttTT..",
"..TTTTTTTTTTTTTT..",
"...GGGGGGGGGGGG...",
"..GGGGGGGGGGGGGG..",
"..GWWGGgGGgGWWGG..",
"..GWBGGGGGGGBWGG..",
"..GGGGGGGGGGGGGG..",
"...GGGGGGGGGGGG...",
"...GgGGGGGGGGgG...",
"....GGGGGGGGGG....",
".....gGGGGGGg.....",
"................",
"................"];
const RUG_RED=[
"...CCCCCCCC...",
"..CCCCCCCCCC..",
"..CPCPCCPCPC..",
"..CCCCCCCCCC..",
"..CPCCPCCPCC..",
"..CCCCCCCCCC..",
"..cccccccccc..",
".FFFFFFFFFFF.",
".FFFFFFFFFFF."];
const RUG_PURPLE=[
"...VVVVVVVV...",
"..VVVVVVVVVV..",
"..VQVQVVQVQV..",
"..VVVVVVVVVV..",
"..VQVVQVVQVV..",
"..VVVVVVVVVV..",
"..vvvvvvvvvv..",
".FFFFFFFFFFF.",
".FFFFFFFFFFF."];
const RUG_TEAL=[
"...AAAAAAAA...",
"..AAAAAAAAAA..",
"..AQAAQAAQAA..",
"..AAAAAAAAAA..",
"..AQAAQAAQAA..",
"..AAAAAAAAAA..",
"..aaaaaaaaaa..",
".FFFFFFFFFFF.",
".FFFFFFFFFFF."];
const IMP=[
"...DDDDDD...",
"..DDDDDDDD..",
".DDEDDDEDD.",
".DDDDDDDDDD.",
".DDDDDDDDDD.",
"..DDDDDDDD..",
"...DDBBD...",
"....DDDD...."];
const VERIFY=[
"...YYYYYY...",
"..YYYYYYYY..",
"..YYyYYYyY..",
"..YLLLLLLY..",
"..YLLWWLLY..",
"..YLLLLLLY..",
"..YYyYYYyY..",
"...YYYYYY...",
".....YY.....",
"......YY...."];
const MIMIC=[
"...YYYYYY...",
"..YYYYYYYY..",
"..YYyYYYyY..",
"..YLLLLLLY..",
"..YLLRWLLY..",
"..YLLLLLLY..",
"..YYyYYYyY..",
"...YYYYYY...",
".....YY.....",
"......YY...."];
const HEART=[
"..RR..RR..",
".RRRRRRRR.",
".RWRRRRRR.",
".RRRRRRRR.",
"..RRRRRR..",
"...RRRR...",
"....RR...."];

const PAL={
 T:null,t:null, // tinfoil — filled from equipped hat at draw time
 G:'#3fae4a',g:'#2a7a33',
 W:'#ffffff',B:'#111111',
 C:'#b03a3a',c:'#7a2828',P:'#e0d02d',
 V:'#7a3ab0',v:'#4d2370',Q:'#c99df0',
 A:'#2a9db0',a:'#1a6570',
 F:'#d8a93f',
 D:'#1a1a24',E:'#ff4d4d',
 Y:'#ffd75e',y:'#b08a2a',L:'#9fd8ff',
 R:'#e04848'
};

function drawMap(map,dx,dy,pal){
  for(let r=0;r<map.length;r++){
    const row=map[r];
    for(let c=0;c<row.length;c++){
      const col=pal[row[c]];
      if(!col)continue;
      x.fillStyle=col;
      x.fillRect(dx+c*PX,dy+r*PX,PX,PX);
    }
  }
}
function mapW(map){return map[0].length*PX}
function mapH(map){return map.length*PX}

/* ---------- audio ---------- */
let AC=null;
function beep(f,d,type){
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    const o=AC.createOscillator(),g=AC.createGain();
    o.type=type||'square';o.frequency.value=f;
    o.connect(g);g.connect(AC.destination);
    g.gain.value=.04;o.start();o.stop(AC.currentTime+d);
  }catch(e){}
}

/* ---------- utils ---------- */
function rnd(a,b){return a+Math.random()*(b-a)}
function clamp(v,a,b){return v<a?a:v>b?b:v}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function circleRect(cx,cy,cr,rx,ry,rw,rh){
  const nx=clamp(cx,rx,rx+rw),ny=clamp(cy,ry,ry+rh);
  const dx=cx-nx,dy=cy-ny;
  return dx*dx+dy*dy<cr*cr;
}
let toastT=null;
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg;el.style.opacity=1;
  clearTimeout(toastT);toastT=setTimeout(()=>{el.style.opacity=0},2400);
}
let fireTxt='🔥 …';

/* ================= $RESCUE flywheel (DEMO ledger — nothing moves onchain) ================= */
const ECO_KEY='rd-rescue-v1';
const TIERS=['Hopper','Dodger','Legend'];
const TIER_NEED=[0,2500,10000];
const CONTINUE_COST=50;
const SKINS=[
 {id:'tinfoil',name:'Classic Tinfoil',cost:0,   tier:0,hat:'#c9ced4',hatD:'#8a9099',desc:'the original. trust issues included.'},
 {id:'gold',   name:'Gold Foil',       cost:150, tier:0,hat:'#ffd75e',hatD:'#b08a2a',desc:'shiny. rugs fear it.'},
 {id:'cyber',  name:'Cyber Mesh',      cost:300, tier:0,hat:'#37f2e8',hatD:'#1a7a74',desc:'blockchain-grade hat.'},
 {id:'void',   name:'Void Wrap',       cost:600, tier:1,hat:'#2b2b4d',hatD:'#15152a',desc:'Dodger tier only. dark mode, literally.'},
 {id:'looper', name:'Looper Gold',     cost:1200,tier:2,hat:'#ccff00',hatD:'#6a8a00',desc:'Legend tier. #667 approved.'},
];
const BDEFS=[
 {id:'waves', t:n=>'Survive '+n+' waves in one run',   ps:[3,5,8],       prz:[40,70,100]},
 {id:'score', t:n=>'Score '+n+' in one run',          ps:[1500,2500,4000],prz:[60,90,130]},
 {id:'near',  t:n=>n+' near-misses in one run',      ps:[15,30,50],     prz:[40,70,100]},
 {id:'shield',t:n=>'Grab '+n+' VERIFY shields in one run',ps:[2,4,6],    prz:[40,60,90]},
 {id:'clean', t:()=>'Survive a full wave with zero hits',ps:[0],        prz:[60]},
];
let runStats;
function runReset(){runStats={waves:0,deaths:0,earned:0,near:0,shields:0,cleanWave:false,hops:0}}
function ecoDef(){return{balance:0,earned:0,spent:0,burned:0,pool:500,dev:0,lifeScore:0,skin:'tinfoil',owned:['tinfoil'],day:'',bounties:[],dayBest:{waves:0,score:0,near:0,shields:0,cleanWave:false}}}
let eco;
function ecoSave(){try{localStorage.setItem(ECO_KEY,JSON.stringify(eco))}catch(e){}}
function ecoLoad(){try{const d=JSON.parse(localStorage.getItem(ECO_KEY)||'null');if(d&&typeof d.balance==='number')return Object.assign(ecoDef(),d)}catch(e){}return ecoDef()}
eco=ecoLoad();
function todayStr(){return new Date().toISOString().slice(0,10)}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function genBounties(){
  const t=todayStr(),h=hashStr('rd-bounty-'+t);
  const order=BDEFS.map((d,i)=>({d,k:((h>>>(i*3))%7)*13+i})).sort((a,b)=>a.k-b.k).map(o=>o.d).slice(0,3);
  eco.day=t;eco.bounties=order.map((d,i)=>{
    const pi=(h>>>(i*4))%d.ps.length;
    return{id:d.id,param:d.ps[pi],prize:d.prz[pi],done:false,claimed:false};
  });
  eco.dayBest={waves:0,score:0,near:0,shields:0,cleanWave:false};
  ecoSave();
}
if(eco.day!==todayStr()||!eco.bounties.length)genBounties();
function tier(){return eco.lifeScore>=TIER_NEED[2]?2:eco.lifeScore>=TIER_NEED[1]?1:0}
function tierNext(){const t=tier();return t>=2?null:TIER_NEED[t+1]-eco.lifeScore}
function skinHat(){const s=SKINS.find(s=>s.id===eco.skin);return s||SKINS[0]}
function splitOf(p){const pool=Math.floor(p*0.8),burn=Math.floor(p*0.1);return{pool,burn,dev:p-pool-burn}}
function splitTxt(p){const s=splitOf(p);return p+' = pool '+s.pool+' · burn '+s.burn+' · dev '+s.dev+' (demo)'}
function ecoRender(){
  const t=tier(),nx=tierNext();
  document.getElementById('eco').innerHTML=
    '🛟 <b>'+eco.balance+'</b> $RESCUE <span style="color:#5c665d">(demo)</span>'+
    ' · TIER <span class=tier>'+TIERS[t]+'</span>'+
    (nx!==null?' <span style="color:#5c665d">('+nx+' to '+TIERS[t+1]+')</span>':' <span style="color:#ccff00">MAX</span>')+
    ' · POOL <b>'+eco.pool+'</b> · <span id=fireline>'+esc(fireTxt)+'</span>';
  if(st==='o')showOvl();
}
function ecoEarn(n,why){eco.balance+=n;eco.earned+=n;runStats.earned+=n;ecoSave();ecoRender();toast('+'+n+' 🛟 '+why+' (demo)')}
function ecoSpend(price,what){
  if(eco.balance<price){toast('not enough 🛟 — need '+price+', have '+eco.balance+' (demo)');return null}
  const s=splitOf(price);
  eco.balance-=price;eco.spent+=price;eco.pool+=s.pool;eco.burned+=s.burn;eco.dev+=s.dev;
  ecoSave();ecoRender();
  toast('−'+price+' 🛟 '+what+': pool +'+s.pool+' · burn +'+s.burn+' · dev +'+s.dev+' (demo)');
  return s;
}
function bountyDone(b){const d=eco.dayBest;
  if(b.id==='waves')return d.waves>=b.param;
  if(b.id==='score')return d.score>=b.param;
  if(b.id==='near')return d.near>=b.param;
  if(b.id==='shield')return d.shields>=b.param;
  if(b.id==='clean')return !!d.cleanWave;
  return false}
function bountyProgress(b){const d=eco.dayBest;
  if(b.id==='waves')return 'best '+d.waves+'/'+b.param+' waves';
  if(b.id==='score')return 'best '+d.score+'/'+b.param;
  if(b.id==='near')return 'best '+d.near+'/'+b.param;
  if(b.id==='shield')return 'best '+d.shields+'/'+b.param;
  return b.id==='clean'?'needs a zero-hit wave':'—'}
function renderBounties(){
  document.getElementById('btyDay').innerHTML='<div style="color:#8a978b;margin-bottom:6px">challenges for '+esc(eco.day)+' — prizes paid from the bounty pool ('+eco.pool+' 🛟 demo). one claim each.</div>';
  document.getElementById('btyRows').innerHTML=eco.bounties.map((b,i)=>{
    const def=BDEFS.find(d=>d.id===b.id);
    const done=b.claimed||bountyDone(b);
    if(!b.done&&done){b.done=true;ecoSave()}
    const btn=b.claimed?'<button disabled>CLAIMED ✓</button>'
      :done?'<button data-claim="'+i+'">CLAIM '+b.prize+' 🛟</button>'
      :'<button disabled>'+bountyProgress(b)+'</button>';
    return '<div class=btyrow><div class=nm>'+esc(def.t(b.param))+'<br><span class=ds>prize '+b.prize+' 🛟 from pool</span></div>'+btn+'</div>';
  }).join('');
  document.querySelectorAll('#btyRows [data-claim]').forEach(el=>{
    el.addEventListener('click',()=>{claimBounty(+el.getAttribute('data-claim'))});
  });
}
function claimBounty(i){
  const b=eco.bounties[i];
  if(!b||b.claimed||!bountyDone(b))return false;
  const pay=Math.min(b.prize,eco.pool);
  eco.pool-=pay;eco.balance+=pay;eco.earned+=pay;b.claimed=true;
  ecoSave();ecoRender();renderBounties();
  toast('bounty claimed: +'+pay+' 🛟 from the pool (demo)');
  beep(880,.12);
  return true;
}
function renderShop(){
  const t=tier();
  document.getElementById('shopRows').innerHTML=SKINS.map(s=>{
    const owned=eco.owned.includes(s.id),equipped=eco.skin===s.id;
    const tierOk=t>=s.tier;
    let btn;
    if(equipped)btn='<button class=eq disabled>EQUIPPED</button>';
    else if(owned)btn='<button data-equip="'+s.id+'">EQUIP</button>';
    else if(!tierOk)btn='<button disabled>needs '+TIERS[s.tier]+'</button>';
    else btn='<button data-buy="'+s.id+'" '+(eco.balance<s.cost?'disabled':'')+'>BUY '+s.cost+' 🛟</button>';
    return '<div class=shoprow><div class=nm><span class=hatdot style="background:'+s.hat+'"></span>'+esc(s.name)+
      '<br><span class=ds>'+esc(s.desc)+'</span><br><span class=split>'+(s.cost?splitTxt(s.cost):'free · no split')+'</span></div>'+btn+'</div>';
  }).join('')+'<div style="color:#8a978b;font-size:10px;margin-top:6px">every purchase splits 80% → bounty pool · 10% → demo-burn · 10% → dev. hats are pure drip — zero gameplay advantage.</div>';
  document.querySelectorAll('#shopRows [data-buy]').forEach(el=>{
    el.addEventListener('click',()=>{buySkin(el.getAttribute('data-buy'))});
  });
  document.querySelectorAll('#shopRows [data-equip]').forEach(el=>{
    el.addEventListener('click',()=>{equipSkin(el.getAttribute('data-equip'))});
  });
}
function buySkin(id){
  const s=SKINS.find(s=>s.id===id);
  if(!s||eco.owned.includes(id)||tier()<s.tier||eco.balance<s.cost)return false;
  if(!ecoSpend(s.cost,'hat: '+s.name))return false;
  eco.owned.push(id);eco.skin=id;ecoSave();ecoRender();renderShop();
  return true;
}
function equipSkin(id){
  if(!eco.owned.includes(id))return false;
  eco.skin=id;ecoSave();renderShop();
  toast('equipped: '+SKINS.find(s=>s.id===id).name+' (demo)');
  return true;
}
function ecoEndRun(){
  const before=tier();
  eco.lifeScore+=sc;eco.runs=(eco.runs||0)+1;
  const d=eco.dayBest;
  d.waves=Math.max(d.waves,runStats.waves);d.score=Math.max(d.score,sc);
  d.near=Math.max(d.near,runStats.near);d.shields=Math.max(d.shields,runStats.shields);
  if(runStats.cleanWave)d.cleanWave=true;
  ecoSave();
  const after=tier();
  if(after>before){toast('⬆ TIER UP: '+TIERS[after]+' — new hats unlocked in the shop!');beep(990,.2)}
  ecoRender();
}
let panelOpen=false;
function openPanel(which){
  if(st==='p')st='z';
  panelOpen=true;
  document.getElementById('panelShop').hidden=which!=='shop';
  document.getElementById('panelBounty').hidden=which!=='bounty';
  if(which==='shop')renderShop();
  if(which==='bounty')renderBounties();
}
function closePanels(){
  panelOpen=false;
  document.getElementById('panelShop').hidden=true;
  document.getElementById('panelBounty').hidden=true;
  if(st==='z')st='p';
}
function showOvl(){
  document.getElementById('ovlScore').textContent='score '+sc+' · wave '+wv+' · '+runStats.near+' near-misses · +'+runStats.earned+' 🛟 earned this run (demo)';
  document.getElementById('ovlSplit').textContent='continue splits '+splitTxt(CONTINUE_COST);
  const cb=document.getElementById('bContinue');
  cb.disabled=eco.balance<CONTINUE_COST;
  cb.textContent=eco.balance<CONTINUE_COST?'CONTINUE — need '+CONTINUE_COST+' 🛟':'CONTINUE +2 ❤ — '+CONTINUE_COST+' 🛟 (demo)';
  document.getElementById('ovl').hidden=false;
}
function hideOvl(){document.getElementById('ovl').hidden=true}
let furnaceState=null;
function syncFurnace(){
  const show=(st==='t'||st==='z'||st==='o')&&!panelOpen;
  if(show===furnaceState)return;
  furnaceState=show;
  document.getElementById('furnace').style.display=show?'flex':'none';
}

/* ================= core game ================= */
const PR=11; // player radius
let px,py,pvx,pvy;
const RUG_DEFS={
  roll:{map:RUG_RED, vy:95,  w:12*PX,h:9*PX},
  zig: {map:RUG_PURPLE,vy:115, w:12*PX,h:9*PX},
  fast:{map:RUG_TEAL,vy:175, w:12*PX,h:9*PX},
};
function rugKindFor(wave,spawnedIdx){
  const r=Math.random();
  if(wave>=4&&r<0.22)return 'fast';
  if(wave>=2&&r<0.45)return 'zig';
  return 'roll';
}
function startWave(n){
  wv=n;
  toSpawn=5+n*2;
  spawned=0;
  spdMul=1+(n-1)*0.09;
  spawnInt=Math.max(0.35,1.15-n*0.07);
  spawnT=0.6;
  hitsThisWave=0;
  waveBanner='WAVE '+n;
  waveBannerT=2.2;
  // imps join from wave 3
  if(n>=3){
    const imps_n=Math.min(3,Math.floor((n-1)/2));
    for(let i=0;i<imps_n;i++)spawnImp();
  }
  // a pickup drops every wave: mostly verify, sometimes heart, sometimes a mimic
  const r=Math.random();
  const kind=r<0.55?'verify':r<0.75?'mimic':'heart';
  pickups.push({x:rnd(50,W-50),y:-20,vy:55,kind,t:0,mimic:kind==='mimic'});
  hud();beep(520,.08);
}
function spawnImp(){
  imps.push({x:Math.random()<0.5?-30:W+30,y:rnd(90,300),vx:(Math.random()<0.5?1:-1)*rnd(50,80)*(1+wv*0.05),ph:rnd(0,6.28)});
}
function queueRug(){
  const kind=rugKindFor(wv,spawned);
  const def=RUG_DEFS[kind];
  const wpx=def.w+8;
  const sx=rnd(20,W-20-wpx);
  telegraphs.push({x:sx,w:wpx,t:0.9,kind});
  spawned++;
}
function fireTelegraph(t){
  const def=RUG_DEFS[t.kind];
  const rug={x:t.x,y:-def.h-4,vy:def.vy*spdMul,vx:0,kind:t.kind,
    def:def,ph:rnd(0,6.28),counted:false,dead:false};
  if(t.kind==='zig')rug.vx=rnd(40,70);
  rugs.push(rug);
}
function burst(x0,y0,n){
  for(let i=0;i<n;i++){
    const a=(i/n)*Math.PI*2+rnd(-0.2,0.2);
    rugs.push({x:clamp(x0+Math.cos(a)*60,10,W-40),y:clamp(y0+Math.sin(a)*60,-80,120),
      vy:RUG_DEFS.fast.vy*spdMul*0.9,vx:0,kind:'fast',def:RUG_DEFS.fast,ph:rnd(0,6.28),counted:true,dead:false});
  }
}
function addParts(x0,y0,n,cols){
  for(let i=0;i<n;i++){
    parts.push({x:x0,y:y0,vx:rnd(-140,140),vy:rnd(-160,40),
      life:rnd(0.3,0.8),t:0,c:cols[(Math.random()*cols.length)|0],s:rnd(2,5)});
  }
}
function addFloater(x0,y0,txt,c){floaters.push({x:x0,y:y0,txt:txt,c:c||'#ccff00',t:0,life:1.1})}
function newGame(){
  sc=0;lv=3;wv=0;combo=0;comboT=0;shieldT=0;ifrT=0;hitStop=0;shakeT=0;flashT=0;overT=0;
  rugs=[];telegraphs=[];imps=[];pickups=[];parts=[];floaters=[];
  px=W/2;py=H-70;pvx=0;pvy=0;dragOn=false;
  runReset();
  st='t';hideOvl();closePanels();hud();ecoRender();
}
function go(){
  if(st==='t'){st='p';startWave(1)}
  else if(st==='o'){hideOvl();newGame();st='p';startWave(1)}
}
function hud(){
  let s='SCORE <b>'+sc+'</b> &nbsp;WAVE <b>'+wv+'</b> &nbsp;LIVES <b>'+lv+'</b>';
  if(combo>1)s+=' &nbsp;<b style="color:#ccff00">x'+combo+'</b>';
  if(shieldT>0)s+=' &nbsp;<span class=sh>🛡 '+Math.ceil(shieldT)+'s</span>';
  document.getElementById('h').innerHTML=s;
}
function hurt(){
  lv--;combo=0;comboT=0;runStats.deaths++;hitsThisWave++;
  shakeT=0.45;flashT=0.3;hitStop=0.12;ifrT=2;
  addParts(px,py,22,['#ff6b6b','#e04848','#ffffff']);
  beep(160,.25,'sawtooth');
  hud();
  if(lv<=0)gameOver();
}
function nearMiss(rug){
  rug.counted=true;
  combo++;comboT=3;runStats.near++;
  const pts=5*combo;
  sc+=pts;
  addFloater(px,py-24,'+'+pts+' NEAR MISS','#ccff00');
  addParts(px,py,6,['#ccff00','#7CFF6B']);
  beep(600+combo*60,.08);
  hud();
}
function grabPickup(p){
  if(p.kind==='verify'){
    shieldT=6;runStats.shields++;
    toast('🛡 VERIFY SHIELD — safe lanes revealed (demo)');
    addParts(p.x,p.y,14,['#37f2e8','#9fd8ff']);
    beep(760,.15);
  }else if(p.kind==='heart'){
    if(lv<5){lv++;toast('+1 ❤ (demo)')}else{sc+=100;toast('+100 — already max ❤ (demo)')}
    addParts(p.x,p.y,14,['#e04848','#ff9d9d']);
    beep(700,.12);
  }else if(p.kind==='mimic'){
    toast('😤 MIMIC! verify before you believe');
    addParts(p.x,p.y,26,['#ff4d4d','#b03a3a','#ffd75e']);
    burst(px,py,6);
    shakeT=0.5;combo=0;comboT=0;
    beep(140,.3,'sawtooth');
  }
  hud();
}
function waveClear(){
  runStats.waves++;
  sc+=50;
  ecoEarn(10,'wave '+wv+' survived');
  addFloater(W/2,H/2-40,'WAVE '+wv+' CLEAR  +10 🛟','#7CFF6B');
  if(hitsThisWave===0){runStats.cleanWave=true;addFloater(W/2,H/2-16,'CLEAN WAVE','#37f2e8')}
  if(wv%5===0){ecoEarn(25,'milestone: '+wv+' waves');addFloater(W/2,H/2+8,'MILESTONE +25 🛟','#ccff00')}
  beep(880,.15);
  startWave(wv+1);
}
function gameOver(){st='o';overT=Date.now();ecoEndRun();showOvl();beep(120,.5,'sawtooth')}
// guard: ignore accidental tap/key restart in the first beat after death
function restartArmed(){return Date.now()-overT>900}
function upd(dt){
  if(hitStop>0){hitStop-=dt;return}
  if(st!=='p')return;
  // survival score
  survAcc+=dt;
  if(survAcc>=1){survAcc-=1;sc+=10;hud()}
  // timers
  if(shieldT>0){shieldT-=dt;if(shieldT<=0)hud()}
  if(ifrT>0)ifrT-=dt;
  if(comboT>0){comboT-=dt;if(comboT<=0&&combo>0){combo=0;hud()}}
  if(shakeT>0)shakeT-=dt;
  if(flashT>0)flashT-=dt;
  if(waveBannerT>0)waveBannerT-=dt;
  // player movement: keyboard
  const SPD=175;
  let ax=0,ay=0;
  if(keys.left)ax-=1;if(keys.right)ax+=1;
  if(keys.up)ay-=1;if(keys.down)ay+=1;
  if(ax||ay){
    const m=Math.hypot(ax,ay);ax/=m;ay/=m;
    px+=ax*SPD*dt;py+=ay*SPD*dt;
    dragOn=false;
  }else if(dragOn){
    const k=Math.min(1,dt*14);
    px+=(dragX-px)*k;py+=(dragY-24-py)*k;
  }
  px=clamp(px,16,W-16);py=clamp(py,50,H-20);
  // wave spawning
  if(spawned<toSpawn){
    spawnT-=dt;
    if(spawnT<=0){queueRug();spawnT=spawnInt*rnd(0.7,1.3)}
  }
  for(let i=telegraphs.length-1;i>=0;i--){
    const t=telegraphs[i];
    t.t-=dt;
    if(t.t<=0){fireTelegraph(t);telegraphs.splice(i,1)}
  }
  // rugs
  for(let i=rugs.length-1;i>=0;i--){
    const r=rugs[i];
    r.y+=r.vy*dt;
    if(r.kind==='zig'){r.ph+=dt*3;r.x+=Math.sin(r.ph)*r.vx*dt}
    r.x=clamp(r.x,4,W-4-r.def.w);
    const cx=r.x+r.def.w/2,cy=r.y+r.def.h/2;
    // near-miss: close but not touching, rug passing the player
    if(!r.counted&&!r.dead){
      const dx=Math.abs(px-cx),dy=Math.abs(py-cy);
      if(dx<30&&dy<34&&!circleRect(px,py,PR,r.x+4,r.y+4,r.def.w-8,r.def.h-8)){
        nearMiss(r);
      }
    }
    // collision
    if(!r.dead&&circleRect(px,py,PR,r.x+4,r.y+4,r.def.w-8,r.def.h-8)){
      if(shieldT>0){
        r.dead=true;sc+=15;
        addFloater(cx,cy-10,'SHIELDED +15','#37f2e8');
        addParts(cx,cy,10,['#37f2e8','#9fd8ff']);
        beep(900,.1);
      }else if(ifrT<=0){
        hurt();
        r.dead=true;
        if(st!=='p')return;
      }
    }
    if(r.dead||r.y>H+40){rugs.splice(i,1)}
  }
  // imps
  for(let i=imps.length-1;i>=0;i--){
    const im=imps[i];
    im.x+=im.vx*dt;im.ph+=dt*4;im.y+=Math.sin(im.ph)*30*dt;
    if(im.x<-40||im.x>W+40){imps.splice(i,1);continue}
    if(shieldT<=0&&ifrT<=0&&circleRect(px,py,PR,im.x-8,im.y-8,16,16))hurt();
    else if(shieldT>0&&circleRect(px,py,PR,im.x-8,im.y-8,16,16)){
      imps.splice(i,1);sc+=15;addParts(im.x,im.y,10,['#37f2e8']);beep(900,.1);
    }
    if(st!=='p')return;
  }
  // pickups
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];
    p.y+=p.vy*dt;p.t+=dt;
    if(p.y>H+20){pickups.splice(i,1);continue}
    const dx=px-p.x,dy=py-p.y;
    if(dx*dx+dy*dy<20*20){grabPickup(p);pickups.splice(i,1)}
  }
  // particles & floaters
  for(let i=parts.length-1;i>=0;i--){
    const q=parts[i];q.t+=dt;
    if(q.t>=q.life){parts.splice(i,1);continue}
    q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=300*dt;
  }
  for(let i=floaters.length-1;i>=0;i--){
    const f=floaters[i];f.t+=dt;f.y-=28*dt;
    if(f.t>=f.life)floaters.splice(i,1);
  }
  // wave clear?
  if(spawned>=toSpawn&&rugs.length===0&&telegraphs.length===0)waveClear();
}

/* ================= draw ================= */
function drawBG(){
  x.fillStyle='#0b0e0c';x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(255,157,92,0.05)';x.lineWidth=1;
  x.beginPath();
  for(let gx=32;gx<W;gx+=32){x.moveTo(gx,0);x.lineTo(gx,H)}
  for(let gy=32;gy<H;gy+=32){x.moveTo(0,gy);x.lineTo(W,gy)}
  x.stroke();
  // danger zone glow at top where rugs enter
  x.fillStyle='rgba(176,58,58,0.10)';x.fillRect(0,0,W,44);
}
function drawFrog(dx,dy,scale){
  const hat=skinHat();
  const pal=Object.assign({},PAL,{T:hat.hat,t:hat.hatD});
  x.save();x.translate(dx,dy);x.scale(scale,scale);
  drawMap(FROG,0,0,pal);
  x.restore();
}
function draw(){
  x.save();
  if(shakeT>0)x.translate(rnd(-1,1)*shakeT*22,rnd(-1,1)*shakeT*22);
  drawBG();
  // telegraphs: fair warning stripes
  for(const t of telegraphs){
    const blink=(Math.sin(t.t*30)>0)?0.28:0.14;
    x.fillStyle=shieldT>0?'rgba(55,242,232,'+blink+')':'rgba(224,72,72,'+blink+')';
    x.fillRect(t.x,0,t.w,H);
  }
  for(const r of rugs){
    if(r.dead)continue;
    drawMap(r.def.map,r.x,r.y,PAL);
  }
  for(const im of imps)drawMap(IMP,im.x-10,im.y-10,PAL);
  for(const p of pickups){
    const bob=Math.sin(p.t*5)*3;
    if(p.kind==='heart')drawMap(HEART,p.x-8,p.y-8+bob,PAL);
    else drawMap(p.mimic?MIMIC:VERIFY,p.x-10,p.y-10+bob,PAL);
  }
  // player
  const blinkOff=ifrT>0&&(Math.floor(ifrT*12)%2===0);
  if(!blinkOff&&st!=='o'){
    if(shieldT>0){
      x.strokeStyle='#37f2e8';x.lineWidth=2;
      x.beginPath();x.arc(px,py,20+Math.sin(Date.now()/150)*2,0,7);x.stroke();
    }
    drawFrog(px-16,py-16,1);
  }
  // particles
  for(const q of parts){
    x.globalAlpha=1-q.t/q.life;
    x.fillStyle=q.c;
    x.fillRect(q.x-q.s/2,q.y-q.s/2,q.s,q.s);
  }
  x.globalAlpha=1;
  // floaters
  x.textAlign='center';
  for(const f of floaters){
    x.globalAlpha=1-f.t/f.life;
    x.fillStyle=f.c;x.font='bold 11px monospace';
    x.fillText(f.txt,f.x,f.y);
  }
  x.globalAlpha=1;
  x.textAlign='left';
  // wave banner
  if(waveBannerT>0){
    x.textAlign='center';
    x.globalAlpha=Math.min(1,waveBannerT);
    x.fillStyle='#ff9d5c';x.font='bold 30px monospace';
    x.fillText(waveBanner,W/2,H/2-20);
    x.font='12px monospace';x.fillStyle='#c9d4ca';
    x.fillText("don't get pulled.",W/2,H/2+6);
    x.globalAlpha=1;x.textAlign='left';
  }
  // hit flash
  if(flashT>0){x.fillStyle='rgba(224,72,72,'+(flashT*1.2)+')';x.fillRect(0,0,W,H)}
  // screens
  if(st==='t'){
    x.fillStyle='rgba(0,0,0,0.78)';x.fillRect(0,0,W,H);
    x.textAlign='center';
    x.fillStyle='#ff9d5c';x.font='bold 34px monospace';
    x.fillText('RUG DODGE',W/2,H/2-84);
    drawFrog(W/2-16,H/2-64,1);
    x.fillStyle='#c9d4ca';x.font='12px monospace';
    x.fillText('the rugs are falling. verify everything.',W/2,H/2-8);
    x.fillStyle='#37f2e8';x.font='11px monospace';
    x.fillText('grab the magnifier = VERIFY shield',W/2,H/2+12);
    x.fillStyle='#ff6b6b';x.font='11px monospace';
    x.fillText('but some magnifiers are MIMICS 😤',W/2,H/2+30);
    x.fillStyle='#ccff00';x.font='11px monospace';
    x.fillText('earn 🛟 $RESCUE (demo) · shop hats · daily bounties',W/2,H/2+50);
    if(Math.floor(Date.now()/500)%2===0){
      x.fillStyle='#7CFF6B';x.font='bold 13px monospace';
      x.fillText('PRESS ANY KEY / TAP TO START',W/2,H/2+78);
    }
    x.textAlign='left';
  }else if(st==='o'){
    x.fillStyle='rgba(0,0,0,0.82)';x.fillRect(0,0,W,H);
    x.textAlign='center';
    x.fillStyle='#ff7b7b';x.font='bold 30px monospace';
    x.fillText('RUG PULLED',W/2,H/2-24);
    x.fillStyle='#c9d4ca';x.font='13px monospace';
    x.fillText('SCORE '+sc+' · WAVE '+wv,W/2,H/2+2);
    x.fillStyle='#7CFF6B';x.font='bold 12px monospace';
    if(Math.floor(Date.now()/500)%2===0)x.fillText('CONTINUE OR RESTART BELOW',W/2,H/2+32);
    x.textAlign='left';
  }else if(st==='z'&&!panelOpen){
    x.fillStyle='rgba(0,0,0,0.6)';x.fillRect(0,0,W,H);
    x.textAlign='center';
    x.fillStyle='#ff9d5c';x.font='bold 26px monospace';
    x.fillText('PAUSED',W/2,H/2);
    x.fillStyle='#c9d4ca';x.font='12px monospace';
    x.fillText('press P or PLAY to resume',W/2,H/2+26);
    x.textAlign='left';
  }
  syncFurnace();
  syncBtns();
  x.restore();
}
/* ================= input ================= */
/* input labels follow game state (updated on change only) */
let lastBtn='';
function syncBtns(){
  const pb=st==='z'&&!panelOpen?'▶ RESUME':'▶ PLAY';
  const ps=st==='z'&&!panelOpen?'▶ RESUME':'II PAUSE';
  const key=pb+'|'+ps;
  if(key===lastBtn)return;
  lastBtn=key;
  document.getElementById('bPlay').innerHTML=pb;
  document.getElementById('bPause').innerHTML=ps;
}
function togglePause(){
  if(panelOpen)return;
  if(st==='p'){st='z';beep(330,.08)}
  else if(st==='z'){st='p';beep(440,.08)}
}
function doContinue(){
  if(eco.balance<CONTINUE_COST)return false;
  ecoSpend(CONTINUE_COST,'continue');
  hideOvl();lv=2;combo=0;ifrT=2;
  px=W/2;py=H-70;rugs=[];telegraphs=[];imps=[];
  st='p';hud();
  return true;
}
function doRestart(){hideOvl();newGame();st='p';startWave(1)}
document.getElementById('bPlay').addEventListener('click',()=>{if(st==='z'&&panelOpen)closePanels();else if(st==='z')togglePause();else go()});
document.getElementById('bShop').addEventListener('click',()=>openPanel('shop'));
document.getElementById('bBounty').addEventListener('click',()=>openPanel('bounty'));
document.getElementById('bPause').addEventListener('click',togglePause);
document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',closePanels));
document.getElementById('bRestart').addEventListener('click',doRestart);
document.getElementById('bContinue').addEventListener('click',doContinue);
document.addEventListener('keydown',e=>{
  const k=e.key;
  if(k.indexOf('Arrow')===0||k===' ')e.preventDefault();
  if((k==='p'||k==='P')&&(st==='p'||st==='z')){togglePause();return}
  if(st==='t'){go();return}
  if(st==='o'){if(restartArmed())go();return}
  if(k==='ArrowUp'||k==='w'||k==='W')keys.up=true;
  else if(k==='ArrowDown'||k==='s'||k==='S')keys.down=true;
  else if(k==='ArrowLeft'||k==='a'||k==='A')keys.left=true;
  else if(k==='ArrowRight'||k==='d'||k==='D')keys.right=true;
});
document.addEventListener('keyup',e=>{
  const k=e.key;
  if(k==='ArrowUp'||k==='w'||k==='W')keys.up=false;
  else if(k==='ArrowDown'||k==='s'||k==='S')keys.down=false;
  else if(k==='ArrowLeft'||k==='a'||k==='A')keys.left=false;
  else if(k==='ArrowRight'||k==='d'||k==='D')keys.right=false;
});
function canvasPos(e){
  const r=cv.getBoundingClientRect();
  return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};
}
cv.addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(st==='t'){go();return}
  if(st==='o'){if(restartArmed())go();return}
  if(st!=='p')return;
  const p=canvasPos(e);
  dragOn=true;dragX=p.x;dragY=p.y;
});
cv.addEventListener('pointermove',e=>{
  if(!dragOn||st!=='p')return;
  const p=canvasPos(e);
  dragX=p.x;dragY=p.y;
});
window.addEventListener('pointerup',()=>{dragOn=false});
window.addEventListener('pointercancel',()=>{dragOn=false});
/* auto-pause when the tab goes to background — no deaths while tabbed away */
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&st==='p')togglePause();
});
let last=0;
function frame(ts){
  const dt=Math.min(.05,(ts-last)/1000||.016);
  last=ts;upd(dt);draw();
  requestAnimationFrame(frame);
}
/* test hook: only with #testhook */
if(location.hash==='#testhook'){
  window.__rd={
    get st(){return st},get sc(){return sc},get lv(){return lv},get wv(){return wv},
    get combo(){return combo},get shieldT(){return shieldT},get rugsN(){return rugs.length},
    eco:()=>eco,go,newGame,togglePause,upd,draw,hud,doContinue,doRestart,
    claimBounty,bountyDone,tier,TIERS,buySkin,equipSkin,ecoEarn,ecoSpend,gameOver,showOvl,
    rugs:()=>rugs,telegraphs:()=>telegraphs,imps:()=>imps,pickups:()=>pickups,
    player:()=>({x:px,y:py}),
    setPlayer:(a,b)=>{px=a;py=b},
    spawnRug:(kind,rx)=>{const def=RUG_DEFS[kind||'roll'];rugs.push({x:rx==null?rnd(20,W-60):rx,y:-40,vy:def.vy*spdMul,vx:0,kind:kind||'roll',def:def,ph:0,counted:false,dead:false})},
    forcePickup:(kind)=>{pickups.push({x:px,y:py,vy:0,kind:kind,t:0,mimic:kind==='mimic'})},
    forceHurt:()=>{hurt()},
    restartArmed:()=>restartArmed(),
    overT:()=>overT,
    startWave:(n)=>startWave(n)
  };
}
/* init */
newGame();
try{
  RescueBurn.renderWidget(document.getElementById('burnMount'));
  const refreshFire=()=>{
    try{
      RescueBurn.getStatus().then(s=>{
        if(s&&s.ok){fireTxt='🔥 '+s.total+' burnt (live)';ecoRender()}
        else{fireTxt='🔥 furnace offline';ecoRender()}
      }).catch(()=>{fireTxt='🔥 furnace offline';ecoRender()});
    }catch(e){fireTxt='🔥 furnace offline'}
  };
  refreshFire();
  setInterval(refreshFire,60000);
}catch(e){fireTxt='🔥 furnace offline'}
requestAnimationFrame(frame);
})();
