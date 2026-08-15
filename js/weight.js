/**
 * DietSaya - Weight Tracker Module
 * Menangani pencatatan berat badan, grafik fluktuasi berat badan (Chart.js), dan riwayat timbangan.
 */

const WeightModule = (() => {
  let weightLogs = [];
  let chartInstance = null;

  function init() {
    const today = new Date().toISOString().split('T')[0];
    const weightDateInput = document.getElementById('weight-input-date');
    if (weightDateInput) weightDateInput.value = today;
  }

  function setWeightLogs(logs) {
    weightLogs = logs || [];
    renderChart();
    renderLogsList();
  }

  async function handleSaveWeight(e) {
    e.preventDefault();
    const date = document.getElementById('weight-input-date').value;
    const weight = Number(document.getElementById('weight-input-val').value);
    const note = document.getElementById('weight-input-note').value;

    if (!date || !weight) {
      App.showToast("Tanggal dan berat badan wajib diisi.", "error");
      return;
    }

    App.showLoading("Menyimpan berat badan...");

    const res = await Api.request('saveWeight', {
      date: date,
      weight: weight,
      note: note
    });

    App.hideLoading();

    if (res.success) {
      App.showToast("Berat badan berhasil dicatat!", "success");
      document.getElementById('weight-input-val').value = '';
      document.getElementById('weight-input-note').value = '';
      await App.refreshAllData();
    } else {
      App.showToast(res.message || "Gagal mencatat berat badan.", "error");
    }
  }

  function renderChart() {
    const ctx = document.getElementById('weight-chart');
    if (!ctx) return;

    // Urutkan data berdasarkan tanggal asc
    const sorted = [...weightLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sorted.map(item => {
      const d = new Date(item.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    const values = sorted.map(item => Number(item.weight));

    if (chartInstance) {
      chartInstance.destroy();
    }

    if (values.length === 0) {
      return;
    }

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Berat Badan (kg)',
          data: values,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Berat: ${ctx.parsed.y} kg`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (v) => `${v} kg`
            }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderLogsList() {
    const container = document.getElementById('weight-logs-list');
    if (!container) return;

    if (weightLogs.length === 0) {
      container.innerHTML = `<p class="text-muted text-center py-3">Belum ada data berat badan yang dicatat.</p>`;
      return;
    }

    // Urutkan desc untuk list
    const sorted = [...weightLogs].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sorted.map(item => `
      <div class="weight-item-card" data-id="${item.id}">
        <div>
          <div class="weight-date">${item.date}</div>
          <div class="weight-note">${item.note ? escapeHtml(item.note) : 'Tanpa catatan'}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="weight-val">${Number(item.weight).toFixed(1)} kg</div>
          <button class="icon-btn" title="Hapus" onclick="WeightModule.deleteWeight('${item.id}')">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  async function deleteWeight(id) {
    if (!confirm("Hapus catatan berat badan ini?")) return;

    App.showLoading("Menghapus data berat badan...");
    const res = await Api.request('deleteWeight', { id: id });
    App.hideLoading();

    if (res.success) {
      App.showToast("Data berat badan dihapus.", "success");
      await App.refreshAllData();
    } else {
      App.showToast(res.message || "Gagal menghapus data berat badan.", "error");
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  return {
    init,
    setWeightLogs,
    handleSaveWeight,
    deleteWeight
  };
})();
