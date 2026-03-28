// رفيق المسلم – نسخة موسعة
// Build: 20260328-191810

const API_BASE='https://api.aladhan.com/v1';
const KAABA={lat:21.4225,lon:39.8262};
const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const LS=(k,v)=> (v===undefined?localStorage.getItem(k):localStorage.setItem(k,v));
let CFG=null;

function dayKey(){return new Date().toDateString();}
function toRad(x){return x*Math.PI/180;}
function toDeg(x){return x*180/Math.PI;}
function normalize360(x){x=x%360; if(x<0)x+=360; return x;}

function formatTime12h(d){
  try{return new Intl.DateTimeFormat('ar',{hour:'numeric',minute:'2-digit',hour12:true}).format(d);}
  catch(e){let h=d.getHours();const m=String(d.getMinutes()).padStart(2,'0');const suf=h>=12?'م':'ص';h=h%12||12;return `${h}:${m} ${suf}`;}
}

function setText(id,t){const el=document.getElementById(id); if(el) el.textContent=t;}
function isoToDate(iso){return new Date(iso);}
function dateToApi(d){const dd=String(d.getDate()).padStart(2,'0');const mm=String(d.getMonth()+1).padStart(2,'0');return `${dd}-${mm}-${d.getFullYear()}`;}

async function fetchTimingsByCoords(date,lat,lon){
  const ds=dateToApi(date);
  const url=`${API_BASE}/timings/${ds}?latitude=${lat}&longitude=${lon}&method=${CFG.calculation.method}&school=${CFG.calculation.school}&iso8601=true`;
  const r=await fetch(url); const j=await r.json(); if(j.code!==200) throw new Error('API');
  return j.data;
}
async function fetchTimingsByCity(date,city,country){
  const ds=dateToApi(date);
  const url=`${API_BASE}/timingsByCity/${ds}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${CFG.calculation.method}&school=${CFG.calculation.school}&iso8601=true`;
  const r=await fetch(url); const j=await r.json(); if(j.code!==200) throw new Error('API');
  return j.data;
}

function computeDuha(sunriseISO,dhuhrISO){
  const start=new Date(isoToDate(sunriseISO).getTime()+CFG.duha.startOffsetAfterSunriseMin*60000);
  const end=new Date(isoToDate(dhuhrISO).getTime()-CFG.duha.endOffsetBeforeDhuhrMin*60000);
  return {start,end};
}
function computeLastThird(maghribISO,fajrNextISO){
  const magh=isoToDate(maghribISO); const fajr=isoToDate(fajrNextISO);
  let night=fajr-magh; if(night<=0) night+=24*3600*1000;
  const third=night/3;
  return {start:new Date(fajr.getTime()-third), end:fajr};
}

function initialBearing(lat1,lon1,lat2,lon2){
  const φ1=toRad(lat1), φ2=toRad(lat2);
  const λ1=toRad(lon1), λ2=toRad(lon2);
  const y=Math.sin(λ2-λ1)*Math.cos(φ2);
  const x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  return normalize360(toDeg(Math.atan2(y,x)));
}

function translatePrayer(k){return ({Fajr:'الفجر',Sunrise:'الشروق',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'})[k]||k;}

function renderHijri(){
  try{const f=new Intl.DateTimeFormat('ar-SA-u-ca-islamic',{day:'numeric',month:'long',year:'numeric'}); setText('hijri',f.format(new Date()));}
  catch(e){setText('hijri','—');}
}

function setTheme(t){document.documentElement.setAttribute('data-theme',t); LS('theme',t);}
function initTheme(){const saved=LS('theme')||'dark'; setTheme(saved); qs('#toggleTheme').addEventListener('click',()=>setTheme((document.documentElement.getAttribute('data-theme')==='dark')?'light':'dark'));}

function initNav(){qsa('.nav button').forEach(btn=>btn.addEventListener('click',()=>{qsa('.nav button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); qsa('.section').forEach(s=>s.classList.remove('active')); qs('#'+btn.dataset.target).classList.add('active');}));}

function renderVersion(){setText('version',CFG.version); setText('build',CFG.build);}

function initCityList(){
  const cities=[
    {label:'الرياض',city:'Riyadh',country:'SA'},{label:'مكة المكرمة',city:'Makkah',country:'SA'},{label:'المدينة المنورة',city:'Al Madinah al Munawwarah',country:'SA'},
    {label:'جدة',city:'Jeddah',country:'SA'},{label:'الدمام',city:'Dammam',country:'SA'},{label:'الطائف',city:'Taif',country:'SA'},{label:'أبها',city:'Abha',country:'SA'},{label:'تبوك',city:'Tabuk',country:'SA'}
  ];
  const sel=qs('#citySelect');
  cities.forEach(c=>{const o=document.createElement('option'); o.value=JSON.stringify({city:c.city,country:c.country}); o.textContent=c.label; sel.appendChild(o);});
  const saved=LS('cityFallback'); if(saved) sel.value=saved;
  sel.addEventListener('change',()=>LS('cityFallback',sel.value));
}
function getCityFallback(){const v=LS('cityFallback'); if(v){try{return JSON.parse(v);}catch(e){}} return CFG.defaultCity;}

let nextTimer=null;
function renderNextPrayer(T,fajrTomorrowISO){
  const order=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  const now=new Date(); let name=null,time=null;
  for(const k of order){const d=isoToDate(T[k]); if(d>now){name=k; time=d; break;}}
  if(!name){name='Fajr'; time=isoToDate(fajrTomorrowISO);}
  setText('nextPrayerName',translatePrayer(name)); setText('nextPrayerTime',formatTime12h(time));
  if(nextTimer) clearInterval(nextTimer);
  nextTimer=setInterval(()=>{
    const diff=time-new Date();
    if(diff<=0){setText('nextCountdown','حان الوقت'); clearInterval(nextTimer); return;}
    const h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
    setText('nextCountdown',`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
  },1000);
}

async function loadPrayerTimes(forceCity=false){
  setText('ptStatus',''); setText('ptMeta','');
  const today=new Date(); const tomorrow=new Date(Date.now()+24*3600*1000);
  const c=getCityFallback();
  try{
    let td, td2;
    if(!forceCity && 'geolocation' in navigator){
      const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:10000,maximumAge:600000}));
      const lat=pos.coords.latitude, lon=pos.coords.longitude;
      setText('ptMeta',`موقعك: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      td=await fetchTimingsByCoords(today,lat,lon); td2=await fetchTimingsByCoords(tomorrow,lat,lon);
      await updateQiblaFromCoords(lat,lon);
    } else {
      setText('ptMeta',`مدينة مختارة: ${c.city}`);
      td=await fetchTimingsByCity(today,c.city,c.country); td2=await fetchTimingsByCity(tomorrow,c.city,c.country);
    }
    const T=td.timings, TT=td2.timings;
    ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'].forEach(k=>setText('t_'+k.toLowerCase(), formatTime12h(isoToDate(T[k]))));
    const duha=computeDuha(T.Sunrise,T.Dhuhr); setText('t_duha',`${formatTime12h(duha.start)} – ${formatTime12h(duha.end)}`);
    const last=computeLastThird(T.Maghrib,TT.Fajr); setText('t_lastthird',`${formatTime12h(last.start)} – ${formatTime12h(last.end)}`);
    renderNextPrayer(T,TT.Fajr);
  }catch(e){
    console.warn(e);
    setText('ptStatus','تعذّر تحديد الموقع/جلب المواقيت. جرّب اختيار مدينة.');
  }
}

async function updateQiblaFromCoords(lat,lon){
  const b=initialBearing(lat,lon,KAABA.lat,KAABA.lon);
  setText('qiblaDeg',`${b.toFixed(1)}°`);
  LS('qiblaBearing', String(b));
}
function loadStoredQibla(){const v=LS('qiblaBearing'); if(v) setText('qiblaDeg',`${parseFloat(v).toFixed(1)}°`);}

let headingEMA=null;
function shortestDelta(a,b){return (b-a+540)%360-180;}
function setupCompass(){
  const needle=qs('#needle');
  const accuracyEl=qs('#compassAccuracy');
  function renderNeedle(q,h){needle.style.transform=`translate(-50%,-100%) rotate(${normalize360(q-h)}deg)`;}
  function onOri(ev){
    let heading=null;
    if(typeof ev.webkitCompassHeading==='number' && ev.webkitCompassHeading>=0){
      heading=ev.webkitCompassHeading;
      if(typeof ev.webkitCompassAccuracy==='number') accuracyEl.textContent=`دقة البوصلة: ±${Math.round(ev.webkitCompassAccuracy)}°`;
    } else if(typeof ev.alpha==='number'){
      heading=360-ev.alpha; accuracyEl.textContent='دقة البوصلة: تقريبية';
    }
    if(heading==null) return;
    const q=parseFloat(LS('qiblaBearing')||'0')||0;
    if(headingEMA==null) headingEMA=heading;
    headingEMA=normalize360(headingEMA + shortestDelta(headingEMA,heading)*0.18);
    renderNeedle(q,headingEMA);
  }
  qs('#enableCompass').addEventListener('click', async ()=>{
    try{
      if(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission==='function'){
        const p=await DeviceOrientationEvent.requestPermission();
        if(p!=='granted') return;
      }
      window.addEventListener('deviceorientation', onOri, true);
      setText('compassStatus','تم تفعيل البوصلة');
    }catch(e){ setText('compassStatus','تعذّر تفعيل البوصلة'); }
  });
}

function formatRepeat(rem){return rem===0?'تم':`التكرار: ${rem}`;}
async function loadAdhkar(){
  const data=await (await fetch('./data/adhkar.json')).json();
  const mapping=[
    {id:'morning', key:'morning', title:'أذكار الصباح'},
    {id:'evening', key:'evening', title:'أذكار المساء'},
    {id:'sleep', key:'sleep', title:'أذكار النوم'},
    {id:'afterPrayer', key:'afterPrayer', title:'أذكار دبر الصلوات'},
    {id:'daily', key:'daily', title:'أذكار متفرقة'}
  ];
  mapping.forEach(m=>{
    const host=qs('#'+m.id); host.innerHTML=`<h3>${m.title}</h3>`;
    (data[m.key]||[]).forEach((it,i)=>{
      const max=it.repeat||1; const k=`dhikr:${m.key}:${i}:${dayKey()}`;
      let rem=LS(k); rem=rem==null?max:parseInt(rem,10);
      const card=document.createElement('div'); card.className='dhikr-card';
      const pct=Math.round(((max-rem)/max)*100);
      card.innerHTML=`<p class="dhikr-text">${it.text}</p><div class="small">المصدر: ${it.source||'—'}</div><div class="progress"><div style="width:${pct}%"></div></div><div class="actions"><div class="left"><button class="btn secondary copy">نسخ</button><a class="btn secondary" href="${it.ref||'#'}" target="_blank" rel="noopener">مرجع</a></div><button class="btn do">${formatRepeat(rem)}</button></div>`;
      card.querySelector('.copy').addEventListener('click', async ()=>{try{await navigator.clipboard.writeText(it.text);}catch(e){}});
      const btn=card.querySelector('.do'); const bar=card.querySelector('.progress>div');
      btn.addEventListener('click', ()=>{ if(rem<=0) return; rem-=1; LS(k,String(rem)); const p=Math.round(((max-rem)/max)*100); bar.style.width=p+'%'; btn.textContent=formatRepeat(rem); if(navigator.vibrate) navigator.vibrate(rem===0?[120,50,120]:40); });
      host.appendChild(card);
    });
  });
}

function setupTasbeeh(){
  let c=parseInt(LS('tasbeehCount')||'0',10);
  const disp=qs('#tasbeehCount'); disp.textContent=c;
  qs('#tasbeehBtn').addEventListener('click', ()=>{c+=1; disp.textContent=c; LS('tasbeehCount',String(c)); if(navigator.vibrate) navigator.vibrate(25); if(c%33===0 && navigator.vibrate) navigator.vibrate([120,50,120]);});
  qs('#tasbeehReset').addEventListener('click', ()=>{c=0; disp.textContent='0'; LS('tasbeehCount','0');});
}

async function loadResources(){
  const data=await (await fetch('./data/resources.json')).json();
  const mk=(id, list)=>{const ul=qs('#'+id); ul.innerHTML=''; (list||[]).forEach(it=>{const li=document.createElement('li'); li.innerHTML=`<a href="${it.url}" target="_blank" rel="noopener">${it.title}</a> <span class="small">— ${it.desc||''}</span>`; ul.appendChild(li);});};
  mk('resQuran', data.quran); mk('resHadith', data.hadith); mk('resFatwa', data.fatwa); mk('resTools', data.tools);
}

async function loadLearning(){
  const data=await (await fetch('./data/learning.json')).json();
  const plan=qs('#learnPlan'); plan.innerHTML='';
  (data.plan||[]).forEach(it=>{const div=document.createElement('div'); div.className='dhikr-card'; div.innerHTML=`<b>${it.title}</b><div class="small">${it.tip}</div>`; plan.appendChild(div);});
  const col=qs('#learnCollections'); col.innerHTML='';
  (data.collections||[]).forEach(it=>{const li=document.createElement('li'); li.innerHTML=`<a href="${it.url}" target="_blank" rel="noopener">${it.title}</a>`; col.appendChild(li);});
  const rem=qs('#learnReminders'); rem.innerHTML='';
  (data.reminders||[]).forEach(t=>{const li=document.createElement('li'); li.textContent=t; rem.appendChild(li);});
}

function setupTools(){
  const nisab=qs('#nisab'); const amount=qs('#amount'); const out=qs('#zakatOut');
  function calc(){
    const n=parseFloat(nisab.value||'0'); const a=parseFloat(amount.value||'0');
    if(!n || !a){ out.textContent='—'; return; }
    if(a < n){ out.textContent='لا زكاة (أقل من النصاب)'; return; }
    const z=a*0.025;
    out.textContent = `الزكاة: ${z.toFixed(2)}`;
  }
  nisab.addEventListener('input',calc); amount.addEventListener('input',calc);
}

function registerSW(){
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(()=>{});
}

async function init(){
  CFG=await (await fetch('./assets/js/config.json')).json();
  renderVersion();
  initTheme();
  initNav();
  initCityList();
  renderHijri();
  loadStoredQibla();
  setupCompass();

  qs('#useLocation').addEventListener('click', ()=> loadPrayerTimes(false));
  qs('#useCity').addEventListener('click', ()=> loadPrayerTimes(true));

  await loadPrayerTimes(false);
  await loadAdhkar();
  setupTasbeeh();
  await loadResources();
  await loadLearning();
  setupTools();
  registerSW();
}

window.addEventListener('load', init);
