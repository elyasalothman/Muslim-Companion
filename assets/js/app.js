// Rafiq Muslim v0.7.0 - Optimized, Cached, & Enhanced
const API_BASE = 'https://api.aladhan.com/v1';
const KAABA = { lat: 21.4225, lon: 39.8262 };
const BDC_REVERSE = 'https://api-bdc.net/data/reverse-geocode-client';
const qs = (s, r = document) => r.querySelector(s), qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

let CFG = null, nextTimer = null;
let loaded = { adhkar: false, resources: false, learning: false };
let rawAdhkarData = null;
let showTashkeel = LS('tashkeel') !== 'false';
let autoNextDhikr = LS('autoNextDhikr') === 'true';
let voiceAlertEnabled = LS('voiceAlert') === 'true';
let currentFontSize = parseFloat(LS('fontSize')) || 1.5;

const ALERT_AUDIO = new Audio('https://api.aladhan.com/audio/adhan/afasy.mp3'); // صوت التنبيه
const TASBEEH_PHRASES = [{ "name": "سُبْحَانَ اللَّهِ", "target": 33 }, { "name": "الْحَمْدُ لِلَّهِ", "target": 33 }, { "name": "اللَّهُ أَكْبَرُ", "target": 34 }, { "name": "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "target": 100 }, { "name": "لَا إِلَهَ إِلَّا اللَّهُ", "target": 100 }, { "name": "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", "target": 100 }, { "name": "أَسْتَغْفِرُ اللَّهَ", "target": 100 }];

// --- المساعدات الأساسية ---
function setText(id, t) { const e = document.getElementById(id); if (e) e.textContent = t; }
function isoToDate(i) { return new Date(i) }
function dateToApi(d) { return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear() }
function toRad(x) { return x * Math.PI / 180 } function toDeg(x) { return x * 180 / Math.PI } function normalize360(x) { x %= 360; if (x < 0) x += 360; return x }
function formatTime12h(d) { try { return new Intl.DateTimeFormat('ar', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d) } catch (e) { let h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0'); const suf = h >= 12 ? 'م' : 'ص'; h = h % 12 || 12; return `${h}:${m} ${suf}`; } }
function dayKey() { return new Date().toDateString() }

// --- جلب البيانات مع التخزين المؤقت الذكي (Smart Caching) ---
async function fetchJSON(url, defaultData) {
    try { const res = await fetch(url); if (!res.ok) throw new Error(); return await res.json(); }
    catch (e) { return defaultData; }
}

async function fetchWithCache(url, cacheKey) {
    const today = dayKey();
    const cached = LS(cacheKey);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (parsed.date === today) return parsed.data; // إرجاع من الذاكرة إذا كان لنفس اليوم
        } catch (e) {}
    }
    const r = await fetch(url);
    const j = await r.json();
    if (j.code === 200) {
        LS(cacheKey, JSON.stringify({ date: today, data: j.data }));
        return j.data;
    }
    throw new Error('API_ERROR');
}

// --- إدارة الواجهة والتنقل ---
function initScheme() {
    const savedScheme = LS('scheme') || 'brown'; document.documentElement.setAttribute('data-scheme', savedScheme);
    document.querySelectorAll('.color-dot').forEach(btn => {
        btn.addEventListener('click', (e) => { const val = e.target.getAttribute('data-val'); document.documentElement.setAttribute('data-scheme', val); LS('scheme', val); });
    });
}

function applySettings() {
    document.body.style.fontSize = currentFontSize + 'rem';
    LS('fontSize', currentFontSize);
    
    // تحديث أزرار الإعدادات
    const btnVoice = qs('#btnVoiceAlert'); if (btnVoice) btnVoice.style.background = voiceAlertEnabled ? 'var(--accent)' : '';
    const btnAuto = qs('#btnAutoNext'); if (btnAuto) btnAuto.style.background = autoNextDhikr ? 'var(--accent)' : '';
}

function initUI() {
    qs('#btnTextInc')?.addEventListener('click', () => { currentFontSize += 0.1; applySettings(); });
    qs('#btnTextDec')?.addEventListener('click', () => { currentFontSize = Math.max(1, currentFontSize - 0.1); applySettings(); });
    
    qs('#toggleTashkeel')?.addEventListener('click', () => {
        showTashkeel = !showTashkeel; LS('tashkeel', showTashkeel);
        if (loaded.adhkar && rawAdhkarData) { const activeBtn = qs('#adhkarPills button.active'); if (activeBtn) renderDhikrList(qs('#adhkarContainer'), rawAdhkarData[activeBtn.dataset.key] || [], activeBtn.dataset.key); }
    });
    
    qs('#btnNotify')?.addEventListener('click', () => { if (!('Notification' in window)) return alert('متصفحك لا يدعم التنبيهات'); Notification.requestPermission().then(p => { if (p === 'granted') alert('تم تفعيل إشعارات الشاشة بنجاح ✓'); }); });
    qs('#btnVoiceAlert')?.addEventListener('click', () => { voiceAlertEnabled = !voiceAlertEnabled; LS('voiceAlert', voiceAlertEnabled); applySettings(); if(voiceAlertEnabled) { ALERT_AUDIO.play(); setTimeout(()=>ALERT_AUDIO.pause(), 2000); } });
    qs('#btnAutoNext')?.addEventListener('click', () => { autoNextDhikr = !autoNextDhikr; LS('autoNextDhikr', autoNextDhikr); applySettings(); });

    let hijriAdj = parseInt(LS('hijriAdj')) || 0; const hSel = qs('#hijriAdjSelect');
    if (hSel) { hSel.value = String(hijriAdj); hSel.addEventListener('change', (e) => { LS('hijriAdj', parseInt(e.target.value)); renderHijri(); }); }
    applySettings();
}

function showSection(id) { qsa('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.target === id)); qsa('.section').forEach(s => s.classList.toggle('active', s.id === id)); }
function initNav() {
    qsa('.bottom-nav button').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.target; showSection(id);
        if (id === 'adhkar' && !loaded.adhkar) { loaded.adhkar = true; await loadAdhkar(); }
        if (id === 'learning' && !loaded.learning) { loaded.learning = true; await Promise.all([loadLearning(), loadResources(), loadDailyBenefit()]); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
}

// --- أوقات الصلاة والتقويم ---
function renderHijri() {
    try {
        const d = new Date(); d.setDate(d.getDate() + (parseInt(LS('hijriAdj')) || 0));
        const f = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }); setText('hijri', f.format(d));
    } catch (e) { setText('hijri', '—') }
}

function translatePrayer(k) { return ({ Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' })[k] || k; }
function computeDuha(s, d) { return { start: new Date(isoToDate(s).getTime() + CFG.duha.startOffsetAfterSunriseMin * 60000), end: new Date(isoToDate(d).getTime() - CFG.duha.endOffsetBeforeDhuhrMin * 60000) } }
function computeLastThird(m, f) { const magh = isoToDate(m), fajr = isoToDate(f); let night = fajr - magh; if (night <= 0) night += 86400000; return { start: new Date(fajr.getTime() - (night / 3)), end: fajr } }

function renderNextPrayer(T, fajrTomorrowISO) {
    const order = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']; const now = new Date(); let nextName = null, time = null, currName = 'Isha';
    for (let i = 0; i < order.length; i++) { const k = order[i]; const d = isoToDate(T[k]); if (d > now) { nextName = k; time = d; currName = i === 0 ? 'Isha' : order[i - 1]; break; } }
    if (!nextName) { nextName = 'Fajr'; time = isoToDate(fajrTomorrowISO); currName = 'Isha'; }

    setText('nextPrayerName', translatePrayer(nextName)); setText('nextPrayerTime', formatTime12h(time));
    qsa('.table tbody tr').forEach(tr => tr.classList.remove('current-prayer'));
    const currRow = qs('#tr_' + currName); if (currRow) currRow.classList.add('current-prayer');

    if (nextTimer) clearInterval(nextTimer);
    let alerted = false;
    nextTimer = setInterval(() => {
        const diff = time - new Date();
        if (diff <= 0) {
            setText('nextCountdown', 'حان الوقت');
            if(!alerted) {
               if ('Notification' in window && Notification.permission === 'granted') new Notification('رفيق المسلم', { body: 'حان الآن موعد صلاة ' + translatePrayer(nextName), icon: './assets/img/icon-192.png' });
               if (voiceAlertEnabled) { ALERT_AUDIO.currentTime = 0; ALERT_AUDIO.play().catch(()=>{}); }
               alerted = true;
            }
            clearInterval(nextTimer); setTimeout(() => loadPrayerTimes(), 60000); return;
        }
        const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
        setText('nextCountdown', h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
}

async function loadPrayerTimes(forceCity = false) {
    const ptStatus = qs('#ptStatus'); ptStatus.className = 'small'; setText('ptStatus', 'جاري التحديث...');
    const today = new Date(), tomorrow = new Date(Date.now() + 86400000);
    const c = LS('cityFallback') ? JSON.parse(LS('cityFallback')) : CFG.defaultCity;

    const renderTimes = (T, TT, T_True) => {
        ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(k => { const el = qs('#t_' + k.toLowerCase() + '_s'); if (el) el.textContent = formatTime12h(isoToDate(T[k])); });
        const elTrueIsha = qs('#t_isha_true_s'); if (elTrueIsha) elTrueIsha.textContent = formatTime12h(isoToDate(T_True.Isha));
        setText('t_fajr_e', formatTime12h(isoToDate(T.Sunrise))); setText('t_dhuhr_e', formatTime12h(isoToDate(T.Asr)));
        setText('t_asr_e', formatTime12h(isoToDate(T.Maghrib))); setText('t_maghrib_e', formatTime12h(isoToDate(T_True.Isha))); setText('t_isha_e', formatTime12h(isoToDate(T.Midnight)));
        const duha = computeDuha(T.Sunrise, T.Dhuhr); setText('t_duha_s', formatTime12h(duha.start)); setText('t_duha_e', formatTime12h(duha.end));
        const last = computeLastThird(T.Maghrib, TT.Fajr); setText('t_lastthird_s', formatTime12h(last.start)); setText('t_lastthird_e', formatTime12h(last.end));
        renderNextPrayer(T, TT.Fajr);
        setText('ptStatus', ''); // مسح رسالة التحميل
    };

    try {
        if (!forceCity && 'geolocation' in navigator) {
            const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000, maximumAge: 600000 }));
            const lat = pos.coords.latitude, lon = pos.coords.longitude;
            setText('ptMeta', `دقة الموقع: ${pos.coords.accuracy > 500 ? 'ضعيفة' : 'ممتازة'}`);
            
            // استخدام التخزين المؤقت للإحداثيات
            const p1 = fetchWithCache(`${API_BASE}/timings/${dateToApi(today)}?latitude=${lat}&longitude=${lon}&method=${CFG.calculation.method}&school=${CFG.calculation.school}&iso8601=true`, `pt_coords_today`);
            const p2 = fetchWithCache(`${API_BASE}/timings/${dateToApi(tomorrow)}?latitude=${lat}&longitude=${lon}&method=${CFG.calculation.method}&school=${CFG.calculation.school}&iso8601=true`, `pt_coords_tom`);
            const p3 = fetchWithCache(`${API_BASE}/timings/${dateToApi(today)}?latitude=${lat}&longitude=${lon}&method=3&school=${CFG.calculation.school}&iso8601=true`, `pt_coords_true`);
            
            const [td, td2, tdTrue] = await Promise.all([p1, p2, p3]);
            setText('cityDisplay', cityName); LS('qiblaBearing', String(bearing(lat, lon, KAABA.lat, KAABA.lon))); loadStoredQibla();
            renderTimes(td.timings, td2.timings, tdTrue.timings);
            qs('#locationControls').style.display = pos.coords.accuracy > 500 ? 'flex' : 'none';
        } else {
            throw new Error('Fallback to City');
        }
    } catch (e) {
        qs('#locationControls').style.display = 'flex'; setText('cityDisplay', c.label || c.city);
        if(!forceCity) { ptStatus.className = 'small location-error'; setText('ptStatus', 'تعذر تحديد الموقع، جاري عرض توقيت المدينة المحددة.'); }
        
        // استخدام التخزين المؤقت للمدن
        const u1 = `${API_BASE}/timingsByCity/${dateToApi(today)}?city=${encodeURIComponent(c.city)}&country=${encodeURIComponent(c.country)}&method=${CFG.calculation.method}&school=${CFG.calculation.school}&iso8601=true`;
        const u2 = `${API_BASE}/timingsByCity/${dateToApi(tomorrow)}?city=${encodeURIComponent(c.city)}&country=${encodeURIComponent(c.country)}&method=${CFG.calculation.method}&school=${CFG.calculation.school}&iso8601=true`;
        const u3 = `${API_BASE}/timingsByCity/${dateToApi(today)}?city=${encodeURIComponent(c.city)}&country=${encodeURIComponent(c.country)}&method=3&school=${CFG.calculation.school}&iso8601=true`;

        try {
            const [td, td2, tdTrue] = await Promise.all([fetchWithCache(u1, `pt_city_today_${c.city}`), fetchWithCache(u2, `pt_city_tom_${c.city}`), fetchWithCache(u3, `pt_city_true_${c.city}`)]);
            renderTimes(td.timings, td2.timings, tdTrue.timings);
        } catch(ex) { setText('ptStatus', 'لا يوجد اتصال بالإنترنت لتحديث المواقيت.'); }
    }
}

// --- البوصلة (محسنة) ---
function bearing(lat1, lon1, lat2, lon2) { const φ1 = toRad(lat1), φ2 = toRad(lat2), λ1 = toRad(lon1), λ2 = toRad(lon2); const y = Math.sin(λ2 - λ1) * Math.cos(φ2), x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1); return normalize360(toDeg(Math.atan2(y, x))); }
function loadStoredQibla() { const v = LS('qiblaBearing'); if (v) setText('qiblaDeg', `${parseFloat(v).toFixed(1)}°`) }
function setupCompass() {
    const needle = qs('#needle'), acc = qs('#compassAccuracy'); if (!needle) return; let ema = null;
    function delta(a, b) { return (b - a + 540) % 360 - 180 }
    function onOri(ev) {
        let heading = null;
        if (typeof ev.webkitCompassHeading === 'number' && ev.webkitCompassHeading >= 0) { heading = ev.webkitCompassHeading; if (typeof ev.webkitCompassAccuracy === 'number') acc.textContent = `دقة البوصلة: ±${Math.round(ev.webkitCompassAccuracy)}°`; }
        else if (typeof ev.alpha === 'number') { heading = 360 - ev.alpha; acc.textContent = 'دقة البوصلة: تقريبية'; }
        if (heading == null) return;
        const q = parseFloat(LS('qiblaBearing') || '0') || 0;
        if (ema == null) ema = heading;
        ema = normalize360(ema + delta(ema, heading) * 0.08); // معامل نعومة أفضل (0.08 بدلاً من 0.18)
        needle.style.transform = `translate(-50%,-100%) rotate(${normalize360(q - ema)}deg)`;
    }
    qs('#enableCompass')?.addEventListener('click', async () => { try { if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') { const p = await DeviceOrientationEvent.requestPermission(); if (p !== 'granted') return; } window.addEventListener('deviceorientation', onOri, true); setText('compassStatus', 'تم تفعيل البوصلة'); } catch (e) { setText('compassStatus', 'تعذّر تفعيل البوصلة'); } });
}

// --- التسبيح ---
function haptic(ms = 10) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }
function setupTasbeeh() {
    const select = qs('#tasbeehPhraseSelect'), current = qs('#currentTasbeeh'), countEl = qs('#tasbeehCount'), targetEl = qs('#tasbeehTarget'), btn = qs('#tasbeehBtn'), resetBtn = qs('#tasbeehReset'), nextBtn = qs('#tasbeehNext');
    if (!select) return; select.innerHTML = ''; TASBEEH_PHRASES.forEach((p, idx) => { const o = document.createElement('option'); o.value = String(idx); o.textContent = `${p.name} — ${p.target}`; select.appendChild(o); });
    let phraseIndex = parseInt(LS('tasbeehPhraseIndex') || '0', 10); if (isNaN(phraseIndex)) phraseIndex = 0; let count = parseInt(LS('tasbeehCount') || '0', 10); if (isNaN(count)) count = 0;
    function render() { const p = TASBEEH_PHRASES[phraseIndex]; select.value = String(phraseIndex); current.textContent = p.name; countEl.textContent = String(count); targetEl.textContent = `الهدف: ${p.target}`; }
    function save() { LS('tasbeehPhraseIndex', String(phraseIndex)); LS('tasbeehCount', String(count)); }
    select.addEventListener('change', () => { phraseIndex = parseInt(select.value, 10) || 0; count = 0; save(); render(); haptic(10); });
    btn.addEventListener('click', () => { const p = TASBEEH_PHRASES[phraseIndex]; count += 1; save(); render(); if (count === p.target) haptic([28, 35, 28]); else haptic(9); });
    resetBtn.addEventListener('click', () => { count = 0; save(); render(); haptic(15); });
    nextBtn.addEventListener('click', () => { phraseIndex = (phraseIndex + 1) % TASBEEH_PHRASES.length; count = 0; save(); render(); haptic([15, 18, 15]); }); render();
}

// --- الأذكار مع الانتقال التلقائي ---
function updateGlobalProgress(list, keyPrefix) {
    const bar = qs('#globalAdhkarProgress'); if (!bar) return; if (list.length === 0) { bar.style.width = '0%'; return; }
    const completed = list.filter((it, i) => { const rem = LS(`dhikr:${keyPrefix}:${i}:${dayKey()}`); return (typeof it.repeat === 'number') ? rem === '0' : true; }).length;
    bar.style.width = Math.round((completed / list.length) * 100) + '%';
}
function renderPager(container, list, keyPrefix) {
    if (!list) return; updateGlobalProgress(list, keyPrefix);
    let index = parseInt(LS(`pager:${keyPrefix}:index`) || '0', 10); if (isNaN(index) || index < 0 || index >= list.length) index = 0;
    const host = document.createElement('div'); host.className = 'pager-wrap'; const indexEl = document.createElement('div'); indexEl.className = 'pager-index';
    const card = document.createElement('div'); card.className = 'pager-card'; const controls = document.createElement('div'); controls.className = 'pager-controls';
    const prev = document.createElement('button'); prev.className = 'btn secondary'; prev.textContent = 'السابق'; const next = document.createElement('button'); next.className = 'btn'; next.textContent = 'التالي';
    controls.append(prev, next); host.append(indexEl, card, controls); container.appendChild(host);

    function update() {
        const it = list[index]; if (!it) return; const max = it.repeat; const numeric = typeof max === 'number'; const repeatedOnce = numeric && max === 1;
        const k = `dhikr:${keyPrefix}:${index}:${dayKey()}`; let rem = LS(k); rem = rem == null ? (numeric ? max : 0) : parseInt(rem, 10); if (!numeric) rem = 0;
        indexEl.textContent = `${index + 1} / ${list.length}`;
        const displayText = showTashkeel ? it.text : (it.text || '').replace(/[\u064B-\u065F\u0640]/g, '');
        card.className = rem === 0 ? 'pager-card dhikr-completed-anim' : 'pager-card'; // أنيميشن عند الانتهاء
        
        card.innerHTML = `<p class="dhikr-text">${displayText}</p><div class="pager-meta"><span>المصدر: ${it.source || '—'}</span>${it.when ? `<span class="when-chip">${it.when}</span>` : ''}</div>${numeric && !repeatedOnce ? '<div class="progress"><div style="width:' + (numeric && max > 0 ? Math.round(((max - rem) / max) * 100) : 0) + '%"></div></div>' : ''}<div class="actions"><div class="left"><button class="btn secondary tiny copy">نسخ</button></div>${repeatedOnce ? '' : `<button class="btn ${numeric ? '' : 'secondary'} repeat-square ${numeric && rem === 0 ? 'done' : ''} do">${numeric ? (rem === 0 ? 'تم' : String(rem)) : String(max)}</button>`}</div>`;
        card.querySelector('.copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(displayText); haptic(8); } catch (e) { } });
        
        const btn = card.querySelector('.do'); const bar = card.querySelector('.progress>div');
        if (btn && numeric) {
            btn.addEventListener('click', () => {
                if (rem <= 0) return; rem -= 1; LS(k, String(rem));
                if (bar) bar.style.width = Math.round(((max - rem) / max) * 100) + '%';
                btn.textContent = rem === 0 ? 'تم' : String(rem); btn.classList.toggle('done', rem === 0); haptic(rem === 0 ? [20, 28, 20] : 8);
                updateGlobalProgress(list, keyPrefix);
                
                if (rem === 0) {
                    card.classList.add('dhikr-completed-anim');
                    // ميزة الانتقال التلقائي الذكي
                    if(autoNextDhikr && index < list.length - 1) setTimeout(() => { index += 1; update(); }, 600);
                }
            });
        }
        prev.disabled = index === 0; next.disabled = index === list.length - 1; LS(`pager:${keyPrefix}:index`, String(index));
    }
    prev.addEventListener('click', () => { if (index > 0) { index -= 1; update(); haptic(8); } }); next.addEventListener('click', () => { if (index < list.length - 1) { index += 1; update(); haptic(8); } });
    update();
}
function renderDhikrList(container, list, keyPrefix) { container.innerHTML = ''; renderPager(container, list, keyPrefix); }
async function loadAdhkar() {
    rawAdhkarData = await fetchJSON('./data/adhkar.json', { "morning": [], "evening": [], "sleep": [], "wakeup": [], "afterPrayer": [], "home": [], "mosque": [], "daily": [] });
    const tabs = [{ key: 'morning', label: 'الصباح' }, { key: 'evening', label: 'المساء' }, { key: 'sleep', label: 'النوم' }, { key: 'wakeup', label: 'الاستيقاظ' }, { key: 'afterPrayer', label: 'بعد الصلاة' }, { key: 'home', label: 'المنزل' }, { key: 'mosque', label: 'المسجد' }, { key: 'daily', label: 'متفرقة' }];
    const pills = qs('#adhkarPills'), container = qs('#adhkarContainer'); if (!pills || !container) return;
    function activate(key) { qsa('#adhkarPills button').forEach(b => b.classList.toggle('active', b.dataset.key === key)); renderDhikrList(container, rawAdhkarData[key] || [], key); }
    pills.innerHTML = ''; tabs.forEach(t => { const b = document.createElement('button'); b.textContent = t.label; b.dataset.key = t.key; b.addEventListener('click', () => activate(t.key)); pills.appendChild(b); }); activate('morning');
}

// --- الموارد الإضافية (مبسطة ونظيفة) ---
async function loadDailyBenefit() { try { const benefits = await fetchJSON('./data/benefits.json', ["من لزم الاستغفار جعل الله له من كل هم فرجاً."]); const todayBenefit = benefits[Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000) % benefits.length]; const c = qs('#dailyBenefitContent'); if (c) c.textContent = todayBenefit; } catch (e) { } }
async function loadResources() { const data = await fetchJSON('./data/resources.json', { useful: [] }); const host = qs('#usefulLinks'); if (!host) return; host.innerHTML = ''; (data.useful || []).forEach(g => { const sec = document.createElement('div'); sec.className = 'pager-card'; sec.innerHTML = `<h3 class="section-title">${g.group}</h3><ul class="custom-list">${(g.items || []).map(it => `<li><a href="${it.url}" target="_blank" rel="noopener">${it.title}</a> <span class="small" style="display:block; margin-top:4px;">${it.desc || ''}</span></li>`).join('')}</ul>`; host.appendChild(sec); }); }
async function loadLearning() { const data = await fetchJSON('./data/learning.json', { plan: [], collections: [], reminders: [] }); const plan = qs('#learnPlan'), col = qs('#learnCollections'), rem = qs('#learnReminders'); if (plan) { plan.innerHTML = ''; (data.plan || []).forEach(it => { const d = document.createElement('div'); d.className = 'pager-card'; d.innerHTML = `<b style="font-size:1.4rem; color:var(--accent); display:block; margin-bottom:8px;">${it.title}</b><div style="font-size:1.3rem; line-height:1.8;">${it.tip}</div>`; plan.appendChild(d); }); } if (col) { col.innerHTML = ''; (data.collections || []).forEach(it => { const li = document.createElement('li'); li.innerHTML = `<a href="${it.url}" target="_blank" rel="noopener">${it.title}</a>`; col.appendChild(li); }); } if (rem) { rem.innerHTML = ''; (data.reminders || []).forEach(t => { const li = document.createElement('li'); li.textContent = t; rem.appendChild(li); }); } }

// --- التهيئة والتحديث ---
function initCityList() {
    const sel = qs('#citySelect'); if (!sel) return;
    [{ label: 'الرياض', city: 'Riyadh', country: 'SA' }, { label: 'مكة المكرمة', city: 'Makkah', country: 'SA' }, { label: 'المدينة المنورة', city: 'Al Madinah al Munawwarah', country: 'SA' }, { label: 'جدة', city: 'Jeddah', country: 'SA' }, { label: 'الدمام', city: 'Dammam', country: 'SA' }].forEach(c => { const o = document.createElement('option'); o.value = JSON.stringify(c); o.textContent = c.label; sel.appendChild(o); });
    const saved = LS('cityFallback'); if (saved) sel.value = saved;
    sel.addEventListener('change', () => { LS('cityFallback', sel.value); loadPrayerTimes(true); });
}

async function registerSW() { if ('serviceWorker' in navigator) { const reg = await navigator.serviceWorker.register('./service-worker.js', { scope: './' }); reg.addEventListener('updatefound', () => { const sw = reg.installing; sw?.addEventListener('statechange', () => { if (sw.state === 'installed' && navigator.serviceWorker.controller) { qs('#updateBar').style.display = 'flex'; qs('#updateNow').onclick = () => sw.postMessage({ type: 'SKIP_WAITING' }); qs('#updateLater').onclick = () => qs('#updateBar').style.display = 'none'; } }); }); navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true }); } }

async function init() {
    CFG = await fetchJSON('./assets/js/config.json', { calculation: { method: 4, school: 0 }, duha: { startOffsetAfterSunriseMin: 15, endOffsetBeforeDhuhrMin: 10 }, defaultCity: { label: 'مكة المكرمة', city: 'Makkah', country: 'SA' } });
    initScheme(); initUI(); initNav(); initCityList(); renderHijri(); loadStoredQibla(); setupCompass(); setupTasbeeh();
    qs('#useLocation')?.addEventListener('click', () => loadPrayerTimes(false));
    await loadPrayerTimes(false); await registerSW();
}
window.addEventListener('load', init);
