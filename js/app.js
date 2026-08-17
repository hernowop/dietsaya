/**
 * DietSaya - Main Application Controller
 * Mengatur navigasi tab, state sinkronisasi data realtime, modal, dan notifikasi toast.
 */

const App = (() => {
  let activeTab = 'dashboard';
  let isSyncing = false;

  /**
   * Inisialisasi saat aplikasi pertama kali dimuat
   */
  function init() {
    // Inisialisasi Tema (Dark/Light Mode)
    initTheme();

    // Restore saved spreadsheet URL if available
    const savedSheetUrl = localStorage.getItem('diet_spreadsheet_url');
    if (savedSheetUrl && !savedSheetUrl.includes('drive.google.com/drive')) {
      updateSpreadsheetLink(savedSheetUrl);
    }

    // Inisialisasi sub-modul
    FoodModule.init();
    WeightModule.init();
    AuthModule.init();

    // Event listener quick sync
    const syncBtn = document.getElementById('btn-quick-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        triggerHaptic(40);
        showLoading("Menyinkronkan data...");
        const success = await refreshAllData();
        hideLoading();
        if (success) {
          showToast("Data berhasil diperbarui dari Google Sheets.", "success");
        } else {
          showToast(lastSyncError || "Gagal memperbarui data. Periksa koneksi atau URL Apps Script.", "error");
        }
      });
    }

    // Auto-refresh saat user kembali ke tab/aplikasi (visibility change)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && AuthModule.getUser()) {
        refreshAllData(true).catch(e => console.log('Silent sync:', e));
      }
    });
  }

  /**
   * Sistem Dark / Light Theme
   */
  function initTheme() {
    const savedTheme = localStorage.getItem('dietsaya_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const activeTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(activeTheme);
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      const moonIcon = document.getElementById('theme-icon-moon');
      const sunIcon = document.getElementById('theme-icon-sun');
      if (moonIcon) moonIcon.classList.add('hidden');
      if (sunIcon) sunIcon.classList.remove('hidden');
    } else {
      document.documentElement.removeAttribute('data-theme');
      const moonIcon = document.getElementById('theme-icon-moon');
      const sunIcon = document.getElementById('theme-icon-sun');
      if (moonIcon) moonIcon.classList.remove('hidden');
      if (sunIcon) sunIcon.classList.add('hidden');
    }

    // Refresh chart theme colors jika chart sedang aktif
    if (typeof DashboardModule !== 'undefined' && DashboardModule.renderCalorieTrendChart) {
      setTimeout(() => DashboardModule.renderCalorieTrendChart(), 50);
    }
  }

  function toggleTheme() {
    triggerHaptic(30);
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('dietsaya_theme', newTheme);
  }

  function triggerHaptic(duration = 40) {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(duration);
      }
    } catch (e) {}
  }

  function updateSpreadsheetLink(url) {
    if (!url) return;
    localStorage.setItem('diet_spreadsheet_url', url);
    const btn = document.getElementById('btn-open-spreadsheet');
    if (btn) {
      btn.href = url;
    }
  }

  async function openSpreadsheet(e) {
    if (e && e.preventDefault) e.preventDefault();

    let url = localStorage.getItem('diet_spreadsheet_url');
    if (!url || url.includes('drive.google.com/drive')) {
      showLoading("Membuka database Google Sheets...");
      const res = await Api.request('getSpreadsheetUrl', {}, 'POST');
      hideLoading();
      if (res.success && res.data && res.data.spreadsheetUrl) {
        url = res.data.spreadsheetUrl;
        updateSpreadsheetLink(url);
      }
    }

    if (url) {
      window.open(url, '_blank');
    } else {
      showToast("Gagal mengambil link langsung Google Sheets.", "error");
    }
  }

  /**
   * Router Navigasi Halaman / Tab
   */
  function navigate(tabName) {
    activeTab = tabName;

    // Sembunyikan semua views
    const views = document.querySelectorAll('.app-view');
    views.forEach(v => v.classList.remove('active'));

    // Aktifkan view yang dipilih
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) {
      targetView.classList.add('active');
    }

    // Update active class pada bottom navigation
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => {
      if (item.dataset.target === tabName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Scroll ke atas
    window.scrollTo({ top: 0, behavior: 'smooth' });
    triggerHaptic(25);

    // Refresh sub-tampilan jika diperlukan
    if (tabName === 'riwayat') {
      FoodModule.filterHistoryByDate();
    } else if (tabName === 'makan') {
      if (typeof FoodModule !== 'undefined' && FoodModule.renderSmartPresets) {
        FoodModule.renderSmartPresets();
      }
    } else if (tabName === 'dashboard') {
      refreshAllData().catch(e => console.log('Dashboard tab sync:', e));
    }
  }

  /**
   * Inisialisasi data aplikasi setelah login berhasil
   */
  function initAppData(initData) {
    if (!initData) return;

    try {
      localStorage.setItem('dietsaya_cached_data', JSON.stringify(initData));
    } catch (e) {}

    if (initData.spreadsheetUrl) {
      updateSpreadsheetLink(initData.spreadsheetUrl);
    }
    if (initData.dashboard) {
      DashboardModule.render(initData.dashboard);
    }
    if (initData.foodLogs) {
      FoodModule.setFoodLogs(initData.foodLogs);
    }
    if (initData.weightLogs) {
      WeightModule.setWeightLogs(initData.weightLogs);
    }

    navigate('dashboard');
  }

  let lastSyncError = '';

  /**
   * Memuat ulang seluruh data dari Google Apps Script
   */
  async function refreshAllData() {
    if (isSyncing) return false;
    isSyncing = true;
    lastSyncError = '';

    try {
      const res = await Api.request('getDashboardData', {}, 'POST');
      if (res.success && res.data) {
        try {
          localStorage.setItem('dietsaya_cached_data', JSON.stringify(res.data));
        } catch (e) {}

        if (res.data.spreadsheetUrl) {
          updateSpreadsheetLink(res.data.spreadsheetUrl);
        }
        if (res.data.dashboard) {
          DashboardModule.render(res.data.dashboard);
        }
        if (res.data.foodLogs) {
          FoodModule.setFoodLogs(res.data.foodLogs);
        }
        if (res.data.weightLogs) {
          WeightModule.setWeightLogs(res.data.weightLogs);
        }
        return true;
      } else {
        lastSyncError = res.message || 'Gagal terhubung ke Google Apps Script.';
        console.warn('[Sync Warning]:', res.message);
        return false;
      }
    } catch (err) {
      lastSyncError = err.message || 'Terjadi kesalahan saat memuat data.';
      console.error('[RefreshAllData Error]:', err);
      return false;
    } finally {
      isSyncing = false;
    }
  }

  /**
   * Menyimpan target nutrisi pengguna
   */
  async function handleSaveSettings(e) {
    e.preventDefault();
    const settings = {
      calorie_target: parseInt(document.getElementById('set-cal-target').value) || 2000,
      protein_target: parseInt(document.getElementById('set-pro-target').value) || 120,
      carbs_target: parseInt(document.getElementById('set-carbs-target').value) || 250,
      fat_target: parseInt(document.getElementById('set-fat-target').value) || 65
    };

    showLoading("Menyimpan preferensi...");
    const res = await Api.request('updateSettings', { settings });
    hideLoading();

    if (res.success) {
      showToast("Target nutrisi berhasil diperbarui!", "success");
      triggerHaptic(50);
      await refreshAllData();
    } else {
      showToast(res.message || "Gagal menyimpan target nutrisi.", "error");
    }
  }

  /**
   * UI Helpers: Loading & Toast Notifications
   */
  function showLoading(message = "Memproses data...") {
    const overlay = document.getElementById('global-loading');
    const text = document.getElementById('loading-text');
    if (overlay && text) {
      text.textContent = message;
      overlay.classList.remove('hidden');
    }
  }

  function hideLoading() {
    const overlay = document.getElementById('global-loading');
    if (overlay) overlay.classList.add('hidden');
  }

  function showToast(message, type = "info") {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "❌";

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  return {
    init,
    navigate,
    initAppData,
    refreshAllData,
    updateSpreadsheetLink,
    openSpreadsheet,
    handleSaveSettings,
    showLoading,
    hideLoading,
    showToast,
    toggleTheme,
    triggerHaptic
  };
})();

// Jalankan init saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
