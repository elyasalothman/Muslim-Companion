
// ====== إعدادات عامة ======
const DAY_KEY = new Date().toDateString();
const LS = (k,v)=> v===undefined? localStorage.getItem(k) : localStorage.setItem(k,v);
const qs = (s, r=document)=> r.querySelector(s);
const qsa= (s, r=document)=> Array.from(r.querySelectorAll(s));

// PWA register
if ('serviceWorker' in navigator){
  navigator.serviceWorker.register('/service-worker.js');
}

// UI: تنقل
qsa('.nav-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    qsa('.nav-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    qsa('.section').forEach(s=> s.classList.remove('active'));
    qs('#'+btn.dataset.target).classList.add('active');
  })
});

// تفضيلات + حجم الخط + الوضع الليلي
let currentFont = parseFloat(LS('fontSize')||'1.2');
function applyFont(){ qsa('.dhikr-text').forEach(el=> el.style.fontSize = currentFont+'rem'); }
qs('#incFont').onclick = ()=>{ currentFont = Math.min(2.0, currentFont+0.1); LS('fontSize', currentFont); applyFont(); }
qs('#decFont').onclick = ()=>{ currentFont = Math.max(1.0, currentFont-0.1); LS('fontSize', currentFont); applyFont(); }
qs('#toggleTheme').onclick = ()=>{
  const html = document.documentElement; const t = html.getAttribute('data-theme')==='dark'?'light':'dark';
  html.setAttribute('data-theme', t); LS('theme', t);
}
(function(){ const t = LS('theme')||'light'; document.documentElement.setAttribute('data-theme', t); })();

// إنجاز اليوم
let daily = parseInt(LS('dailyStats')||'0',10);
qs('#daily-stats').innerText = daily;
function addStat(){ daily++; LS('dailyStats', daily); qs('#daily-stats').innerText = daily; }
if (LS('statsDate')!==DAY_KEY){ LS('statsDate', DAY_KEY); LS('dailyStats', '0'); daily=0; }

// تحميل الأذكار من JSON وبناء البطاقات
async function buildDhikr(){
  const res = await fetch('/js/adhkar.json');
  const data = await res.json();
  renderDhikrSection('morning', data.morning);
  renderDhikrSection('evening', data.evening);
  renderDhikrSection('sleep', data.sleep);
  renderDhikrSection('prayer', data.afterPrayer);
  applyFont();
}
function renderDhikrSection(id, list){
  const host = qs('#'+id);
  host.innerHTML = `<h2 class="section-title">${host.dataset.title||''}</h2>`;
  list.forEach((item, idx)=>{
    const key = `adhkar:${id}:${idx}:${DAY_KEY}`;
    const max = item.repeat||1;
    let remaining = parseInt(LS(key)??max,10);
    const card = document.createElement('div'); card.className='dhikr-card';
    card.innerHTML = `
      <p class="dhikr-text">${item.text}</p>
      <span class="source">${item.source}</span>
      <div class="progress-bar-container"><div class="progress-bar" style="width:${((max-remaining)/max)*100}%"></div></div>
      <div class="card-footer">
        <div class="action-row">
          <button class="btn secondary copy">نسخ</button>
          <a class="btn" href="${item.ref}" target="_blank" rel="noopener">مرجع</a>
        </div>
        <button class="btn do">${remaining===0? 'تم' : `التكرار: ${remaining}`}</button>
      </div>`;
    const pb = card.querySelector('.progress-bar');
    card.querySelector('.copy').onclick = async ()=>{
      const t = card.querySelector('.dhikr-text').innerText;
      try{ await navigator.clipboard.writeText(t);}catch(e){ /*fallback*/ }
    };
    card.querySelector('.do').onclick = ()=>{
      if (remaining===0){ addStat(); if(navigator.vibrate)navigator.vibrate(30); return; }
      remaining = Math.max(0, remaining-1); LS(key, remaining); addStat();
      if (remaining===0){ card.querySelector('.do').innerText='تم'; pb.style.width='100%'; if(navigator.vibrate)navigator.vibrate([120,50,120]); }
      else { card.querySelector('.do').innerText=`التكرار: ${remaining}`; pb.style.width=((max-remaining)/max*100)+'%'; if(navigator.vibrate)navigator.vibrate(50); }
    };
    host.appendChild(card);
  });
}

// مسبحة
let rosary = 0; const rosaryDisp = qs('#rosary-counter');
qs('#main-rosary-btn').onclick = ()=>{ rosary++; rosaryDisp.innerText = rosary; addStat(); if(navigator.vibrate)navigator.vibrate(30); if(rosary%33===0||rosary%100===0){ if(navigator.vibrate)navigator.vibrate([120,50,120]); }}
qs('#reset-rosary').onclick = ()=>{ if(confirm('تصفير العداد؟')){ rosary=0; rosaryDisp.innerText=rosary; }}

// التاريخ الهجري (fallback محلي)
(function setHijri(){
  try{ const f = new Intl.DateTimeFormat('ar-SA-u-ca-islamic',{day:'numeric',month:'long',year:'numeric'}); qs('#hijri-date').innerText = f.format(new Date()); }
  catch{ qs('#hijri-date').innerText='—'; }
})();

// مواقيت الصلاة + العد التنازلي + إشعارات
const METHOD_DEFAULT = 4; // أم القرى
let timingsCache=null, lastLat=24.7136, lastLng=46.6753, cdTimer=null;
function minutesOf(s){ const m = String(s||'').match(/(\d{1,2})\s*:\s*(\d{2})/); return m? (parseInt(m[1])*60+parseInt(m[2])): null; }
function minutesNow(){ const d=new Date(); return d.getHours()*60+d.getMinutes(); }

async function requestLocation(){
  if (!('geolocation' in navigator)) return fetchPrayerTimes(lastLat,lastLng);
  try{
    const pos = await new Promise((res,rej)=> navigator.geolocation.getCurrentPosition(res,rej,{timeout:8000,maximumAge:600000}));
    lastLat = pos.coords.latitude; lastLng = pos.coords.longitude;
  }catch{}
  return fetchPrayerTimes(lastLat,lastLng);
}

async function fetchPrayerTimes(lat,lng){
  try{
    const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=${METHOD_DEFAULT}&school=0`;
    const r = await fetch(url); const j = await r.json(); timingsCache = j?.data?.timings||null; if(!timingsCache) throw new Error('no timings'); renderPrayerTimes();
  }catch{ qs('#prayer-times-container').innerHTML = '<p style="text-align:center">تعذّر جلب المواقيت.</p>'; }
}

function renderPrayerTimes(){
  const map = {Fajr:'الفجر',Sunrise:'الشروق',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'}; let html='', nowM=minutesNow(), nextKey=null, nextM=null;
  Object.entries(map).forEach(([k,n])=>{ const mm = minutesOf(timingsCache[k]); let isNext=false; if(k!=='Sunrise' && mm && mm>nowM && !nextKey){ nextKey=k; nextM=mm; isNext=true; } html += `<div class="prayer-time ${isNext?'next':''}"><span><strong>${n}</strong></span><span>${timingsCache[k]}</span></div>`; });
  qs('#prayer-times-container').innerHTML = html;
  if (nextKey){ qs('#next-prayer-time').innerText = `${map[nextKey]} (${timingsCache[nextKey]})`; startCountdown(nextM, `${map[nextKey]} (${timingsCache[nextKey]})`); }
}

function startCountdown(targetM, title){
  clearInterval(cdTimer);
  cdTimer = setInterval(()=>{
    const rem = targetM - minutesNow(); if (rem<=0){ clearInterval(cdTimer); fetchPrayerTimes(lastLat,lastLng); return; }
    const h = Math.floor(rem/60), m = rem%60; qs('#next-prayer-time').title = `الوقت المتبقي: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }, 60000);
  // تذكير قبل الأذان بـ 10 دقائق
  if ('Notification' in window){ if (Notification.permission==='default'){ Notification.requestPermission(); }
    if (Notification.permission==='granted'){ const diff = targetM - minutesNow() - 10; if (diff>0) setTimeout(()=> new Notification('تذكير بالصلاة',{body:`اقترب ${title}`, dir:'rtl'}), diff*60000); }
  }
}

requestLocation(); setInterval(()=>{ if(timingsCache) renderPrayerTimes(); }, 60000);

// القبلة
const MAKKAH = { lat: 21.4225*Math.PI/180, lng: 39.8262*Math.PI/180 };
function toRad(d){ return d*Math.PI/180 }
function toDeg(r){ return (r*180/Math.PI + 360)%360 }
function qiblaBearing(lat,lng){ const φ1=toRad(lat), λ1=toRad(lng), φ2=MAKKAH.lat, λ2=MAKKAH.lng; const dλ=λ2-λ1; const y=Math.sin(dλ)*Math.cos(φ2); const x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(dλ); return (toDeg(Math.atan2(y,x))+360)%360 }
let deviceHeading=0;
async function initQibla(){
  try{
    const pos = await new Promise((res,rej)=> navigator.geolocation.getCurrentPosition(res,rej,{timeout:7000}));
    lastLat = pos.coords.latitude; lastLng = pos.coords.longitude;
  }catch{}
  const b = qiblaBearing(lastLat, lastLng); qs('#qibla-bearing').innerText = `القبلة: ${b.toFixed(0)}° من الشمال الحقيقي`;
  drawNeedle(b);
}
function drawNeedle(b){ const rot = (b - deviceHeading + 360)%360; qs('#needle').style.transform = `translate(-50%,-100%) rotate(${rot}deg)`; }
qs('#enable-orientation').onclick = async ()=>{
  try{
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
      const s = await DeviceOrientationEvent.requestPermission(); if (s !== 'granted') return alert('لم يتم منح الإذن');
    }
    window.addEventListener('deviceorientation', (e)=>{
      if (typeof e.alpha === 'number'){
        deviceHeading = e.webkitCompassHeading ? e.webkitCompassHeading : (360 - e.alpha);
        const b = qiblaBearing(lastLat, lastLng); drawNeedle(b);
      }
    }, true);
  }catch{ alert('تعذّر الوصول لحساس الاتجاه'); }
};

initQibla();
buildDhikr();
