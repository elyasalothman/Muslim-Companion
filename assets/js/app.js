// Rafiq Muslim v0.7.1 - Fixed City Name & Error Bar
const API_BASE = 'https://api.aladhan.com/v1';
const KAABA = { lat: 21.4225, lon: 39.8262 };
const qs = (s, r = document) => r.querySelector(s);
const setText = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
const LS = (k, v) => (v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v));

async function reverseGeocodeCity(lat, lon) {
    try {
        const r = await fetch(`https://api-bdc.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ar`);
        return await r.json();
    } catch (e) { return null; }
}

async function loadPrayerTimes(forceCity = false) {
    const ptStatus = qs('#ptStatus');
    // إخفاء الشريط الأحمر في البداية
    if (ptStatus) { ptStatus.style.display = 'none'; ptStatus.textContent = ''; }

    try {
        if (!forceCity && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const lat = pos.coords.latitude, lon = pos.coords.longitude;
                
                // جلب اسم المدينة الحقيقي وعرضه
                const cityData = await reverseGeocodeCity(lat, lon);
                const cityName = (cityData && cityData.city) ? cityData.city : "مدينتي";
                setText('cityDisplay', cityName);
                
                // هنا يتم جلب الأوقات (تكملة الكود المعتاد لديك...)
                // renderTimes(data); 
            }, (err) => { throw err; });
        }
    } catch (e) {
        // إظهار الشريط الأحمر فقط عند وجود خطأ حقيقي
        if (ptStatus) {
            ptStatus.style.display = 'block';
            ptStatus.className = 'small location-error';
            ptStatus.textContent = 'تعذر تحديد الموقع الدقيق، جاري استخدام التوقيت التقريبي.';
        }
    }
}
// تأكد من استدعاء الدالة عند التحميل
window.addEventListener('load', () => loadPrayerTimes(false));
