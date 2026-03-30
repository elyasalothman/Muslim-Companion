// Rafiq Muslim - Master Build v1.1.0
const API_BASE = 'https://api.aladhan.com/v1';

const setUI = (id, text) => { 
    const el = document.getElementById(id); 
    if (el) el.innerHTML = text; 
};

// --- 1. جلب البيانات من ملفات JSON ---
async function loadAppData() {
    try {
        // الفائدة اليومية
        const bRes = await fetch('./assets/data/benefits.json');
        const benefits = await bRes.json();
        setUI('dailyBenefitContent', benefits[Math.floor(Math.random() * benefits.length)]);

        // الخطط التعليمية
        const lRes = await fetch('./assets/data/learning.json');
        const learning = await lRes.json();
        setUI('learnPlan', learning.plan.map(p => `
            <div class="card inner-card" style="margin-bottom:10px">
                <div style="font-weight:bold; color:var(--accent)">${p.title}</div>
                <div class="small">${p.tip}</div>
            </div>`).join(''));
        setUI('learnCollections', learning.collections.map(c => `<li><a href="${c.url}" target="_blank">${c.title}</a></li>`).join(''));
        setUI('learnReminders', learning.reminders.map(r => `<li>${r}</li>`).join(''));

        // الروابط المفيدة
        const rRes = await fetch('./assets/data/resources.json');
        const resources = await rRes.json();
        setUI('usefulLinks', resources.useful.map(g => `
            <h4 class="small" style="color:var(--muted); margin-top:15px">${g.group}</h4>
            <ul class="custom-list">${g.items.map(i => `<li><a href="${i.url}" target="_blank">${i.title}</a> - ${i.desc}</li>`).join('')}</ul>
        `).join(''));

        initAdhkar();
    } catch (e) { console.error("فشل في تحميل ملفات البيانات:", e); }
}

// --- 2. نظام الأذكار وتتبع التقدم ---
async function initAdhkar() {
    try {
        const res = await fetch('./assets/data/adhkar.json');
        const data = await res.json();
        const pills = document.getElementById('adhkarPills');
        const cats = { morning: "الصباح", evening: "المساء", sleep: "النوم", afterPrayer: "بعد الصلاة", daily: "عامة" };

        pills.innerHTML = Object.keys(cats).map(key => 
            `<button onclick="renderAdhkar('${key}')">${cats[key]}</button>`
        ).join('');

        window.renderAdhkar = (key) => {
            const container = document.getElementById('adhkarContainer');
            container.innerHTML = data[key].map((item, i) => `
                <div class="card inner-card" style="margin-bottom:15px">
                    <p style="font-size:1.4rem; line-height:1.6">${item.text}</p>
                    <div class="pager-meta"><span>المصدر: ${item.source}</span></div>
                    <button class="repeat-square" id="dkr-${key}-${i}" onclick="doCount('${key}-${i}', ${item.repeat})">${item.repeat}</button>
                </div>
            `).join('');
            // تحديث حالة الأزرار النشطة
            Array.from(pills.children).forEach(b => b.classList.toggle('active', b.textContent === cats[key]));
        };
        renderAdhkar('morning');
    } catch (e) { console.error("خطأ في الأذكار:", e); }
}

window.doCount = (id, max) => {
    const btn = document.getElementById(`dkr-${id}`);
    let c = parseInt(btn.textContent);
    if (c > 0) {
        btn.textContent = c - 1;
        if (c - 1 === 0) { btn.classList.add('done'); btn.textContent = "✓"; }
    }
};

// --- 3. أوقات الصلاة والعد التنازلي ---
async function initLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude: lat, longitude: lon } = pos.coords;
            // استخدام الإعدادات من config.json
            const res = await fetch(`${API_BASE}/timings?latitude=${lat, lon}&method=4`);
            const data = await res.json();
            if (data.code === 200) populatePrayers(data.data);
        }, () => populatePrayersWithDefaults());
    }
}

function populatePrayers(data) {
    const t = data.timings;
    // تعبئة الجدول بالكامل واختفاء الـ —
    setUI('t_fajr_s', t.Fajr); setUI('t_fajr_e', t.Sunrise);
    setUI('t_duha_s', t.Sunrise); setUI('t_duha_e', t.Dhuhr); // تقريبي
    setUI('t_dhuhr_s', t.Dhuhr); setUI('t_dhuhr_e', t.Asr);
    setUI('t_asr_s', t.Asr); setUI('t_asr_e', t.Maghrib);
    setUI('t_maghrib_s', t.Maghrib); setUI('t_maghrib_e', t.Isha);
    setUI('t_isha_s', t.Isha); setUI('t_isha_true_s', t.Isha); setUI('t_isha_e', t.Fajr);
    setUI('t_lastthird_s', t.Lastthird);
    
    setUI('hijri', `${data.date.hijri.day} ${data.date.hijri.month.ar} ${data.date.hijri.year}`);
    setUI('cityDisplay', "الرياض");

    startTimer(t);
}

function startTimer(timings) {
    const list = [
        { n: "الفجر", t: timings.Fajr }, { n: "الظهر", t: timings.Dhuhr },
        { n: "العصر", t: timings.Asr }, { n: "المغرب", t: timings.Maghrib }, { n: "العشاء", t: timings.Isha }
    ];

    setInterval(() => {
        const now = new Date();
        let next = null;
        for (let p of list) {
            const [h, m] = p.t.split(':');
            const d = new Date(); d.setHours(h, m, 0);
            if (d > now) { next = { ...p, obj: d }; break; }
        }
        if (!next) {
            const [h, m] = list[0].t.split(':');
            const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, m, 0);
            next = { ...list[0], obj: d };
        }
        setUI('nextPrayerName', next.n); setUI('nextPrayerTime', next.t);
        const diff = next.obj - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setUI('nextCountdown', `${h}:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`);
    }, 1000);
}

window.onload = () => { loadAppData(); initLocation(); };
