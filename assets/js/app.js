// Rafiq Muslim v0.2.9
const API_BASE='https://api.aladhan.com/v1';
const KAABA={lat:21.4225,lon:39.8262};
const BDC_REVERSE='https://api-bdc.net/data/reverse-geocode-client';
const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>Array.from(r.querySelectorAll(s)), LS=(k,v)=>v===undefined?localStorage.getItem(k):localStorage.setItem(k,v);
let CFG=null,nextTimer=null; let loaded={adhkar:false,resources:false,learning:false};
const TASBEEH_PHRASES=[{"name": "سُبْحَانَ اللَّهِ", "target": 33}, {"name": "الْحَمْدُ لِلَّهِ", "target": 33}, {"name": "اللَّهُ أَكْبَرُ", "target": 34}, {"name": "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "target": 100}, {"name": "لَا إِلَهَ إِلَّا اللَّهُ", "target": 100}, {"name": "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", "target": 100}, {"name": "أَسْتَغْفِرُ اللَّهَ", "target": 100}];
function setText(id,t){const e=document.getElementById(id); if(e) e.textContent=t;}
function isoToDate(i){return new Date(i)}
function dateToApi(d){return String(d.getDate()).padStart(2,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+d.getFullYear()}
function toRad(x){return x*Math.PI/180} function toDeg(x){return x*180/Math.PI} function normalize360(x){x%=360; if(x<0)x+=360; return x}
function formatTime12h(d){try{return new Intl.DateTimeFormat('ar',{hour:'numeric',minute:'2-digit',hour12:true}).format(d)}catch(e){let h=d.getHours(),m=String(d.getMinutes()).padStart(2,'0');const suf=h>=12?'م':'ص';h=h%12||12;return `${h}:${m} ${suf}`;}}
function renderHijri(){try{const f=new Intl.DateTimeFormat('ar-SA-u-ca-islamic',{day:'numeric',month:'long',year:'numeric'}); setText('hijri',f.format(new Date()))}catch(e){setText('hijri','—')}}
function translatePrayer(k){return ({Fajr:'الفجر',Sunrise:'الشروق',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'})[k]||k;}
function computeDuha(s,d){return {start:new Date(isoToDate(s).getTime()+CFG.duha.startOffsetAfterSunriseMin*60000), end:new Date(isoToDate(d).getTime()-CFG.duha.endOffsetBeforeDhuhrMin*60000)}}
function computeLastThird(m,f){const magh=isoToDate(m), fajr=isoToDate(f); let night=fajr-magh; if(night<=0) night+=86400000; const third=night/3; return {start:new Date(fajr.getTime()-third), end:fajr}}
function bearing(lat1,lon1,lat2,lon2){const φ1=toRad(lat1),φ2=toRad(lat2),λ1=toRad(lon1),λ2=toRad(lon2); const y=Math.sin(λ2-λ1)*Math.cos(φ2),x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1); return normalize360(toDeg(Math.atan2(y,x)));}

// دالة جلب المواقيت مع إمكانية تحديد طريقة الحساب (Method)
async function fetchTimingsByCoords(date,lat,lon, methodOverride){
  const m = methodOverride || CFG.calculation.method;
  const ds=dateToApi(date); 
  const u=`${API_BASE}/timings/${ds}?latitude=${lat}&longitude=${lon}&method=${m}&school=${CFG.calculation.school}&iso8601=true`; 
  const r=await fetch(u); const j=await r.json(); if(j.code!==200) throw new Error('API'); return j.data;
}
async function fetchTimingsByCity(date,city,country, methodOverride){
  const m = methodOverride || CFG.calculation.method;
  const ds=dateToApi(date); 
  const u=`${API_BASE}/timingsByCity/${ds}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${m}&school=${CFG.calculation.school}&iso8601=true`; 
  const r=await fetch(u); const j=await r.json(); if(j.code!==200) throw new Error('API'); return j.data;
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const toggleBtn = document.querySelector('#toggleTheme');
  if(toggleBtn) {
    toggleBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      toggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    });
  }
}

function initScheme() {
  const savedScheme = localStorage.getItem('scheme') || 'classic';
  document.documentElement.setAttribute('data-scheme', savedScheme);
  document.querySelectorAll('.color-dot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = e.target.getAttribute('data-val');
      document.documentElement.setAttribute('data-scheme', val);
      localStorage.setItem('scheme', val);
    });
  });
}

function showSection(id){
  qsa('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.target===id)); 
  qsa('.section').forEach(s=>s.classList.toggle('active',s.id===id));
}
function initNav(){
  qsa('.bottom-nav button').forEach(btn=>btn.addEventListener('click',async()=>{
    const id=btn.dataset.target; showSection(id); 
    if(id==='adhkar'&&!loaded.adhkar){loaded.adhkar=true; await loadAdhkar();} 
    if(id==='resources'&&!loaded.resources){loaded.resources=true; await loadResources();} 
    if(id==='learning'&&!loaded.learning){loaded.learning=true; await loadLearning();} 
    window.scrollTo({top:0,behavior:'smooth'});
  }));
}
function initCityList(){
  const cities=[{label:'الرياض',city:'Riyadh',country:'SA'},{label:'مكة المكرمة',city:'Makkah',country:'SA'},{label:'المدينة المنورة',city:'Al Madinah al Munawwarah',country:'SA'},{label:'جدة',city:'Jeddah',country:'SA'},{label:'الدمام',city:'Dammam',country:'SA'},{label:'الطائف',city:'Taif',country:'SA'},{label:'أبها',city:'Abha',country:'SA'},{label:'تبوك',city:'Tabuk',country:'SA'}]; 
  const sel=qs('#citySelect'); if(!sel) return; 
  cities.forEach(c=>{const o=document.createElement('option'); o.value=JSON.stringify(c); o.textContent=c.label; sel.appendChild(o);}); 
  const saved=LS('cityFallback'); if(saved) sel.value=saved; 
  sel.addEventListener('change',()=>{
    LS('cityFallback',sel.value); 
    updateCityKPIFromSelect();
    loadPrayerTimes(true);
  }); 
  updateCityKPIFromSelect();
}
function getCityFallback(){const v=LS('cityFallback'); if(v) try{return JSON.parse(v)}catch(e){} return CFG.defaultCity;}
function updateCityKPI(t){setText('cityDisplay',t||'—')}
function updateCityKPIFromSelect(){const sel=qs('#citySelect'); if(sel&&sel.value) try{const o=JSON.parse(sel.value); updateCityKPI(o.label||o.city)}catch(e){} else {const c=getCityFallback(); updateCityKPI(c.label||c.city||'—')}}
async function reverseGeocodeCity(lat,lon){const key=`rg:${lat.toFixed(3)},${lon.toFixed(3)}`; const cached=LS(key); if(cached) try{return JSON.parse(cached)}catch(e){} const u=`${BDC_REVERSE}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=ar`; const r=await fetch(u); const j=await r.json(); const out={city:j.city||j.locality||j.principalSubdivision||null}; LS(key,JSON.stringify(out)); return out;}
function renderNextPrayer(T,fajrTomorrowISO){
  const order=['Fajr','Dhuhr','Asr','Maghrib','Isha']; 
  const now=new Date(); let nextName=null,time=null, currName='Isha'; 
  for(let i=0; i<order.length; i++){
    const k = order[i]; const d=isoToDate(T[k]); 
    if(d>now){nextName=k; time=d; currName = i === 0 ? 'Isha' : order[i-1]; break;}
  } 
  if(!nextName){nextName='Fajr'; time=isoToDate(fajrTomorrowISO); currName='Isha';} 
  setText('nextPrayerName',translatePrayer(nextName)); setText('nextPrayerTime',formatTime12h(time)); 
  qsa('.table tbody tr').forEach(tr => tr.classList.remove('current-prayer'));
  const currRow = qs('#tr_' + currName);
  if(currRow) currRow.classList.add('current-prayer');
  if(nextTimer) clearInterval(nextTimer); 
  nextTimer=setInterval(()=>{
    const diff=time-new Date(); 
    if(diff<=0){setText('nextCountdown','حان الوقت'); clearInterval(nextTimer); return;} 
    const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000); 
    if(h > 0) setText('nextCountdown',`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    else setText('nextCountdown',`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
  },1000);
}
function setQiblaFromCoords(lat,lon){const b=bearing(lat,lon,KAABA.lat,KAABA.lon); setText('qiblaDeg',`${b.toFixed(1)}°`); LS('qiblaBearing',String(b));}
function loadStoredQibla(){const v=LS('qiblaBearing'); if(v) setText('qiblaDeg',`${parseFloat(v).toFixed(1)}°`)}

async function loadPrayerTimes(forceCity=false){
  setText('ptStatus',''); setText('ptMeta',''); 
  const controls = qs('#locationControls');
  const today=new Date(), tomorrow=new Date(Date.now()+86400000), c=getCityFallback(); 

  const renderTimes = (T, TT, T_True) => {
    ['Fajr','Dhuhr','Asr','Maghrib','Isha'].forEach(k=>{
      const el = qs('#t_'+k.toLowerCase()+'_s');
      if(el) el.textContent = formatTime12h(isoToDate(T[k]));
    }); 
    
    // استخراج العشاء الحقيقي الفلكي من الطلب الثاني (رابطة العالم الإسلامي)
    const trueIshaTime = isoToDate(T_True.Isha);
    const elTrueIsha = qs('#t_isha_true_s');
    if(elTrueIsha) elTrueIsha.textContent = formatTime12h(trueIshaTime);
    
    setText('t_fajr_e', formatTime12h(isoToDate(T.Sunrise)));
    setText('t_dhuhr_e', formatTime12h(isoToDate(T.Asr)));
    setText('t_asr_e', formatTime12h(isoToDate(T.Maghrib)));
    
    // خروج المغرب الآن مرتبط رياضياً بالميل الفلكي 100%
    setText('t_maghrib_e', formatTime12h(trueIshaTime));
    setText('t_isha_e', formatTime12h(isoToDate(T.Midnight)));

    const duha=computeDuha(T.Sunrise,T.Dhuhr); 
    setText('t_duha_s', formatTime12h(duha.start)); setText('t_duha_e', formatTime12h(duha.end)); 
    const last=computeLastThird(T.Maghrib,TT.Fajr); 
    setText('t_lastthird_s', formatTime12h(last.start)); setText('t_lastthird_e', formatTime12h(last.end)); 
    renderNextPrayer(T,TT.Fajr);
  };

  try{
    if(!forceCity && 'geolocation' in navigator){
      updateCityKPI('جاري التحديد…'); 
      const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:12000,maximumAge:600000})); 
      const lat=pos.coords.latitude, lon=pos.coords.longitude; 
      const acc = Math.round(pos.coords.accuracy||0);
      let accText = 'عالية';
      
      if(acc > 500) { accText = 'سيئة'; if(controls) controls.style.display = 'flex'; }
      else { if(acc > 50) accText = 'متوسطة'; if(controls) controls.style.display = 'none'; }
      
      setText('ptMeta', `دقة الموقع: ${accText}`);
      const rg=reverseGeocodeCity(lat,lon).catch(()=>null); 
      
      // جلب المواقيت الرسمية (أم القرى)
      const td=await fetchTimingsByCoords(today,lat,lon); 
      const td2=await fetchTimingsByCoords(tomorrow,lat,lon); 
      // جلب المواقيت الفلكية (رابطة العالم الإسلامي - Method 3) لمعرفة الشفق الأحمر بالضبط
      const tdTrue=await fetchTimingsByCoords(today,lat,lon, 3); 

      const city=await rg; updateCityKPI(city&&city.city?city.city:'موقعي'); setQiblaFromCoords(lat,lon);
      renderTimes(td.timings, td2.timings, tdTrue.timings);
    } else {
      if(controls) controls.style.display = 'flex';
      updateCityKPI(c.label||c.city); 
      const td=await fetchTimingsByCity(today,c.city,c.country); 
      const td2=await fetchTimingsByCity(tomorrow,c.city,c.country);
      const tdTrue=await fetchTimingsByCity(today,c.city,c.country, 3);
      renderTimes(td.timings, td2.timings, tdTrue.timings);
    } 
  }catch(e){
    console.warn(e); 
    if(controls) controls.style.display = 'flex';
    setText('ptStatus','لم يتم تفعيل الموقع، يمكنك اختيار المدينة يدوياً.');
    updateCityKPI(c.label||c.city);
    try {
        const td = await fetchTimingsByCity(today,c.city,c.country);
        const td2 = await fetchTimingsByCity(tomorrow,c.city,c.country);
        const tdTrue = await fetchTimingsByCity(today,c.city,c.country, 3);
        renderTimes(td.timings, td2.timings, tdTrue.timings);
    } catch(ex){}
  }
}

function setupCompass(){const needle=qs('#needle'), acc=qs('#compassAccuracy'); if(!needle) return; let ema=null; function delta(a,b){return (b-a+540)%360-180} function render(q,h){needle.style.transform=`translate(-50%,-100%) rotate(${normalize360(q-h)}deg)`;} function onOri(ev){let heading=null; if(typeof ev.webkitCompassHeading==='number'&&ev.webkitCompassHeading>=0){heading=ev.webkitCompassHeading; if(typeof ev.webkitCompassAccuracy==='number') acc.textContent=`دقة البوصلة: ±${Math.round(ev.webkitCompassAccuracy)}°`;} else if(typeof ev.alpha==='number'){heading=360-ev.alpha; acc.textContent='دقة البوصلة: تقريبية';} if(heading==null) return; const q=parseFloat(LS('qiblaBearing')||'0')||0; if(ema==null) ema=heading; ema=normalize360(ema+delta(ema,heading)*0.18); render(q,ema);} qs('#enableCompass')?.addEventListener('click',async()=>{try{if(window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function'){const p=await DeviceOrientationEvent.requestPermission(); if(p!=='granted') return;} window.addEventListener('deviceorientation',onOri,true); setText('compassStatus','تم تفعيل البوصلة');}catch(e){setText('compassStatus','تعذّر تفعيل البوصلة');}});}
function haptic(ms=10){try{if(navigator.vibrate) navigator.vibrate(ms);}catch(e){}}
function setupTasbeeh(){const select=qs('#tasbeehPhraseSelect'), current=qs('#currentTasbeeh'), countEl=qs('#tasbeehCount'), targetEl=qs('#tasbeehTarget'), btn=qs('#tasbeehBtn'), resetBtn=qs('#tasbeehReset'), nextBtn=qs('#tasbeehNext'), hint=qs('#tasbeehHint'); if(!select||!current||!countEl||!targetEl||!btn||!resetBtn||!nextBtn) return; select.innerHTML=''; TASBEEH_PHRASES.forEach((p,idx)=>{const o=document.createElement('option'); o.value=String(idx); o.textContent=`${p.name} — ${p.target}`; select.appendChild(o);}); let phraseIndex=parseInt(LS('tasbeehPhraseIndex')||'0',10); if(Number.isNaN(phraseIndex)||phraseIndex<0||phraseIndex>=TASBEEH_PHRASES.length) phraseIndex=0; let count=parseInt(LS('tasbeehCount')||'0',10); if(Number.isNaN(count)||count<0) count=0; function render(){const p=TASBEEH_PHRASES[phraseIndex]; select.value=String(phraseIndex); current.textContent=p.name; countEl.textContent=String(count); targetEl.textContent=`الهدف: ${p.target}`; if(hint) hint.textContent=count>=p.target?'ما شاء الله ✓ اكتمل الهدف — يمكنك الانتقال للتسبيح التالي':'اهتزاز خفيف مع كل ضغطة، واهتزاز أوضح عند إكمال الهدف';} function save(){LS('tasbeehPhraseIndex',String(phraseIndex)); LS('tasbeehCount',String(count));} select.addEventListener('change',()=>{phraseIndex=parseInt(select.value,10)||0; count=0; save(); render(); haptic(10);}); const increment=()=>{const p=TASBEEH_PHRASES[phraseIndex]; count+=1; save(); render(); if(count===p.target) haptic([28,35,28]); else haptic(9);}; btn.addEventListener('click',increment); btn.addEventListener('touchstart',()=>haptic(7),{passive:true}); resetBtn.addEventListener('click',()=>{count=0; save(); render(); haptic(15);}); nextBtn.addEventListener('click',()=>{phraseIndex=(phraseIndex+1)%TASBEEH_PHRASES.length; count=0; save(); render(); haptic([15,18,15]);}); render();}
function dayKey(){return new Date().toDateString()}
function renderPager(container,list,keyPrefix){let index=parseInt(LS(`pager:${keyPrefix}:index`)||'0',10); if(Number.isNaN(index)||index<0||index>=list.length) index=0; const host=document.createElement('div'); host.className='pager-wrap'; const indexEl=document.createElement('div'); indexEl.className='pager-index'; const card=document.createElement('div'); card.className='pager-card'; const controls=document.createElement('div'); controls.className='pager-controls'; const prev=document.createElement('button'); prev.className='btn secondary'; prev.textContent='السابق'; const next=document.createElement('button'); next.className='btn'; next.textContent='التالي'; controls.append(prev,next); host.append(indexEl,card,controls); container.appendChild(host); function update(){const it=list[index]; const max=it.repeat; const numeric=typeof max==='number'; const repeatedOnce=numeric&&max===1; const k=`dhikr:${keyPrefix}:${index}:${dayKey()}`; let rem=LS(k); rem=rem==null?(numeric?max:0):parseInt(rem,10); if(!numeric) rem=0; const pct=numeric&&max>0?Math.round(((max-rem)/max)*100):0; indexEl.textContent=`${index+1} / ${list.length}`; const whenHtml=it.when?`<span class="when-chip">${it.when}</span>`:''; const repeatHtml=repeatedOnce?'':`<button class="btn ${numeric?'':'secondary'} repeat-square ${numeric&&rem===0?'done':''} ${(!numeric||String(max).length>2)?'wide':''} do">${numeric?(rem===0?'تم':String(rem)):String(max)}</button>`; card.innerHTML=`<p class="dhikr-text">${it.text}</p><div class="pager-meta"><span>المصدر: ${it.source||'—'}</span>${whenHtml}</div>${numeric&&!repeatedOnce?'<div class="progress"><div style="width:'+pct+'%"></div></div>':''}<div class="actions"><div class="left"><button class="btn secondary tiny copy">نسخ</button><a class="mini-link" href="${it.ref||'#'}" target="_blank" rel="noopener">مرجع</a></div>${repeatHtml}</div>`; card.querySelector('.copy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(it.text); haptic(8);}catch(e){}}); const btn=card.querySelector('.do'); const bar=card.querySelector('.progress>div'); if(btn&&numeric){btn.addEventListener('click',()=>{if(rem<=0) return; rem-=1; LS(k,String(rem)); const p=Math.round(((max-rem)/max)*100); if(bar) bar.style.width=p+'%'; btn.textContent=rem===0?'تم':String(rem); btn.classList.toggle('done', rem===0); haptic(rem===0?[20,28,20]:8);});} if(btn&&!numeric) btn.disabled=true; prev.disabled=index===0; next.disabled=index===list.length-1; LS(`pager:${keyPrefix}:index`,String(index));} prev.addEventListener('click',()=>{if(index>0){index-=1; update(); haptic(8);}}); next.addEventListener('click',()=>{if(index<list.length-1){index+=1; update(); haptic(8);}}); update();}
function renderDhikrList(container,list,keyPrefix){container.innerHTML=''; renderPager(container,list,keyPrefix);}
async function loadAdhkar(){const data=await (await fetch('./data/adhkar.json')).json(); const tabs=[{key:'morning',label:'الصباح'},{key:'evening',label:'المساء'},{key:'sleep',label:'النوم'},{key:'wakeup',label:'الاستيقاظ'},{key:'afterPrayer',label:'بعد الصلاة'},{key:'home',label:'المنزل'},{key:'mosque',label:'المسجد'},{key:'daily',label:'متفرقة'}]; const pills=qs('#adhkarPills'), container=qs('#adhkarContainer'); if(!pills||!container) return; function activate(key){qsa('#adhkarPills button').forEach(b=>b.classList.toggle('active',b.dataset.key===key)); renderDhikrList(container,data[key],key);} pills.innerHTML=''; tabs.forEach(t=>{const b=document.createElement('button'); b.textContent=t.label; b.dataset.key=t.key; b.addEventListener('click',()=>activate(t.key)); pills.appendChild(b);}); activate('morning');}
async function loadResources(){const data=await (await fetch('./data/resources.json')).json(); const host=qs('#usefulLinks'); if(!host) return; host.innerHTML=''; (data.useful||[]).forEach(g=>{const sec=document.createElement('div'); sec.className='pager-card'; sec.innerHTML=`<h3 style="margin:0 0 8px">${g.group}</h3>`; const ul=document.createElement('ul'); (g.items||[]).forEach(it=>{const li=document.createElement('li'); li.innerHTML=`<a href="${it.url}" target="_blank" rel="noopener">${it.title}</a> <span class="small">— ${it.desc||''}</span>`; ul.appendChild(li);}); sec.appendChild(ul); host.appendChild(sec);});}
async function loadLearning(){const data=await (await fetch('./data/learning.json')).json(); const plan=qs('#learnPlan'), col=qs('#learnCollections'), rem=qs('#learnReminders'); if(plan){plan.innerHTML=''; (data.plan||[]).forEach(it=>{const d=document.createElement('div'); d.className='pager-card'; d.innerHTML=`<b>${it.title}</b><div class="small">${it.tip}</div>`; plan.appendChild(d);});} if(col){col.innerHTML=''; (data.collections||[]).forEach(it=>{const li=document.createElement('li'); li.innerHTML=`<a href="${it.url}" target="_blank" rel="noopener">${it.title}</a>`; col.appendChild(li);});} if(rem){rem.innerHTML=''; (data.reminders||[]).forEach(t=>{const li=document.createElement('li'); li.textContent=t; rem.appendChild(li);});}}
function showUpdateBar(reg){const bar=qs('#updateBar'); if(!bar) return; bar.style.display='flex'; qs('#updateNow')?.addEventListener('click',()=>{if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});},{once:true}); qs('#updateLater')?.addEventListener('click',()=>{bar.style.display='none';},{once:true});}
async function registerSW(){if(!('serviceWorker' in navigator)) return; const reg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'}); try{await reg.update();}catch(e){} navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true}); if(reg.waiting) showUpdateBar(reg); reg.addEventListener('updatefound',()=>{const sw=reg.installing; if(!sw) return; sw.addEventListener('statechange',()=>{if(sw.state==='installed'&&navigator.serviceWorker.controller) showUpdateBar(reg);});});}
async function init(){CFG=await (await fetch('./assets/js/config.json')).json(); initTheme(); initScheme(); initNav(); initCityList(); renderHijri(); loadStoredQibla(); setupCompass(); setupTasbeeh(); qs('#useLocation')?.addEventListener('click',()=>loadPrayerTimes(false)); await loadPrayerTimes(false); await registerSW();}
window.addEventListener('load',init);
