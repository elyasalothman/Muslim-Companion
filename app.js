
const DAY_KEY = new Date().toDateString();
const LS=(k,v)=> v===undefined? localStorage.getItem(k) : localStorage.setItem(k,v);
const qs=(s,r=document)=> r.querySelector(s); const qsa=(s,r=document)=> Array.from(r.querySelectorAll(s));

if ('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js', {scope:'./'}); }

qsa('.nav-btn').forEach(btn=> btn.addEventListener('click',()=>{ qsa('.nav-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); qsa('.section').forEach(s=>s.classList.remove('active')); qs('#'+btn.dataset.target).classList.add('active'); }));

let currentFont=parseFloat(LS('fontSize')||'1.2'); function applyFont(){ qsa('.dhikr-text').forEach(el=> el.style.fontSize=currentFont+'rem'); }
qs('#incFont').onclick=()=>{ currentFont=Math.min(2.0,currentFont+0.1); LS('fontSize',currentFont); applyFont(); }
qs('#decFont').onclick=()=>{ currentFont=Math.max(1.0,currentFont-0.1); LS('fontSize',currentFont); applyFont(); }
qs('#toggleTheme').onclick=()=>{ const html=document.documentElement; const t=html.getAttribute('data-theme')==='dark'?'light':'dark'; html.setAttribute('data-theme',t); LS('theme',t); }
(function(){ const t=LS('theme')||'light'; document.documentElement.setAttribute('data-theme',t); })();

let daily=parseInt(LS('dailyStats')||'0',10); qs('#daily-stats').innerText=daily; function addStat(){ daily++; LS('dailyStats',daily); qs('#daily-stats').innerText=daily; }
if (LS('statsDate')!==DAY_KEY){ LS('statsDate',DAY_KEY); LS('dailyStats','0'); daily=0; }

async function buildDhikr(){ const data= await (await fetch('./adhkar.json')).json(); renderDhikrSection('morning', data.morning||[]); applyFont(); }
function renderDhikrSection(id, list){ const host=qs('#'+id); host.innerHTML=`<h2 class="section-title">${host.dataset.title||''}</h2>`; list.forEach((it,i)=>{ const key=`adhkar:${id}:${i}:${DAY_KEY}`; const max=it.repeat||1; let rem=parseInt(LS(key)??max,10); const c=document.createElement('div'); c.className='dhikr-card'; c.innerHTML=`<p class="dhikr-text">${it.text}</p><span class="source">${it.source}</span><div class="progress-bar-container"><div class="progress-bar" style="width:${((max-rem)/max)*100}%"></div></div><div class="card-footer"><div class="action-row"><button class="btn secondary copy">نسخ</button><a class="btn" href="${it.ref}" target="_blank" rel="noopener">مرجع</a></div><button class="btn do">${rem===0?'تم':`التكرار: ${rem}`}</button></div>`; const pb=c.querySelector('.progress-bar'); c.querySelector('.copy').onclick=async()=>{ try{ await navigator.clipboard.writeText(c.querySelector('.dhikr-text').innerText);}catch(e){} }; c.querySelector('.do').onclick=()=>{ if(rem===0){ addStat(); if(navigator.vibrate)navigator.vibrate(30); return;} rem=Math.max(0,rem-1); LS(key,rem); addStat(); if(rem===0){ c.querySelector('.do').innerText='تم'; pb.style.width='100%'; if(navigator.vibrate)navigator.vibrate([120,50,120]); } else { c.querySelector('.do').innerText=`التكرار: ${rem}`; pb.style.width=((max-rem)/max*100)+'%'; if(navigator.vibrate)navigator.vibrate(50);} }; host.appendChild(c); }); }

// Rosary
let ros=0; const rosDisp=qs('#rosary-counter'); qs('#main-rosary-btn').onclick=()=>{ ros++; rosDisp.innerText=ros; addStat(); if(navigator.vibrate)navigator.vibrate(30); if(ros%33===0||ros%100===0){ if(navigator.vibrate)navigator.vibrate([120,50,120]); }}; qs('#reset-rosary').onclick=()=>{ if(confirm('تصفير العداد؟')){ ros=0; rosDisp.innerText=ros; }};

// Hijri fallback
(function(){ try{ const f=new Intl.DateTimeFormat('ar-SA-u-ca-islamic',{day:'numeric',month:'long',year:'numeric'}); qs('#hijri-date').innerText=f.format(new Date()); }catch{ qs('#hijri-date').innerText='—'; } })();

// Prayer Times
const METHOD_DEFAULT=4; let timingsCache=null, lastLat=24.7136, lastLng=46.6753, cd=null; function mOf(s){ const m=String(s||'').match(/(\d{1,2})\s*:\s*(\d{2})/); return m? (parseInt(m[1])*60+parseInt(m[2])):null } function mNow(){ const d=new Date(); return d.getHours()*60+d.getMinutes(); }
async function reqLoc(){ if(!('geolocation' in navigator)) return getTimes(lastLat,lastLng); try{ const p=await new Promise((res,rej)=> navigator.geolocation.getCurrentPosition(res,rej,{timeout:8000,maximumAge:600000})); lastLat=p.coords.latitude; lastLng=p.coords.longitude; }catch{} return getTimes(lastLat,lastLng); }
async function getTimes(lat,lng){ try{ const u=`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=${METHOD_DEFAULT}&school=0`; const r=await fetch(u); const j=await r.json(); timingsCache=j?.data?.timings||null; if(!timingsCache) throw new Error(); renderTimes(); }catch{ qs('#prayer-times-container').innerHTML='<p style="text-align:center">تعذّر جلب المواقيت.</p>'; } }
function renderTimes(){ const map={Fajr:'الفجر',Sunrise:'الشروق',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'}; let html='', now=mNow(), nextK=null, nextM=null; Object.entries(map).forEach(([k,n])=>{ const mm=mOf(timingsCache[k]); let nx=false; if(k!=='Sunrise' && mm && mm>now && !nextK){ nextK=k; nextM=mm; nx=true;} html+=`<div class="prayer-time ${nx?'next':''}"><span><strong>${n}</strong></span><span>${timingsCache[k]}</span></div>`; }); qs('#prayer-times-container').innerHTML=html; if(nextK){ qs('#next-prayer-time').innerText=`${map[nextK]} (${timingsCache[nextK]})`; startCD(nextM,`${map[nextK]} (${timingsCache[nextK]})`);} }
function startCD(tM,title){ clearInterval(cd); cd=setInterval(()=>{ const rem=tM-mNow(); if(rem<=0){ clearInterval(cd); getTimes(lastLat,lastLng); return;} const h=Math.floor(rem/60), m=rem%60; qs('#next-prayer-time').title=`الوقت المتبقي: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; },60000); if('Notification' in window){ if(Notification.permission==='default'){ Notification.requestPermission(); } if(Notification.permission==='granted'){ const diff=tM-mNow()-10; if(diff>0) setTimeout(()=> new Notification('تذكير بالصلاة',{body:`اقترب ${title}`, dir:'rtl'}), diff*60000); } } }
reqLoc(); setInterval(()=>{ if(timingsCache) renderTimes(); },60000);

// Qibla
const MAKKAH={lat:21.4225*Math.PI/180,lng:39.8262*Math.PI/180}; function toRad(d){ return d*Math.PI/180 } function toDeg(r){ return (r*180/Math.PI + 360)%360 } function bearing(lat,lng){ const φ1=toRad(lat),λ1=toRad(lng),φ2=MAKKAH.lat,λ2=MAKKAH.lng; const dλ=λ2-λ1; const y=Math.sin(dλ)*Math.cos(φ2); const x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(dλ); return (toDeg(Math.atan2(y,x))+360)%360 }
let devHead=0; async function initQibla(){ try{ const p=await new Promise((res,rej)=> navigator.geolocation.getCurrentPosition(res,rej,{timeout:7000})); lastLat=p.coords.latitude; lastLng=p.coords.longitude; }catch{} const b=bearing(lastLat,lastLng); qs('#qibla-bearing').innerText=`القبلة: ${b.toFixed(0)}° من الشمال الحقيقي`; draw(b); }
function draw(b){ const rot=(b - devHead + 360)%360; qs('#needle').style.transform=`translate(-50%,-100%) rotate(${rot}deg)`; }
qs('#enable-orientation').onclick=async()=>{ try{ if (typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){ const s=await DeviceOrientationEvent.requestPermission(); if(s!=='granted') return alert('لم يتم منح الإذن'); } window.addEventListener('deviceorientation',(e)=>{ if(typeof e.alpha==='number'){ devHead = e.webkitCompassHeading ? e.webkitCompassHeading : (360 - e.alpha); const b=bearing(lastLat,lastLng); draw(b); } }, true); }catch{ alert('تعذّر الوصول لحساس الاتجاه'); } };
initQibla(); buildDhikr();
