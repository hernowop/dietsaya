/**
 * DietSaya - Main Application Controller
 * Mengatur navigasi tab, state sinkronisasi data, modal, dan notifikasi toast.
 */

const App = (() => {
  let activeTab = 'dashboard';

  /**
   * Inisialisasi saat aplikasi pertama kali dimuat
   */
  function init() {
    // Inisialisasi sub-modul
    FoodModule.init();
    WeightModule.init();
    AuthModule.init();

    // Event listener quick sync
    const syncBtn = document.getElementById('btn-quick-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        showLoading("Menyinkronkan data...");
        await refreshAllData();
        hideLoading();
        showToast("Data berhasil diperbarui.", "success");
      });
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
    }
  }

  /**
   * Inisialisasi data aplikasi setelah login berhasil
   */
  function initAppData(initData) {
    if (!initData) return;

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
    const res = await Api.request('getDashboardData', {}, 'GET');
    if (res.success && res.data) {
      if (res.data.dashboard) DashboardModule.render(res.data.dashboard);
      if (res.data.foodLogs) FoodModule.setFoodLogs(res.data.foodLogs);
      if (res.data.weightLogs) WeightModule.setWeightLogs(res.data.weightLogs);
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
    if (type === "error") icon = "⚠️";

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
