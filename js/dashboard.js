/**
 * DietSaya - Dashboard Module
 * Mengelola kalkulasi ringkasan harian, persentase nutrisi, daftar makanan hari ini,
 * dan kartu Saran AI Nutrition Coach (Live & Real-time Update).
 */

const DashboardModule = (() => {
  let dashboardData = {
    dateStr: '',
    settings: {
      calorie_target: 2000,
      protein_target: 120,
      carbs_target: 250,
      fat_target: 65
    },
    todayLogs: [],
    sevenDaysSummary: {
      avgCalories: 0,
      avgProtein: 0,
      lastWeight: null,
      weightChange: 0
    },
    latestAiAdvice: null
  };

  let cachedAiAdvice = null;

  /**
   * Format tanggal ke Bahasa Indonesia (Contoh: Sabtu, 15 Agustus 2026)
   */
  function formatIndonesianDate(dateObj = new Date()) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return dateObj.toLocaleDateString('id-ID', options);
  }

  /**
   * Set saran AI terkini (misal dari respons saveFood)
   */
  function setAiAdvice(advice) {
    if (advice) {
      cachedAiAdvice = advice;
      try {
        localStorage.setItem('dietsaya_latest_ai_advice', JSON.stringify(advice));
      } catch (e) {}
    }
  }

  /**
   * Mengambil saran AI tersimpan (jika ada)
   */
  function getCachedAiAdvice() {
    if (cachedAiAdvice) return cachedAiAdvice;
    try {
      const stored = localStorage.getItem('dietsaya_latest_ai_advice');
      if (stored) {
        cachedAiAdvice = JSON.parse(stored);
        return cachedAiAdvice;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Perbarui tampilan seluruh dashboard
   */
  function render(data) {
    if (data) {
      dashboardData = { ...dashboardData, ...data };
      if (data.latestAiAdvice) {
        setAiAdvice(data.latestAiAdvice);
      }
    }

    // Set Tanggal Hari Ini
    const today = new Date();
    const dateEl = document.getElementById('dashboard-date');
    if (dateEl) dateEl.textContent = formatIndonesianDate(today);

    const settings = dashboardData.settings || {
      calorie_target: 2000,
      protein_target: 120,
      carbs_target: 250,
      fat_target: 65
    };

    // Hitung total makanan hari ini
    const logs = dashboardData.todayLogs || [];
    let totCal = 0;
    let totPro = 0;
    let totCarbs = 0;
    let totFat = 0;

    logs.forEach(item => {
      totCal += Number(item.calories || 0);
      totPro += Number(item.protein || 0);
      totCarbs += Number(item.carbs || 0);
      totFat += Number(item.fat || 0);
    });

    const targetCal = Number(settings.calorie_target || 2000);
    const remainingCal = Math.max(0, targetCal - totCal);
    const calPercent = Math.min(100, Math.round((totCal / targetCal) * 100));

    // Update Hero Calorie Card
    const targetCalEl = document.getElementById('hero-target-cal');
    const consumedCalEl = document.getElementById('hero-consumed-cal');
    if (targetCalEl) targetCalEl.textContent = targetCal.toLocaleString('id-ID');
    if (consumedCalEl) consumedCalEl.textContent = totCal.toLocaleString('id-ID');
    
    const remEl = document.getElementById('hero-remaining-cal');
    if (remEl) {
      if (totCal > targetCal) {
        remEl.className = 'text-danger';
        remEl.textContent = `Lebih +${(totCal - targetCal).toLocaleString('id-ID')}`;
      } else {
        remEl.className = 'text-success';
        remEl.textContent = remainingCal.toLocaleString('id-ID');
      }
    }

    const percentTextEl = document.getElementById('hero-percent-text');
    const radialEl = document.getElementById('hero-radial-progress');
    const barEl = document.getElementById('hero-cal-bar');

    if (percentTextEl) percentTextEl.textContent = `${calPercent}%`;
    if (radialEl) radialEl.style.setProperty('--percent', `${calPercent}%`);
    if (barEl) barEl.style.width = `${calPercent}%`;

    // Update Macros
    updateMacroUI('protein', totPro, Number(settings.protein_target || 120));
    updateMacroUI('carbs', totCarbs, Number(settings.carbs_target || 250));
    updateMacroUI('fat', totFat, Number(settings.fat_target || 65));

    // Render Kartu AI Nutrition Coach
    renderAiCard(logs, totCal, totPro, totCarbs, totFat, targetCal, Number(settings.protein_target || 120));

    // Update 7-Day Stats
    const s7 = dashboardData.sevenDaysSummary || {};
    const avgCalEl = document.getElementById('stat-7d-avg-cal');
    const avgProEl = document.getElementById('stat-7d-avg-pro');
    const lastWeightEl = document.getElementById('stat-7d-last-weight');
    const changeWeightEl = document.getElementById('stat-7d-change-weight');

    if (avgCalEl) avgCalEl.textContent = `${Math.round(s7.avgCalories || 0)} kkal`;
    if (avgProEl) avgProEl.textContent = `${Math.round(s7.avgProtein || 0)} g`;
    if (lastWeightEl) lastWeightEl.textContent = s7.lastWeight ? `${s7.lastWeight} kg` : '- kg';
    
    const change = Number(s7.weightChange || 0);
    const sign = change > 0 ? `+${change.toFixed(1)}` : `${change.toFixed(1)}`;
    if (changeWeightEl) changeWeightEl.textContent = s7.lastWeight ? `${sign} kg` : '-';

    // Update Today's Food List
    renderTodayFoodList(logs);
  }

  /**
   * Render Tampilan Kartu AI Coach (Santai, Hangat & Penuh Perhatian)
   */
  function renderAiCard(logs, totCal, totPro, totCarbs, totFat, targetCal, targetPro) {
    const cardEl = document.getElementById('dashboard-ai-card');
    if (!cardEl) return;

    const badgeEl = document.getElementById('ai-coach-badge');
    const commentEl = document.getElementById('ai-coach-comment');
    const nextMealEl = document.getElementById('ai-coach-next-meal');
    const tipEl = document.getElementById('ai-coach-tip');

    const advice = getCachedAiAdvice();

    // Jika ada respons saran AI langsung dari server Gemini
    if (advice && logs.length > 0) {
      if (badgeEl) {
        badgeEl.textContent = advice.statusBadge || '✨ On Track Semangat!';
        badgeEl.className = 'badge-status ' + (advice.statusType ? `badge-${advice.statusType}` : 'badge-success');
      }
      if (commentEl) commentEl.textContent = `"${advice.komentar || 'Tetap semangat menjaga pola makan sehat ya sayang! 🥰'}"`;
      if (nextMealEl) nextMealEl.textContent = advice.saranMenuBerikutnya || 'Pilih makanan kaya serat dan protein untuk jam makan berikutnya.';
      if (tipEl) tipEl.textContent = advice.tipsPerhatian || 'Jangan lupa cukupi air putih minimal 2 liter dan selalu tersenyum bahagia hari ini! 💕';
      return;
    }

    // Generator AI Lokal Cerdas & Penuh Perhatian (Jika tanpa koneksi / baru mulai)
    const remainingCal = targetCal - totCal;
    const nowHour = new Date().getHours();

    let badge = '✨ On Track Semangat!';
    let badgeType = 'success';
    let comment = '';
    let nextMeal = '';
    let tip = 'Jangan lupa cukupi air putih minimal 2 liter dan selalu bahagia hari ini! 💕';

    if (logs.length === 0) {
      badge = '🌅 Awali Harimu!';
      badgeType = 'info';
      if (nowHour < 11) {
        comment = 'Selamat pagi sayang! Belum ada makanan yang dicatat nih. Yuk awali harimu dengan sarapan bergizi kaya protein & serat biar tetap berenergi dan bugar seharian! 🥰';
        nextMeal = 'Ide sarapan: Telur rebus/dadar + roti gandum atau oatmeal buah pisang/berry segar.';
        tip = 'Segelas air putih hangat di pagi hari sangat bagus untuk metabolisme tubuh!';
      } else if (nowHour < 16) {
        comment = 'Selamat siang cintaa! Belum ada catatan makan hari ini. Jangan sampai telat makan siang yaa, tubuh butuh asupan nutrisi seimbang! 💕';
        nextMeal = 'Ide makan siang: Nasi secukupnya + ayam/ikan bakar + sayur bening bayam atau tumis brokoli.';
        tip = 'Makan perlahan dan nikmati setiap suapan agar pencernaan lebih nyaman dan kenyang optimal.';
      } else {
        comment = 'Halo sayang! Belum ada catatan makan hari ini nih. Yuk catat makananmu agar progres nutrisi tetap terpantau dengan rapi dan teratur! 💖';
        nextMeal = 'Pilih menu makan malam yang ringan dan nyaman di perut seperti sup tahu sayuran atau salad segar.';
        tip = 'Usahakan tidak makan porsi berat terlalu dekat dengan waktu tidur yaa.';
      }
    } else {
      const lastFood = logs[0];
      const lastFoodName = lastFood.food_name || 'makananmu';

      if (totCal > targetCal) {
        badge = '⚠️ Target Kalori Tercapai';
        badgeType = 'warning';
        comment = `Hari ini asupan sudah mencapai ${totCal.toLocaleString('id-ID')} kkal (target ${targetCal.toLocaleString('id-ID')} kkal). Kamu hebat dan jujur banget selalu mencatatnya sayang! Jangan khawatir, tetap rileks dan santai yaa 💪`;
        nextMeal = 'Untuk waktu berikutnya, cukup minum air mineral dingin / infused water lemon segar atau teh chamomile tanpa gula.';
        tip = 'Bisa luangkan waktu 15-20 menit jalan santai malam ini untuk bantu relaksasi dan pencernaan 🥰';
      } else if (remainingCal <= 350) {
        badge = '🔥 Kuota Pas Mantap!';
        badgeType = 'success';
        comment = `Pencatatan "${lastFoodName}" sangat pas! Total asupan sekarang ${totCal.toLocaleString('id-ID')} kkal, sisa kuota tinggal ${remainingCal.toLocaleString('id-ID')} kkal. Kamu konsisten dan keren banget sayang! ✨`;
        if (totPro < targetPro * 0.7) {
          nextMeal = `Asupan protein hari ini (${totPro}g) masih bisa ditambah sedikit. Pilihan pas: greek yogurt tawar, putih telur, atau segelas susu kedelai.`;
        } else {
          nextMeal = 'Target nutrisi hari ini sudah sangat seimbang! Cukup lengkapi dengan air putih atau sepotong buah segar.';
        }
        tip = 'Istirahat dan tidur cukup 7-8 jam sangat mendukung proses regenerasi dan pembakaran tubuh!';
      } else {
        badge = '✨ On Track & Seimbang';
        badgeType = 'success';
        comment = `Keren sayang! Menu "${lastFoodName}" (${lastFood.calories || 0} kkal) tersimpan rapi. Sisa kuota masih leluasa ${remainingCal.toLocaleString('id-ID')} kkal. Pola makanmu tertata rapi sekali! 🌸`;
        
        if (nowHour < 12) {
          nextMeal = 'Untuk makan siang nanti: karbohidrat kompleks (nasi/kentang), protein tinggi (ayam/ikan/telur), dan sayuran hijau segar.';
        } else if (nowHour < 17) {
          nextMeal = 'Untuk makan malam nanti: pas banget kalau pilih sup bening atau tumis sayur dengan tahu/tempe/daging rendah lemak.';
        } else {
          nextMeal = 'Masih ada kuota kalori yang cukup untuk dinikmati dengan makan malam lezat bernutrisi seimbang.';
        }
        tip = 'Pastikan asupan air putih sudah mencapai minimal 2 liter hari ini ya cintaa 🥰';
      }
    }

    if (badgeEl) {
      badgeEl.textContent = badge;
      badgeEl.className = 'badge-status badge-' + badgeType;
    }
    if (commentEl) commentEl.textContent = `"${comment}"`;
    if (nextMealEl) nextMealEl.textContent = nextMeal;
    if (tipEl) tipEl.textContent = tip;
  }

  function updateMacroUI(type, current, target) {
    const curEl = document.getElementById(`macro-${type}-cur`);
    const tarEl = document.getElementById(`macro-${type}-target`);
    const barEl = document.getElementById(`macro-${type}-bar`);

    if (curEl) curEl.textContent = Math.round(current);
    if (tarEl) tarEl.textContent = target;
    if (barEl) {
      const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
      barEl.style.width = `${pct}%`;
    }
  }

  function renderTodayFoodList(logs) {
    const container = document.getElementById('dashboard-food-list');
    const countEl = document.getElementById('today-item-count');
    if (countEl) countEl.textContent = logs.length;
    if (!container) return;

    if (!logs || logs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🥗</div>
          <p>Belum ada makanan yang dicatat hari ini.</p>
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('makan')">Catat Makanan Pertama</button>
        </div>
      `;
      return;
    }

    container.innerHTML = logs.map(item => `
      <div class="food-card" data-id="${item.id}">
        <div class="food-card-left">
          <div class="food-name">${escapeHtml(item.food_name)}</div>
          <div class="food-portion">${escapeHtml(item.portion || '')} • <span class="text-muted">${item.time || ''}</span></div>
          <div class="food-macros-tag">
            <span class="tag-p">P: ${item.protein || 0}g</span>
            <span class="tag-c">K: ${item.carbs || 0}g</span>
            <span class="tag-f">L: ${item.fat || 0}g</span>
          </div>
        </div>
        <div class="food-card-right">
          <div class="food-card-cal">
            <strong>${item.calories || 0}</strong>
            <small>kkal</small>
          </div>
          <div class="food-actions">
            <button class="icon-btn" title="Edit" onclick="FoodModule.openEditModal('${item.id}')">✏️</button>
            <button class="icon-btn" title="Hapus" onclick="FoodModule.deleteFoodItem('${item.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  /* ==========================================================
     WATER INTAKE TRACKER
     ========================================================== */
  let currentWaterMl = 0;
  const TARGET_WATER_ML = 2000;
  const GLASS_SIZE_ML = 250;

  function getTodayKey() {
    const d = new Date();
    return `dietsaya_water_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function initWaterTracker() {
    try {
      const key = getTodayKey();
      const saved = localStorage.getItem(key);
      currentWaterMl = saved ? parseInt(saved) || 0 : 0;
    } catch (e) {
      currentWaterMl = 0;
    }
    renderWaterTracker();
  }

  function renderWaterTracker() {
    const curMlEl = document.getElementById('water-current-ml');
    const targetMlEl = document.getElementById('water-target-ml');
    const glassesCountEl = document.getElementById('water-glasses-count');
    const glassesGrid = document.getElementById('water-glasses-grid');

    if (curMlEl) curMlEl.textContent = currentWaterMl;
    if (targetMlEl) targetMlEl.textContent = TARGET_WATER_ML;
    
    const filledGlasses = Math.min(8, Math.floor(currentWaterMl / GLASS_SIZE_ML));
    if (glassesCountEl) glassesCountEl.textContent = filledGlasses;

    if (glassesGrid) {
      const buttons = glassesGrid.querySelectorAll('.water-glass-btn');
      buttons.forEach((btn, index) => {
        const glassIndex = index + 1;
        if (glassIndex <= filledGlasses) {
          btn.classList.add('filled');
          btn.textContent = '💧';
        } else {
          btn.classList.remove('filled');
          btn.textContent = '🥛';
        }
      });
    }
  }

  function saveWaterTracker() {
    try {
      localStorage.setItem(getTodayKey(), currentWaterMl);
    } catch (e) {}
    renderWaterTracker();
  }

  function toggleWaterGlass(glassNumber) {
    if (typeof App !== 'undefined' && App.triggerHaptic) App.triggerHaptic(40);
    const targetMl = glassNumber * GLASS_SIZE_ML;
    if (currentWaterMl === targetMl) {
      currentWaterMl = (glassNumber - 1) * GLASS_SIZE_ML;
    } else {
      currentWaterMl = targetMl;
    }
    saveWaterTracker();
    checkWaterGoal();
  }

  function adjustWater(delta) {
    if (typeof App !== 'undefined' && App.triggerHaptic) App.triggerHaptic(40);
    currentWaterMl = Math.max(0, Math.min(4000, currentWaterMl + delta));
    saveWaterTracker();
    checkWaterGoal();
  }

  function checkWaterGoal() {
    if (currentWaterMl === TARGET_WATER_ML && typeof App !== 'undefined' && App.showToast) {
      App.showToast("🎉 Hebat! Target minum air 2000 ml hari ini tercapai!", "success");
      if (App.triggerHaptic) App.triggerHaptic(80);
    }
  }

  return {
    render,
    setAiAdvice,
    initWaterTracker,
    toggleWaterGlass,
    adjustWater,
    getData: () => dashboardData
  };
})();
