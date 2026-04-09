// Rafiq Muslim v1.0.0 - النسخة الرسمية الأولى
const API_BASE='https://api.aladhan.com/v1';
const KAABA={lat:21.4225,lon:39.8262};
const BDC_REVERSE='https://api-bdc.net/data/reverse-geocode-client';
const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const LS = (k,v) => { try { if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); } catch(e) { return null; } };

let CFG=null, nextTimer=null; let loaded={adhkar:false, resources:false, learning:false, quran:false};
let rawAdhkarData=null; let showTashkeel=LS('tashkeel')!=='false'; 
let currentFontSize = parseFloat(LS('fontSize')); if(isNaN(currentFontSize)) currentFontSize = 1.5;

const TASBEEH_PHRASES=[{"name": "سُبْحَانَ اللَّهِ", "target": 33}, {"name": "الْحَمْدُ لِلَّهِ", "target": 33}, {"name": "اللَّهُ أَكْبَرُ", "target": 34}, {"name": "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "target": 100}, {"name": "لَا إِلَهَ إِلَّا اللَّهُ", "target": 100}, {"name": "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", "target": 100}, {"name": "أَسْتَغْفِرُ اللَّهَ", "target": 100}];

function setText(id,t){const e=document.getElementById(id); if(e) e.textContent=t;}
function isoToDate(i){return new Date(i)}
function dateToApi(d){return String(d.getDate()).padStart(2,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+d.getFullYear()}
function toRad(x){return x*Math.PI/180} function toDeg(x){return x*180/Math.PI} function normalize360(x){x%=360; if(x<0)x+=360; return x}
function formatTime12h(d){try{return new Intl.DateTimeFormat('ar',{hour:'numeric',minute:'2-digit',hour12:true}).format(d)}catch(e){let h=d.getHours(),m=String(d.getMinutes()).padStart(2,'0');const suf=h>=12?'م':'ص';h=h%12||12;return `${h}:${m} ${suf}`;}}

async function fetchJSON(url, defaultData) {
    try { const res = await fetch(url); if (!res.ok) throw new Error(); return await res.json(); } 
    catch(e) { return defaultData; }
}

function setupTrueIshaToggle() {
  const btn = qs('#btnToggleTrueIsha');
  const container = qs('#trueIshaContainer');
  const adhanLabel = qs('#ishaAdhanLabel');
  
  const updateUI = () => {
    const isVisible = LS('showTrueIsha') === 'true';
    // إظهار أو إخفاء الحاويات الجديدة
    if(container) container.style.display = isVisible ? 'flex' : 'none';
    if(adhanLabel) adhanLabel.style.display = isVisible ? 'inline' : 'none';
    
    if(btn) {
      btn.textContent = isVisible ? 'إخفاء العشاء الفعلي' : 'إظهار العشاء الفعلي';
      btn.style.borderColor = isVisible ? 'var(--accent)' : 'var(--border)';
    }
  };

  btn?.addEventListener('click', () => {
    const currentState = LS('showTrueIsha') === 'true';
    LS('showTrueIsha', String(!currentState));
    updateUI();
    haptic(10);
  });

  updateUI();
}

function renderHijri(){
  try{
    const d = new Date(); const adj = parseInt(LS('hijriAdj')) || 0; d.setDate(d.getDate() + adj);
    const f=new Intl.DateTimeFormat('ar-SA-u-ca-islamic',{weekday: 'long', day:'numeric',month:'long',year:'numeric'}); 
    setText('hijri',f.format(d));
    const parts = f.formatToParts(d); const dayNum = parseInt(parts.find(p => p.type === 'day')?.value); const weekday = d.getDay();
    let msg = '';
    if (dayNum === 12 || dayNum === 13 || dayNum === 14) msg = 'غداً من الأيام البيض، تذكير بالصيام 🌙';
    if (weekday === 0) msg = 'غداً الإثنين، تذكير بالصيام 🌙';
    if (weekday === 3) msg = 'غداً الخميس، تذكير بالصيام 🌙';
    setText('fastingReminder', msg);
  }catch(e){setText('hijri','—')}
}

function translatePrayer(k){return ({Fajr:'الفجر',Sunrise:'الشروق',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'})[k]||k;}
function computeDuha(s,d){return {start:new Date(isoToDate(s).getTime()+CFG.duha.startOffsetAfterSunriseMin*60000), end:new Date(isoToDate(d).getTime()-CFG.duha.endOffsetBeforeDhuhrMin*60000)}}
function computeLastThird(m,f){const magh=isoToDate(m), fajr=isoToDate(f); let night=fajr-magh; if(night<=0) night+=86400000; const third=night/3; return {start:new Date(fajr.getTime()-third), end:fajr}}
function bearing(lat1,lon1,lat2,lon2){const φ1=toRad(lat1),φ2=toRad(lat2),λ1=toRad(lon1),λ2=toRad(lon2); const y=Math.sin(λ2-λ1)*Math.cos(φ2),x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1); return normalize360(toDeg(Math.atan2(y,x)));}

async function fetchTimingsByCoords(date,lat,lon, methodOverride){const m = methodOverride || CFG.calculation.method; const ds=dateToApi(date); const u=`${API_BASE}/timings/${ds}?latitude=${lat}&longitude=${lon}&method=${m}&school=${CFG.calculation.school}&iso8601=true`; const r=await fetch(u); const j=await r.json(); if(j.code!==200) throw new Error(); return j.data;}
async function fetchTimingsByCity(date,city,country, methodOverride){const m = methodOverride || CFG.calculation.method; const ds=dateToApi(date); const u=`${API_BASE}/timingsByCity/${ds}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${m}&school=${CFG.calculation.school}&iso8601=true`; const r=await fetch(u); const j=await r.json(); if(j.code!==200) throw new Error(); return j.data;}

function initScheme() {
  const savedScheme = LS('scheme') || 'colorful'; document.documentElement.setAttribute('data-scheme', savedScheme);
  document.querySelectorAll('.color-dot').forEach(btn => {
    btn.addEventListener('click', (e) => { const val = e.target.getAttribute('data-val'); document.documentElement.setAttribute('data-scheme', val); LS('scheme', val); });
  });
}

function applyFontSize() { document.body.style.fontSize = currentFontSize + 'rem'; LS('fontSize', currentFontSize); }

function checkNotify(prayerName) { 
  if (window.Notification && Notification.permission === 'granted') { 
    new Notification('تهجد', { 
      body: 'حان الآن موعد صلاة ' + prayerName, 
      icon: './assets/img/icon-192.png' 
    }); 
  } 
}
function initUI() {
  qs('#btnTextInc')?.addEventListener('click', () => { currentFontSize += 0.1; applyFontSize(); });
  qs('#btnTextDec')?.addEventListener('click', () => { currentFontSize = Math.max(1, currentFontSize - 0.1); applyFontSize(); });
  qs('#toggleTashkeel')?.addEventListener('click', () => { 
    showTashkeel = !showTashkeel; LS('tashkeel', showTashkeel);
    if(loaded.adhkar && rawAdhkarData) { const activeBtn = qs('#adhkarPills button.active'); if(activeBtn) renderDhikrList(qs('#adhkarContainer'), rawAdhkarData[activeBtn.dataset.key]||[], activeBtn.dataset.key); }
  });
  qs('#btnNotify')?.addEventListener('click', () => { if(!('Notification' in window)) return alert('متصفحك لا يدعم التنبيهات'); Notification.requestPermission().then(p => { if(p==='granted') alert('تم تفعيل تنبيهات الأذان بنجاح ✓'); }); });
  let hijriAdj = parseInt(LS('hijriAdj')) || 0; const hSel = qs('#hijriAdjSelect');
  if(hSel){ hSel.value = String(hijriAdj); hSel.addEventListener('change', (e) => { LS('hijriAdj', parseInt(e.target.value)); renderHijri(); }); }
  applyFontSize();
}

// تحديث دالة showSection لتصبح عالمية وتدعم تحميل البيانات
async function showSection(id) {
  // 1. تحديث أزرار القائمة السفلية
  qsa('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.target === id));
  
  // 2. تحديث الأقسام الظاهرة
  qsa('.section').forEach(s => s.classList.toggle('active', s.id === id));

  // 3. تحميل البيانات إذا لزم الأمر (خاص بالقرآن والأذكار والتعلم)
  if (id === 'quran' && !loaded.quran) { loaded.quran = true; loadSurahList(); }
  if (id === 'adhkar' && !loaded.adhkar) { 
    loaded.adhkar = true; 
    await Promise.all([loadAdhkar(), loadDailyBenefit()]); 
  }
  if (id === 'learning' && !loaded.learning) { 
    loaded.learning = true; 
    await Promise.all([loadLearning(), loadResources(), loadDailyBenefit()]); 
  }

  // 4. التحكم في ظهور الشريط العلوي (يظهر فقط في أوقات الصلاة)
  const topCard = document.getElementById('topKpiCard');
  if (topCard) {
    topCard.style.display = (id === 'times') ? 'block' : 'none';
  }

  // 5. العودة لأعلى الصفحة بسلاسة
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// جعل الدالة متاحة لـ HTML (خاص بنظام الـ Module)
window.showSection = showSection;

// تبسيط دالة initNav
function initNav() {
  qsa('.bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.target));
  });
}

function initCityList(){
  const cities=[{label:'الرياض',city:'Riyadh',country:'SA'},{label:'مكة المكرمة',city:'Makkah',country:'SA'},{label:'المدينة المنورة',city:'Al Madinah al Munawwarah',country:'SA'},{label:'جدة',city:'Jeddah',country:'SA'},{label:'الدمام',city:'Dammam',country:'SA'},{label:'الطائف',city:'Taif',country:'SA'},{label:'أبها',city:'Abha',country:'SA'},{label:'تبوك',city:'Tabuk',country:'SA'}]; 
  const sel=qs('#citySelect'); if(!sel) return; 
  cities.forEach(c=>{const o=document.createElement('option'); o.value=JSON.stringify(c); o.textContent=c.label; sel.appendChild(o);}); 
  const saved=LS('cityFallback'); if(saved) sel.value=saved; 
  sel.addEventListener('change',()=>{LS('cityFallback',sel.value); updateCityKPIFromSelect(); loadPrayerTimes(true);}); updateCityKPIFromSelect();
}

function getCityFallback(){const v=LS('cityFallback'); if(v) try{return JSON.parse(v)}catch(e){} return CFG.defaultCity;}
function updateCityKPI(t){setText('cityDisplay',t||'—')}
function updateCityKPIFromSelect(){const sel=qs('#citySelect'); if(sel&&sel.value) try{const o=JSON.parse(sel.value); updateCityKPI(o.label||o.city)}catch(e){} else {const c=getCityFallback(); updateCityKPI(c.label||c.city||'—')}}
async function reverseGeocodeCity(lat,lon){const key=`rg:${lat.toFixed(3)},${lon.toFixed(3)}`; const cached=LS(key); if(cached) try{return JSON.parse(cached)}catch(e){} const u=`${BDC_REVERSE}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=ar`; const r=await fetch(u); const j=await r.json(); const out={city:j.city||j.locality||j.principalSubdivision||null}; LS(key,JSON.stringify(out)); return out;}

function renderNextPrayer(T,fajrTomorrowISO){
  const order=['Fajr','Dhuhr','Asr','Maghrib','Isha']; 
  const now=new Date(); 
  let nextName=null, time=null, currName='Isha', currTime=null; 

  // البحث عن الصلاة القادمة والسابقة
  for(let i=0; i<order.length; i++){
    const k = order[i]; 
    const d = isoToDate(T[k]); 
    if(d > now){
      nextName=k; time=d; 
      // الصلاة الحالية هي التي تسبق القادمة في المصفوفة
      currName = i === 0 ? 'Isha' : order[i-1];
      currTime = i === 0 ? isoToDate(T['Isha']) : isoToDate(T[order[i-1]]); // ملاحظة: إذا كانت الفجر، نحتاج توقيت عشاء الأمس ولكن للتبسيط سنستخدم ت د
      break;
    }
  } 

  if(!nextName){nextName='Fajr'; time=isoToDate(fajrTomorrowISO); currName='Isha'; currTime=isoToDate(T['Isha']);} 
  
  setText('nextPrayerName',translatePrayer(nextName)); 
  setText('nextPrayerTime',formatTime12h(time)); 

  if(nextTimer) clearInterval(nextTimer); 
  nextTimer=setInterval(()=>{
    const nowLoop = new Date();
    const diffNext = time - nowLoop; 
    const diffPrev = nowLoop - currTime; // الوقت المنقضي منذ الصلاة الحالية
    
    // إذا مر أقل من 35 دقيقة على الصلاة الحالية (35 * 60 * 1000)
    if(diffPrev > 0 && diffPrev < 2100000) {
      const minsPassed = Math.floor(diffPrev / 60000);
      setText('nextCountdown', `${translatePrayer(currName)}: منذ ${minsPassed} د`);
    } else {
      // العداد التنازلي المعتاد للصلاة القادمة
      if(diffNext <= 0){
        setText('nextCountdown','حان الوقت'); 
        clearInterval(nextTimer); 
        setTimeout(()=>loadPrayerTimes(), 60000); 
        return;
      } 
      const h=Math.floor(diffNext/3600000), m=Math.floor((diffNext%3600000)/60000), s=Math.floor((diffNext%60000)/1000); 
      setText('nextCountdown', h > 0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }
  },1000);
} 

function setQiblaFromCoords(lat,lon){const b=bearing(lat,lon,KAABA.lat,KAABA.lon); setText('qiblaDeg',`${b.toFixed(1)}°`); LS('qiblaBearing',String(b));}
function loadStoredQibla(){const v=LS('qiblaBearing'); if(v) setText('qiblaDeg',`${parseFloat(v).toFixed(1)}°`)}

async function loadPrayerTimes(forceCity=false){
  setText('ptStatus',''); setText('ptMeta',''); 
  const controls = qs('#locationControls');
  const today=new Date(), tomorrow=new Date(Date.now()+86400000), c=getCityFallback(); 

  const renderTimes = (T, TT, T_True) => {
    ['Fajr','Dhuhr','Asr','Maghrib','Isha'].forEach(k=>{ const el = qs('#t_'+k.toLowerCase()+'_s'); if(el) el.textContent = formatTime12h(isoToDate(T[k])); }); 
    const trueIshaTime = isoToDate(T_True.Isha); const elTrueIsha = qs('#t_isha_true_s'); if(elTrueIsha) elTrueIsha.textContent = formatTime12h(trueIshaTime);
    setText('t_fajr_e', formatTime12h(isoToDate(T.Sunrise))); setText('t_dhuhr_e', formatTime12h(isoToDate(T.Asr)));
    setText('t_asr_e', formatTime12h(isoToDate(T.Maghrib))); setText('t_maghrib_e', formatTime12h(trueIshaTime)); setText('t_isha_e', formatTime12h(isoToDate(T.Midnight)));
    const duha=computeDuha(T.Sunrise,T.Dhuhr); setText('t_duha_s', formatTime12h(duha.start)); setText('t_duha_e', formatTime12h(duha.end)); 
    const last=computeLastThird(T.Maghrib,TT.Fajr); setText('t_lastthird_s', formatTime12h(last.start)); setText('t_lastthird_e', formatTime12h(last.end)); 
    renderNextPrayer(T,TT.Fajr);
  };

  try{
    if(!forceCity && 'geolocation' in navigator){
      updateCityKPI('جاري التحديد…'); 
      const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:12000,maximumAge:600000})); 
      const lat=pos.coords.latitude, lon=pos.coords.longitude; 
      const acc = Math.round(pos.coords.accuracy||0); let accText = 'عالية';
      if(acc > 500) { accText = 'سيئة'; if(controls) controls.style.display = 'flex'; } else { if(acc > 50) accText = 'متوسطة'; if(controls) controls.style.display = 'none'; }
      setText('ptMeta', `دقة الموقع: ${accText}`);
      const rg=reverseGeocodeCity(lat,lon).catch(()=>null); 
      const td=await fetchTimingsByCoords(today,lat,lon); const td2=await fetchTimingsByCoords(tomorrow,lat,lon); const tdTrue=await fetchTimingsByCoords(today,lat,lon, 3); 
      const city=await rg; updateCityKPI(city&&city.city?city.city:'موقعي'); setQiblaFromCoords(lat,lon);
      renderTimes(td.timings, td2.timings, tdTrue.timings);
    } else {
      if(controls) controls.style.display = 'flex'; updateCityKPI(c.label||c.city); 
      const td=await fetchTimingsByCity(today,c.city,c.country); const td2=await fetchTimingsByCity(tomorrow,c.city,c.country); const tdTrue=await fetchTimingsByCity(today,c.city,c.country, 3);
      renderTimes(td.timings, td2.timings, tdTrue.timings);
    } 
  }catch(e){
    if(controls) controls.style.display = 'flex'; setText('ptStatus','لم يتم تفعيل الموقع، اختر مدينتك يدوياً.'); updateCityKPI(c.label||c.city);
    try {
        const td = await fetchTimingsByCity(today,c.city,c.country); const td2 = await fetchTimingsByCity(tomorrow,c.city,c.country); const tdTrue = await fetchTimingsByCity(today,c.city,c.country, 3);
        renderTimes(td.timings, td2.timings, tdTrue.timings);
    } catch(ex){}
  }
}

function setupCompass() {
  const needle = qs('#needle'), acc = qs('#compassAccuracy'); 
  if (!needle) return; 

  let lastHeading = null;

  function render(q, h) {
    // حساب الزاوية النهائية
    const angle = normalize360(q - h);
    // استخدام التدوير فقط لمنع حركة "فوق تحت"
    needle.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
  } 

  function onOri(ev) {
    let heading = null; 

    // للأيفون (Safari)
    if (typeof ev.webkitCompassHeading === 'number' && ev.webkitCompassHeading >= 0) {
      heading = ev.webkitCompassHeading; 
      if (typeof ev.webkitCompassAccuracy === 'number' && ev.webkitCompassAccuracy > 30) {
        acc.textContent = 'يرجى تحريك الهاتف على شكل 8 لمعايرة البوصلة 🔄';
      } else { acc.textContent = ''; }
    } 
    // للأندرويد والمتصفحات الداعمة لـ Absolute
    else if (typeof ev.alpha === 'number') {
      heading = (ev.absolute !== false) ? 360 - ev.alpha : null;
    }

    if (heading === null) return;

    // الحصول على زاوية القبلة المخزنة
    const qibla = parseFloat(LS('qiblaBearing') || '0') || 0;

    // تنعيم الحركة لمنع القفز السريع
    if (lastHeading === null) {
      lastHeading = heading;
    } else {
      // دالة حساب أقصر مسافة للدوران لمنع الالتفاف الكامل (Shortest Path)
      let diff = heading - lastHeading;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      lastHeading += diff * 0.2; // معامل التنعيم
    }

    render(qibla, lastHeading);
  }

  const btn = qs('#enableCompass');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const p = await DeviceOrientationEvent.requestPermission();
          if (p === 'granted') {
            window.addEventListener('deviceorientation', onOri, true);
            btn.style.display = 'none';
          } else { acc.textContent = 'تم رفض تصريح البوصلة'; }
        } catch (e) { acc.textContent = 'خطأ في تفعيل الحساس'; }
      } else {
        // للأندرويد والمتصفحات الأخرى
        window.addEventListener('deviceorientationabsolute', onOri, true);
        btn.style.display = 'none';
      }
    });
  }
}

function haptic(ms=10){try{if(navigator.vibrate) navigator.vibrate(ms);}catch(e){}}

function setupTasbeeh(){
  const select=qs('#tasbeehPhraseSelect'), current=qs('#currentTasbeeh'), countEl=qs('#tasbeehCount'), targetEl=qs('#tasbeehTarget'), btn=qs('#tasbeehBtn'), resetBtn=qs('#tasbeehReset'), nextBtn=qs('#tasbeehNext'); 
  if(!select||!current||!countEl||!targetEl||!btn||!resetBtn||!nextBtn) return; 

  select.innerHTML=''; 
  TASBEEH_PHRASES.forEach((p,idx)=>{const o=document.createElement('option'); o.value=String(idx); o.textContent=`${p.name} — ${p.target}`; select.appendChild(o);}); 

  let phraseIndex=parseInt(LS('tasbeehPhraseIndex')||'0',10); 
  let count=parseInt(LS('tasbeehCount')||'0',10); 
  
  // --- منطق التصفير التلقائي كل ساعتين ---
  let lastReset = parseInt(LS('tasbeehLastReset') || '0', 10);
  const TWO_HOURS = 2 * 60 * 60 * 1000; // ساعتان بالملي ثانية

  const checkAutoReset = () => {
    const now = Date.now();
    if (lastReset === 0 || (now - lastReset) >= TWO_HOURS) {
      count = 0;
      lastReset = now;
      LS('tasbeehLastReset', String(lastReset));
      save();
    }
  };
  // ---------------------------------------

  function render(){
    const p=TASBEEH_PHRASES[phraseIndex]; 
    select.value=String(phraseIndex); 
    current.textContent=p.name; 
    countEl.textContent=String(count); 
    targetEl.textContent=`الهدف: ${p.target}`;
  } 

  function save(){
    LS('tasbeehPhraseIndex', String(phraseIndex)); 
    LS('tasbeehCount', String(count));
  } 

  // تشغيل فحص التصفير عند البداية
  checkAutoReset();

  select.addEventListener('change',()=>{
    phraseIndex=parseInt(select.value,10)||0; 
    count=0; 
    save(); 
    render(); 
    haptic(10);
  }); 

  const increment=()=>{
    checkAutoReset(); // فحص الوقت عند كل ضغطة للتأكد
    const p=TASBEEH_PHRASES[phraseIndex]; 
    count+=1; 
    save(); 
    render(); 
    if(count===p.target) haptic([28,35,28]); else haptic(9);
  }; 

  btn.addEventListener('click',increment); 
  btn.addEventListener('touchstart',()=>haptic(7),{passive:true}); 

  resetBtn.addEventListener('click',()=>{
    count=0; 
    lastReset = Date.now(); // تحديث وقت التصفير يدوياً أيضاً
    LS('tasbeehLastReset', String(lastReset));
    save(); 
    render(); 
    haptic(15);
  }); 

  nextBtn.addEventListener('click',()=>{
    phraseIndex=(phraseIndex+1)%TASBEEH_PHRASES.length; 
    count=0; 
    save(); 
    render(); 
    haptic([15,18,15]);
  }); 

  render();
}
function dayKey(){return new Date().toDateString()}

function updateGlobalProgress(list, keyPrefix) {
  const bar = qs('#globalAdhkarProgress'); if(!bar) return;
  if(list.length === 0) { bar.style.width = '0%'; return; }
  const completed = list.filter((it, i) => { const k=`dhikr:${keyPrefix}:${i}:${dayKey()}`; const rem = LS(k); if(typeof it.repeat === 'number') return rem === '0'; return true; }).length;
  bar.style.width = Math.round((completed / list.length) * 100) + '%';
}

function renderPager(container,list,keyPrefix){
  if(!list) return; updateGlobalProgress(list, keyPrefix);
  let index=parseInt(LS(`pager:${keyPrefix}:index`)||'0',10); if(Number.isNaN(index)||index<0||index>=list.length) index=0;
  const lastSavedTime = parseInt(LS(`pager:${keyPrefix}:time`)||'0',10);
  if(Date.now() - lastSavedTime > 6 * 3600 * 1000) { index = 0; }
  LS(`pager:${keyPrefix}:time`, String(Date.now()));
  const host=document.createElement('div'); host.className='pager-wrap'; const indexEl=document.createElement('div'); indexEl.className='pager-index'; const card=document.createElement('div'); card.className='pager-card'; const controls=document.createElement('div'); controls.className='pager-controls'; const prev=document.createElement('button'); prev.className='btn secondary'; prev.textContent='السابق'; const next=document.createElement('button'); next.className='btn'; next.textContent='التالي'; 
  controls.append(prev,next); host.append(indexEl,card,controls); container.appendChild(host); 

  function update(){
    const it=list[index]; if(!it) return; const max=it.repeat; const numeric=typeof max==='number'; const repeatedOnce=numeric&&max===1; 
    const k=`dhikr:${keyPrefix}:${index}:${dayKey()}`; let rem=LS(k); rem=rem==null?(numeric?max:0):parseInt(rem,10); if(!numeric) rem=0; 
    const pct=numeric&&max>0?Math.round(((max-rem)/max)*100):0; indexEl.textContent=`${index+1} / ${list.length}`; 
    const whenHtml=it.when?`<span class="when-chip">${it.when}</span>`:''; 
    const repeatHtml=repeatedOnce?'':`<button class="btn ${numeric?'':'secondary'} repeat-square ${numeric&&rem===0?'done':''} ${(!numeric||String(max).length>2)?'wide':''} do">${numeric?(rem===0?'تم':String(rem)):String(max)}</button>`; 
    const displayText = showTashkeel ? it.text : (it.text||'').replace(/[\u064B-\u065F\u0640]/g, '');
    card.innerHTML=`<p class="dhikr-text">${displayText}</p><div class="pager-meta"><span>المصدر: ${it.source||'—'}</span>${whenHtml}</div>${numeric&&!repeatedOnce?'<div class="progress"><div style="width:'+pct+'%"></div></div>':''}<div class="actions"><div class="left"><button class="btn secondary tiny copy">نسخ</button><a class="mini-link" href="${it.ref||'#'}" target="_blank" rel="noopener">مرجع</a></div>${repeatHtml}</div>`; 
    card.querySelector('.copy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(displayText); haptic(8);}catch(e){}}); 
    const btn=card.querySelector('.do'); const bar=card.querySelector('.progress>div'); 
    if(btn&&numeric){
      btn.addEventListener('click',()=>{
        if(rem<=0) return; rem-=1; LS(k,String(rem)); const p=Math.round(((max-rem)/max)*100); 
        if(bar) bar.style.width=p+'%'; btn.textContent=rem===0?'تم':String(rem); btn.classList.toggle('done', rem===0); haptic(rem===0?[20,28,20]:8);
        updateGlobalProgress(list, keyPrefix);
      });
    } 
    if(btn&&!numeric) btn.disabled=true; prev.disabled=index===0; next.disabled=index===list.length-1; LS(`pager:${keyPrefix}:index`,String(index));
  } 
  prev.addEventListener('click',()=>{if(index>0){index-=1; update(); haptic(8);}}); next.addEventListener('click',()=>{if(index<list.length-1){index+=1; update(); haptic(8);}}); 
  update();
}

function renderDhikrList(container,list,keyPrefix){container.innerHTML=''; renderPager(container,list,keyPrefix);}

async function loadAdhkar(){
  const fallbackData = {"morning":[],"evening":[],"sleep":[],"wakeup":[],"afterPrayer":[],"home":[],"mosque":[],"daily":[]};
  rawAdhkarData = await fetchJSON('./data/adhkar.json', fallbackData);
  const tabs=[
    {key:'morning',label:'الصباح'}, {key:'evening',label:'المساء'}, {key:'sleep',label:'النوم'},
    {key:'wakeup',label:'الاستيقاظ'}, {key:'afterPrayer',label:'بعد الصلاة'}, {key:'home',label:'المنزل'},
    {key:'mosque',label:'المسجد'}, {key:'worry',label:'الهم والحزن'}, {key:'travel',label:'السفر'},
    {key:'illness',label:'المرض'}, {key:'dua',label:'أدعية'}, {key:'daily',label:'متفرقة'}
  ];
  const pills=qs('#adhkarPills'), container=qs('#adhkarContainer'); if(!pills||!container) return; 
  function activate(key){qsa('#adhkarPills button').forEach(b=>b.classList.toggle('active',b.dataset.key===key)); renderDhikrList(container,rawAdhkarData[key]||[],key);} 
  pills.innerHTML=''; tabs.forEach(t=>{const b=document.createElement('button'); b.textContent=t.label; b.dataset.key=t.key; b.addEventListener('click',()=>activate(t.key)); pills.appendChild(b);}); activate('morning');
}

async function loadDailyBenefit() {
  const fallback = ["من لزم الاستغفار جعل الله له من كل هم فرجاً، ومن كل ضيق مخرجاً."];
  let benefits = fallback;
  try {
    const res = await fetch('./data/benefits.json');
    if(res.ok) { benefits = await res.json(); LS('cached_benefits', JSON.stringify(benefits)); } 
    else throw new Error();
  } catch(e) {
    const cached = LS('cached_benefits'); if(cached) benefits = JSON.parse(cached);
  }
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  const todayBenefit = benefits[dayOfYear % benefits.length];
  const container = qs('#dailyBenefitContent'); if(container) container.textContent = todayBenefit;
}

async function loadResources(){const data = await fetchJSON('./data/resources.json', {useful:[]}); const host=qs('#usefulLinks'); if(!host) return; host.innerHTML=''; (data.useful||[]).forEach(g=>{const sec=document.createElement('div'); sec.className='pager-card'; sec.innerHTML=`<h3 class="section-title">${g.group}</h3>`; const ul=document.createElement('ul'); ul.className='custom-list'; (g.items||[]).forEach(it=>{const li=document.createElement('li'); li.innerHTML=`<a href="${it.url}" target="_blank" rel="noopener">${it.title}</a> <span class="small" style="display:block; margin-top:4px;">${it.desc||''}</span>`; ul.appendChild(li);}); sec.appendChild(ul); host.appendChild(sec);});}
async function loadLearning(){const data = await fetchJSON('./data/learning.json', {plan:[], collections:[], reminders:[]}); const plan=qs('#learnPlan'), col=qs('#learnCollections'), rem=qs('#learnReminders'); if(plan){plan.innerHTML=''; (data.plan||[]).forEach(it=>{const d=document.createElement('div'); d.className='pager-card'; d.innerHTML=`<b style="font-size:1.4rem; color:var(--accent); display:block; margin-bottom:8px;">${it.title}</b><div style="font-size:1.3rem; line-height:1.8;">${it.tip}</div>`; plan.appendChild(d);});} if(col){col.innerHTML=''; (data.collections||[]).forEach(it=>{const li=document.createElement('li'); li.innerHTML=`<a href="${it.url}" target="_blank" rel="noopener">${it.title}</a>`; col.appendChild(li);});} if(rem){rem.innerHTML=''; (data.reminders||[]).forEach(t=>{const li=document.createElement('li'); li.textContent=t; rem.appendChild(li);});}}
function showUpdateBar(reg){const bar=qs('#updateBar'); if(!bar) return; bar.style.display='flex'; qs('#updateNow')?.addEventListener('click',()=>{if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});},{once:true}); qs('#updateLater')?.addEventListener('click',()=>{bar.style.display='none';},{once:true});}
async function registerSW(){if(!('serviceWorker' in navigator)) return; const reg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'}); try{await reg.update();}catch(e){} navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true}); if(reg.waiting) showUpdateBar(reg); reg.addEventListener('updatefound',()=>{const sw=reg.installing; if(!sw) return; sw.addEventListener('statechange',()=>{if(sw.state==='installed'&&navigator.serviceWorker.controller) showUpdateBar(reg);});});}

qs('#backToSurahs')?.addEventListener('click', () => {
  qs('#quranReader').style.display = 'none';
  qs('#surahList').style.display = 'grid';
  window.scrollTo({top: 0, behavior: 'smooth'});
});

async function init(){
  const fallbackConfig = { calculation: { method: 4, school: 0 }, duha: { startOffsetAfterSunriseMin: 15, endOffsetBeforeDhuhrMin: 10 }, defaultCity: { label: 'مكة المكرمة', city: 'Makkah', country: 'SA' } };
  CFG = await fetchJSON('./assets/js/config.json', fallbackConfig); 
  initScheme(); initUI(); initNav(); initCityList(); renderHijri(); loadStoredQibla(); setupCompass(); setupTasbeeh(); 
  setupTrueIshaToggle(); 
  qs('#useLocation')?.addEventListener('click',()=>loadPrayerTimes(false)); 
  await loadPrayerTimes(false); await registerSW();
}
window.addEventListener('load',init);

let allSurahs = []; 
let currentQuranPage = 1;

async function loadSurahList() {
  const container = document.getElementById('surahList');
  if (!container) return;
  try {
    const res = await fetch('https://api.alquran.cloud/v1/surah');
    const data = await res.json();
    allSurahs = data.data;
    renderSurahs(allSurahs);
    setupQuranSearch();
    setupQuranTabs();
    checkLastRead(); // فحص القراءة المحفوظة مباشرة هنا
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;">حدث خطأ في الاتصال.</div>';
  }
}

function renderSurahs(list) {
  const container = document.getElementById('surahList');
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center; width:100%; padding: 20px;">لا توجد نتائج</div>';
    return;
  }
  list.forEach(s => {
    const el = document.createElement('div');
    el.className = 'surah-card';
    el.innerHTML = `
      <div class="surah-info">
        <div class="surah-name">${s.name}</div>
        <div class="surah-meta">${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} • ${s.numberOfAyahs} آية</div>
      </div>
      <div class="surah-number" style="color: var(--muted); font-weight: bold;">${s.number}</div>
    `;
    el.addEventListener('click', () => openSurah(s.number, s.name));
    container.appendChild(el);
  });
}

function setupQuranSearch() {
  const searchInput = document.getElementById('quranSearch');
  searchInput?.addEventListener('input', (e) => {
    const term = e.target.value.trim();
    const filtered = allSurahs.filter(s => s.name.includes(term));
    renderSurahs(filtered);
  });
}

function setupQuranTabs() {
  const tabs = document.querySelectorAll('#quranTabs button');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const searchInput = document.getElementById('quranSearch');
      
      if (tab.dataset.tab === 'juz') {
        if(searchInput) searchInput.style.display = 'none';
        renderJuzList();
      } else if (tab.dataset.tab === 'page') {
        if(searchInput) searchInput.style.display = 'none';
        renderPageList();
      } else {
        if(searchInput) searchInput.style.display = 'block';
        renderSurahs(allSurahs);
      }
    });
  });
}

function renderJuzList() {
  const container = document.getElementById('surahList');
  container.innerHTML = '';
  for (let i = 1; i <= 30; i++) {
    const el = document.createElement('div');
    el.className = 'surah-card';
    el.innerHTML = `<div class="surah-name">الجزء ${i}</div>`;
    el.addEventListener('click', () => openJuz(i));
    container.appendChild(el);
  }
}

function renderPageList() {
    const container = document.getElementById('surahList');
    container.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 20px; background: var(--bg);">
            <h3 style="color: var(--accent); margin-bottom: 15px;">الانتقال لصفحة محددة</h3>
            <input type="number" id="pageInputGo" min="1" max="604" placeholder="أدخل رقم الصفحة (1 - 604)" 
                   style="width: 100%; padding: 15px; margin-bottom: 15px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--bg2); color: var(--fg); text-align: center; font-size: 1.5rem; outline: none;">
            <button class="btn" id="btnGoToPage" style="width: 100%; font-size: 1.4rem;">اذهب للصفحة</button>
        </div>
    `;
    document.getElementById('btnGoToPage')?.addEventListener('click', () => {
        const p = parseInt(document.getElementById('pageInputGo').value);
        if (p >= 1 && p <= 604) openPage(p);
        else alert('الرجاء إدخال رقم صحيح بين 1 و 604');
    });
}

async function openJuz(num) {
  toggleQuranView(true);
  setText('surahTitle', `الجزء ${num}`);
  const textEl = document.getElementById('quranText');
  textEl.innerHTML = 'جاري تحميل الجزء...';
  const controls = document.getElementById('quranPageControls');
  if(controls) controls.style.display = 'none';
  
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/juz/${num}/quran-uthmani`);
    const data = await res.json();
    renderAyahs(data.data.ayahs);
  } catch (e) { textEl.innerHTML = "خطأ في التحميل"; }
}

async function openSurah(number, name) {
  toggleQuranView(true);
  setText('surahTitle', name);
  const textEl = document.getElementById('quranText');
  textEl.innerHTML = 'جاري تحميل السورة...';
  const controls = document.getElementById('quranPageControls');
  if(controls) controls.style.display = 'none';
  
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`);
    const data = await res.json();
    renderAyahs(data.data.ayahs);
  } catch (e) { textEl.innerHTML = "خطأ في التحميل"; }
}

async function openPage(pageNum) {
    if (pageNum < 1) pageNum = 1;
    if (pageNum > 604) pageNum = 604;
    currentQuranPage = pageNum;
    LS('lastReadPage', pageNum);
    checkLastRead();
    
    toggleQuranView(true);
    const controls = document.getElementById('quranPageControls');
    if(controls) controls.style.display = 'flex';
    setText('pageInfo', `ص ${pageNum}`);
    setText('surahTitle', `الصفحة ${pageNum}`);
    
    const textEl = document.getElementById('quranText');
    textEl.innerHTML = 'جاري تحميل الصفحة...';
    
    try {
        const res = await fetch(`https://api.alquran.cloud/v1/page/${pageNum}/quran-uthmani`);
        const data = await res.json();
        if(data.data.ayahs.length > 0) {
            setText('surahTitle', `${data.data.ayahs[0].surah.name} - ص ${pageNum}`);
        }
        renderAyahs(data.data.ayahs);
    } catch (e) { textEl.innerHTML = "خطأ في التحميل"; }
}

function renderAyahs(ayahs) {
  let html = '';
  ayahs.forEach(a => {
    const text = showTashkeel ? a.text : a.text.replace(/[\u064B-\u065F\u0640]/g, '');
    html += `<span class="ayah-text">${text}</span><span class="ayah-number">${a.numberInSurah}</span> `;
  });
  document.getElementById('quranText').innerHTML = html;
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function toggleQuranView(isReading) {
  const surahList = document.getElementById('surahList');
  const quranReader = document.getElementById('quranReader');
  const header = document.querySelector('.quran-header');
  if(surahList) surahList.style.display = isReading ? 'none' : 'grid';
  if(quranReader) quranReader.style.display = isReading ? 'block' : 'none';
  if(header) header.style.display = isReading ? 'none' : 'block';
}

function checkLastRead() {
    const lastPage = LS('lastReadPage');
    const btn = document.getElementById('btnContinueReading');
    if (lastPage && btn) {
        btn.style.display = 'block';
        setText('lastReadPageNum', lastPage);
        btn.onclick = () => openPage(parseInt(lastPage));
    }
}

document.getElementById('backToSurahs')?.addEventListener('click', () => {
  toggleQuranView(false);
  window.scrollTo({top: 0, behavior: 'smooth'});
});

document.getElementById('btnNextPage')?.addEventListener('click', () => openPage(currentQuranPage + 1));
document.getElementById('btnPrevPage')?.addEventListener('click', () => openPage(currentQuranPage - 1));