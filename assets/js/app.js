document.addEventListener('DOMContentLoaded', () => {
    
    // 1. نظام التنقل بين الصفحات
    const navBtns = document.querySelectorAll('.bottom-nav button');
    const sections = document.querySelectorAll('.section');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // 2. جلب أوقات الصلاة والتاريخ
    fetch('https://api.aladhan.com/v1/timingsByCity?city=Riyadh&country=SA&method=4')
        .then(response => response.json())
        .then(data => {
            if(data.code === 200) {
                const timings = data.data.timings;
                document.getElementById('t_fajr').textContent = timings.Fajr;
                document.getElementById('t_dhuhr').textContent = timings.Dhuhr;
                document.getElementById('t_asr').textContent = timings.Asr;
                document.getElementById('t_maghrib').textContent = timings.Maghrib;
                document.getElementById('t_isha').textContent = timings.Isha;
                
                const hijri = data.data.date.hijri;
                document.getElementById('hijriDate').textContent = `${hijri.day} ${hijri.month.ar} ${hijri.year}`;
                
                localStorage.setItem('qibla', data.data.meta.qibla);
            }
        })
        .catch(error => {
            document.getElementById('hijriDate').textContent = "يوجد مشكلة بالاتصال";
        });

    // 3. المسبحة
    let tasbeehCount = localStorage.getItem('tasbeehScore') || 0;
    const countDisplay = document.getElementById('tasbeehCount');
    countDisplay.textContent = tasbeehCount;

    document.getElementById('tasbeehBtn').addEventListener('click', () => {
        tasbeehCount++;
        countDisplay.textContent = tasbeehCount;
        localStorage.setItem('tasbeehScore', tasbeehCount);
    });

    document.getElementById('tasbeehReset').addEventListener('click', () => {
        tasbeehCount = 0;
        countDisplay.textContent = tasbeehCount;
        localStorage.setItem('tasbeehScore', tasbeehCount);
    });

    // 4. البوصلة
    document.getElementById('enableCompass').addEventListener('click', () => {
        const qibla = localStorage.getItem('qibla') || 136; // زاوية الرياض الافتراضية
        document.getElementById('enableCompass').textContent = "البوصلة تعمل الآن";
        
        window.addEventListener('deviceorientation', (e) => {
            let heading = e.webkitCompassHeading || Math.abs(e.alpha - 360);
            if(heading) {
                document.getElementById('needle').style.transform = `translate(-50%, -100%) rotate(${qibla - heading}deg)`;
            }
        }, true);
    });
});
