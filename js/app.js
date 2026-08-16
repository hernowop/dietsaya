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
        showLoading("Menyinkronkan data...");
        const success = await refreshAllData();
        hideLoading();
        if (success) {
          showToast("Data berhasil diperbarui dari Google Sheets.", "success");
        } else {
          showToast("Gagal memperbarui data. Periksa koneksi internet.", "error");
        }
      });
    }

    // Auto-refresh saat user kembali ke tab/aplikasi (visibility change)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && AuthModule.getUser()) {
        console.log("Tab aktif kembali, menyinkronkan data...");
        refreshAllData().catch(e => console.log('Visibility sync:', e));
      }
    });
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

    // Refresh sub-tampilan jika diperlukan
    if (tabName === 'riwayat') {
      FoodModule.filterHistoryByDate();
    } else if (tabName === 'dashboard') {
      refreshAllData().catch(e => console.log('Dashboard tab sync:', e));
    }
  }

  /**
   * Inisialisasi data aplikasi setelah login berhasil
   */
  function initAppData(initData) {
    if (!initData) return;

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

  /**
   * Memuat ulang seluruh data dari Google Apps Script
   */
  async function refreshAllData() {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const res = await Api.request('getDashboardData', {}, 'POST');
      if (res.success && res.data) {
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
        console.warn('[Sync Warning]:', res.message);
        return false;
      }
    } catch (err) {
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
      calorie_target: Number(document.getElementById('target-calories').value),
      protein_target: Number(document.getElementById('target-protein').value),
      carbs_target: Number(document.getElementById('target-carbs').value),
      fat_target: Number(document.getElementById('target-fat').value)
    };

    showLoading("Menyimpan pengaturan target...");
    const res = await Api.request('updateSettings', { settings });
    hideLoading();

    if (res.success) {
      showToast("Target nutrisi berhasil diperbarui!", "success");
      await refreshAllData();
      navigate('dashboard');
    } else {
      showToast(res.message || "Gagal menyimpan target.", "error");
    }
  }

  /**
   * UI Helpers: Loading & Toast Notifications
   */
  function showLoading(text = "Memproses...") {
    const overlay = document.getElementById('global-loading');
    const label = document.getElementById('loading-text');
    if (label) label.textContent = text;
    if (overlay) overlay.classList.remove('hidden');
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
    showToast
  };
})();

// Jalankan init saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
