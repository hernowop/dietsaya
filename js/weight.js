/**
 * DietSaya - Weight Tracking Module
 */

const WeightModule = (() => {
  let weightLogs = [];
  let chartInstance = null;

  function init() {
    const today = new Date().toISOString().split('T')[0];
    const weightDateInput = document.getElementById('weight-date');
    if (weightDateInput) weightDateInput.value = today;
  }

  function setWeightLogs(logs) {
    weightLogs = logs || [];
    renderChart();
    renderLogsList();
  }

  async function handleSaveWeight(e) {
    e.preventDefault();
    const date = document.getElementById('weight-date').value || new Date().toISOString().split('T')[0];
    const weight = Number(document.getElementById('weight-value').value);
    const note = document.getElementById('weight-note').value.trim();

    if (!weight || weight <= 0) {
      App.showToast("Masukkan angka berat badan yang valid.", "error");
      return;
    }

    App.showLoading("Menyimpan data berat badan...");
    const res = await Api.request('saveWeight', { date, weight, note });
    App.hideLoading();

    if (res.success) {
      App.showToast("Data berat badan berhasil disimpan!", "success");
      document.getElementById('weight-value').value = '';
      document.getElementById('weight-note').value = '';
      await App.refreshAllData();
    } else {
      App.showToast(res.message || "Gagal menyimpan data berat badan.", "error");
    }
  }

  function renderChart() {
    const canvas = document.getElementById('weightChart');
    if (!canvas) return;

    if (weightLogs.length === 0) {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }

    // Urutkan ascending berdasarkan tanggal untuk chart
    const sorted = [...weightLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sorted.map(item => item.date.slice(5)); // MM-DD
    const values = sorted.map(item => item.weight);

    const ctx = canvas.getContext('2d');

    if (chartInstance) {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = values;
      chartInstance.update();
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
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
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
