/**
 * DietSaya - Dashboard Module
 * Mengelola kalkulasi ringkasan harian, persentase nutrisi, dan daftar makanan hari ini.
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
    }
  };

  /**
   * Format tanggal ke Bahasa Indonesia (Contoh: Sabtu, 15 Agustus 2026)
   */
  function formatIndonesianDate(dateObj = new Date()) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return dateObj.toLocaleDateString('id-ID', options);
  }

  /**
   * Perbarui tampilan seluruh dashboard
   */
  function render(data) {
    if (data) {
      dashboardData = { ...dashboardData, ...data };
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

  return {
    render,
    getData: () => dashboardData
  };
})();
