'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const SAVE_KEY = 'cookie_clicker_rp_v01';
const BUILDINGS = [
  {id:'cursor',name:'Curseur',icon:'🖱️',baseCost:15,baseCps:.1,desc:'Clique automatiquement.'},
  {id:'grandma',name:'Grand-mère',icon:'👵',baseCost:100,baseCps:1,desc:'Cuit des cookies avec amour.'},
  {id:'farm',name:'Ferme',icon:'🌾',baseCost:1100,baseCps:8,desc:'Cultive des cookies.'},
  {id:'mine',name:'Mine',icon:'⛏️',baseCost:12000,baseCps:47,desc:'Extrait des pépites de cookie.'},
  {id:'factory',name:'Usine',icon:'🏭',baseCost:130000,baseCps:260,desc:'Produit en masse.'},
  {id:'bank',name:'Banque',icon:'🏦',baseCost:1400000,baseCps:1400,desc:'Investit dans les cookies.'},
  {id:'temple',name:'Temple',icon:'🛕',baseCost:20000000,baseCps:7800,desc:'Bénédiction sucrée.'},
  {id:'wizard',name:'Tour de sorcier',icon:'🧙',baseCost:330000000,baseCps:44000,desc:'Magie biscuitée.'},
  {id:'shipment',name:'Expédition',icon:'🚀',baseCost:5100000000,baseCps:260000,desc:'Cookies depuis l’espace.'},
  {id:'lab',name:'Laboratoire',icon:'🧪',baseCost:75000000000,baseCps:1600000,desc:'Science du cookie.'}
];
const UPGRADES = [
  {id:'mouse1',name:'Meilleure souris',icon:'🖱️',cost:100,desc:'+1 par clic',unlock:g=>g.totalClicks>=10,effect:g=>g.cpc+=1},
  {id:'mouse2',name:'Double clic',icon:'⚡',cost:5000,desc:'Clics x2',unlock:g=>g.totalClicks>=100,effect:g=>g.cpc*=2},
  {id:'grandma1',name:'Lunettes de mamie',icon:'👓',cost:1000,desc:'Grand-mères x2',unlock:g=>g.buildings.grandma.count>=1,effect:g=>g.buildings.grandma.mult*=2},
  {id:'farm1',name:'Engrais',icon:'🌱',cost:12000,desc:'Fermes x2',unlock:g=>g.buildings.farm.count>=3,effect:g=>g.buildings.farm.mult*=2},
  {id:'mine1',name:'Dynamite sucrée',icon:'💣',cost:200000,desc:'Mines x2',unlock:g=>g.buildings.mine.count>=3,effect:g=>g.buildings.mine.mult*=2},
  {id:'factory1',name:'Chaîne optimisée',icon:'🔧',cost:1500000,desc:'Usines x2',unlock:g=>g.buildings.factory.count>=3,effect:g=>g.buildings.factory.mult*=2},
  {id:'luxury',name:'Biscuits de luxe',icon:'💎',cost:5000000,desc:'Clics x5',unlock:g=>g.totalBaked>=1000000,effect:g=>g.cpc*=5}
];
const ACHIEVEMENTS = [
  {id:'a1',icon:'🍪',name:'Premier cookie',desc:'Cuire 1 cookie',done:g=>g.totalBaked>=1},
  {id:'a2',icon:'💯',name:'Centenaire',desc:'Cuire 100 cookies',done:g=>g.totalBaked>=100},
  {id:'a3',icon:'🖱️',name:'Cliqueur',desc:'Faire 100 clics',done:g=>g.totalClicks>=100},
  {id:'a4',icon:'🏭',name:'Industriel',desc:'Avoir 1 usine',done:g=>g.buildings.factory.count>=1},
  {id:'a5',icon:'💰',name:'Millionnaire',desc:'Cuire 1 million',done:g=>g.totalBaked>=1_000_000},
  {id:'a6',icon:'👑',name:'Baron du cookie',desc:'Cuire 1 milliard',done:g=>g.totalBaked>=1_000_000_000}
];
const NEWS = ['Des grand-mères protestent contre la pénurie de lait.','Un cookie géant aperçu au-dessus de Los Santos.','La bourse du biscuit explose.','Des usines tournent jour et nuit.','Le gouvernement envisage une taxe sur les cookies.'];

const game = {
  cookies:0,totalBaked:0,totalClicks:0,cpc:1,cps:0,playTime:0,lastSave:Date.now(),buyMode:'1',clickVolume:.35,
  buildings:Object.fromEntries(BUILDINGS.map(b=>[b.id,{count:0,mult:1}])),
  upgrades:{}, achievements:{}, lastFrame:0, lastUi:0, dirtyShop:true, dirtyAch:true
};

let audioCtx;
let audioEnabled = true;

function getAudioContext(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}
function playClickSound(){
  if(!audioEnabled) return;

  const ctx = getAudioContext();
  const volume = Number(document.getElementById("volume")?.value || 35) / 100;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "square";
  osc.frequency.setValueAtTime(950, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.035);

  filter.type = "highpass";
  filter.frequency.value = 350;

  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08 * volume, ctx.currentTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}
function fmt(n){ if(!isFinite(n))return'∞'; if(n<1000)return Math.floor(n).toString(); const u=['','k','M','B','T','Qa','Qi','Sx','Sp']; let i=0; while(n>=1000&&i<u.length-1){n/=1000;i++} return n.toFixed(2)+' '+u[i]; }
function time(s){s=Math.floor(s); const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return h?`${h}h ${m}m`:m?`${m}m ${sec}s`:`${sec}s`;}
function buildingCost(b,count=game.buildings[b.id].count){return Math.ceil(b.baseCost*Math.pow(1.15,count));}
function costFor(b,n){let total=0,c=game.buildings[b.id].count; for(let i=0;i<n;i++) total+=buildingCost(b,c+i); return total;}
function maxAffordable(b){let n=0,total=0,c=game.buildings[b.id].count; while(n<10000){const next=buildingCost(b,c+n); if(total+next>game.cookies)break; total+=next;n++} return {n,total};}
function recalc(){game.cps=BUILDINGS.reduce((s,b)=>s+game.buildings[b.id].count*b.baseCps*game.buildings[b.id].mult,0)}
function log(msg){const d=document.createElement('div');d.textContent='• '+msg;$('#log').prepend(d);while($('#log').children.length>40)$('#log').lastChild.remove();}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;$('#toastLayer').appendChild(t);setTimeout(()=>t.remove(),2600)}
function floating(x,y,text){const f=document.createElement('div');f.className='floating';f.textContent=text;f.style.left=x+'px';f.style.top=y+'px';$('#floatLayer').appendChild(f);setTimeout(()=>f.remove(),850)}

function clickCookie(e){
  game.cookies += game.cpc;
  game.totalBaked += game.cpc;
  game.totalClicks++;

  game.dirtyShop = true;

  playClickSound();

  floating(e.clientX - 8, e.clientY - 12, '+' + fmt(game.cpc));
  checkAchievements();
}
function buyBuilding(id){const b=BUILDINGS.find(x=>x.id===id); let qty=game.buyMode==='max'?maxAffordable(b).n:Number(game.buyMode); if(!qty)return; const price=game.buyMode==='max'?maxAffordable(b).total:costFor(b,qty); if(price>game.cookies)return; game.cookies-=price; game.buildings[id].count+=qty; recalc(); game.dirtyShop=true; playClickSound(); log(`Acheté ${qty} x ${b.name}`); checkAchievements();}
function buyUpgrade(id){const u=UPGRADES.find(x=>x.id===id); if(!u||game.upgrades[id]||game.cookies<u.cost||!u.unlock(game))return; game.cookies-=u.cost; game.upgrades[id]=true; u.effect(game); recalc(); game.dirtyShop=true; playClickSound(); toast('⭐ Amélioration : '+u.name); log('Amélioration : '+u.name);}
function checkAchievements(){let changed=false; for(const a of ACHIEVEMENTS){if(!game.achievements[a.id]&&a.done(game)){game.achievements[a.id]=true;changed=true;toast('🏆 '+a.name);log('Succès débloqué : '+a.name)}} if(changed)game.dirtyAch=true;}

function renderShop(){const shop=$('#shop'); shop.innerHTML=''; for(const b of BUILDINGS){const cost=game.buyMode==='max'?maxAffordable(b).total:costFor(b,Number(game.buyMode)); const div=document.createElement('div'); div.className='building'+(game.cookies<cost||!cost?' disabled':''); div.onclick=()=>buyBuilding(b.id); div.innerHTML=`<div class="b-icon">${b.icon}</div><div><div class="b-name">${b.name}</div><div class="b-desc">${b.desc}</div><div class="b-cost">${fmt(cost||buildingCost(b))} 🍪 • ${fmt(b.baseCps*game.buildings[b.id].mult)}/s</div></div><div class="b-owned">${game.buildings[b.id].count}</div>`; shop.appendChild(div)} for(const u of UPGRADES){if(!u.unlock(game))continue; const div=document.createElement('div'); const affordable =
    game.cookies >= u.cost &&
    !game.upgrades[u.id];

div.className =
    'building upgrade ' +
    (
        game.upgrades[u.id]
            ? 'bought'
            : affordable
                ? 'affordable'
                : 'disabled'
    ); div.onclick=()=>buyUpgrade(u.id); div.innerHTML=`<div class="b-icon">${u.icon}</div><div><div class="b-name">${u.name}</div><div class="b-desc">${u.desc}</div><div class="b-cost">${fmt(u.cost)} 🍪</div></div><div class="b-owned">${game.upgrades[u.id]?'✓':'⭐'}</div>`; shop.appendChild(div)} game.dirtyShop=false;}
function renderAchievements(){const box=$('#achievements'); box.innerHTML=''; for(const a of ACHIEVEMENTS){const ok=!!game.achievements[a.id]; const d=document.createElement('div'); d.className='achievement '+(ok?'':'locked'); d.innerHTML=`<div class="title">${ok?'✅':'🔒'} ${a.icon} ${a.name}</div><div class="desc">${a.desc}</div>`; box.appendChild(d)} game.dirtyAch=false;}
function updateUI(){ $('#cookieCount').textContent=fmt(game.cookies); $('#cps').textContent=fmt(game.cps)+' / seconde'; $('#cpc').textContent='+'+fmt(game.cpc)+' / clic'; $('#totalBaked').textContent=fmt(game.totalBaked); $('#totalClicks').textContent=fmt(game.totalClicks); $('#playTime').textContent=time(game.playTime); $('#achCount').textContent=Object.values(game.achievements).filter(Boolean).length+'/'+ACHIEVEMENTS.length; if(game.dirtyShop)renderShop(); if(game.dirtyAch)renderAchievements();}
function save(){game.lastSave=Date.now(); localStorage.setItem(SAVE_KEY,JSON.stringify(game)); $('#saveStatus').textContent='💾 Sauvegardé'; setTimeout(()=>$('#saveStatus').textContent='💾 Sauvegarde locale',1200)}
function load(){const raw=localStorage.getItem(SAVE_KEY); if(!raw)return; try{const data=JSON.parse(raw); Object.assign(game,data); for(const b of BUILDINGS)game.buildings[b.id] ||= {count:0,mult:1}; recalc(); const offline=Math.min(28800,Math.floor((Date.now()-(game.lastSave||Date.now()))/1000)); if(offline>10&&game.cps>0){const gain=offline*game.cps; game.cookies+=gain; game.totalBaked+=gain; toast('⏱️ Hors ligne : +'+fmt(gain)+' cookies')}}catch(e){console.error(e)}}
function exportSave(){navigator.clipboard.writeText(btoa(unescape(encodeURIComponent(JSON.stringify(game)))));toast('Sauvegarde copiée')}
function importSave(){const code=prompt('Colle ta sauvegarde :'); if(!code)return; try{localStorage.setItem(SAVE_KEY,decodeURIComponent(escape(atob(code))));location.reload()}catch(e){toast('Sauvegarde invalide')}}
function reset(){if(confirm('Reset toute la progression ?')){localStorage.removeItem(SAVE_KEY);location.reload()}}
function loop(ts){if(!game.lastFrame)game.lastFrame=ts; const dt=(ts-game.lastFrame)/1000; game.lastFrame=ts; game.playTime+=dt; const gain=game.cps*dt; game.cookies+=gain; game.totalBaked+=gain; if(ts-game.lastUi>100){updateUI();game.lastUi=ts} requestAnimationFrame(loop)}
function init(){load(); $('#cookieBtn').onclick=clickCookie; $('#volume').value=Math.round(game.clickVolume*100); $('#volume').oninput=e=>game.clickVolume=e.target.value/100; $$('.mode').forEach(b=>b.onclick=()=>{$$('.mode').forEach(x=>x.classList.remove('active'));b.classList.add('active');game.buyMode=b.dataset.mode;game.dirtyShop=true}); $('#exportBtn').onclick=exportSave; $('#importBtn').onclick=importSave; $('#resetBtn').onclick=reset; renderShop(); renderAchievements(); updateUI(); setInterval(save,10000); setInterval(()=>{$('#newsText').textContent=NEWS[Math.floor(Math.random()*NEWS.length)]+' •';},15000); log('Partie chargée'); requestAnimationFrame(loop)}
window.addEventListener('load',init);
