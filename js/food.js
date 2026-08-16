/**
 * DietSaya - Food & AI Analysis Module (Text, Photo & Manual Input)
 */

const FoodModule = (() => {
  let pendingAIItems = [];
  let allFoodLogs = [];
  let currentImageBase64 = null;
  let currentImageMimeType = null;
  let activeInputMode = 'ai'; // 'ai' or 'manual'

  function init() {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().slice(0, 5);

    const dateInput = document.getElementById('input-meal-date');
    const timeInput = document.getElementById('input-meal-time');
    const manualDate = document.getElementById('manual-meal-date');
    const manualTime = document.getElementById('manual-meal-time');
    const filterHistInput = document.getElementById('filter-history-date');

    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = nowTime;
    if (manualDate) manualDate.value = today;
    if (manualTime) manualTime.value = nowTime;
    if (filterHistInput) filterHistInput.value = today;
  }

  function switchMode(mode) {
    activeInputMode = mode;
    const aiCard = document.querySelector('.ai-input-card');
    const aiResultSection = document.getElementById('ai-result-section');
    const manualSection = document.getElementById('manual-input-section');
    const btnAi = document.getElementById('btn-mode-ai');
    const btnManual = document.getElementById('btn-mode-manual');

    if (mode === 'ai') {
      if (btnAi) btnAi.classList.add('active');
      if (btnManual) btnManual.classList.remove('active');
      if (aiCard) aiCard.classList.remove('hidden');
      if (manualSection) manualSection.classList.add('hidden');
    } else {
      if (btnManual) btnManual.classList.add('active');
      if (btnAi) btnAi.classList.remove('active');
      if (aiCard) aiCard.classList.add('hidden');
      if (aiResultSection) aiResultSection.classList.add('hidden');
      if (manualSection) manualSection.classList.remove('hidden');
    }
  }

  function fillSample(text) {
    const area = document.getElementById('ai-food-input');
    if (area) {
      area.value = text;
      area.focus();
    }
  }

  function handleImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      App.showToast("File yang dipilih harus berupa gambar.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        currentImageBase64 = dataUrl.split(',')[1];
        currentImageMimeType = 'image/jpeg';

        document.getElementById('photo-preview-img').src = dataUrl;
        document.getElementById('photo-upload-placeholder').classList.add('hidden');
        document.getElementById('photo-preview-wrapper').classList.remove('hidden');

        App.showToast("Foto berhasil dimuat.", "success");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    currentImageBase64 = null;
    currentImageMimeType = null;
    const inputEl = document.getElementById('ai-food-image-input');
    if (inputEl) inputEl.value = '';
    document.getElementById('photo-preview-img').src = '';
    document.getElementById('photo-preview-wrapper').classList.add('hidden');
    document.getElementById('photo-upload-placeholder').classList.remove('hidden');
  }

  async function analyzeWithAI() {
    const textarea = document.getElementById('ai-food-input');
    const foodText = textarea.value.trim();

    if (!foodText && !currentImageBase64) {
      App.showToast("Silakan ambil foto atau tulis makanan terlebih dahulu.", "error");
      return;
    }

    const mealDate = document.getElementById('input-meal-date').value || new Date().toISOString().split('T')[0];
    const mealTime = document.getElementById('input-meal-time').value || new Date().toTimeString().slice(0, 5);

    App.showLoading(currentImageBase64 ? "Gemini AI sedang menganalisis foto makanan..." : "Gemini AI sedang memperkirakan kalori...");

    const res = await Api.request('analyzeFood', {
      foodText: foodText,
      imageBase64: currentImageBase64,
      imageMimeType: currentImageMimeType,
      date: mealDate,
      time: mealTime
    });

    App.hideLoading();

    if (res.success && res.data && res.data.items && res.data.items.length > 0) {
      pendingAIItems = res.data.items.map((item, idx) => ({
        tempId: 'temp_' + Date.now() + '_' + idx,
        food_name: item.name || item.food_name || 'Makanan',
        portion: item.portion || '1 porsi',
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fat: Number(item.fat) || 0,
        fiber: Number(item.fiber) || 0,
        confidence: item.confidence || 'medium',
        date: mealDate,
        time: mealTime
      }));

      document.getElementById('ai-estimation-note').textContent = res.data.note || 
        "Nilai merupakan estimasi Gemini AI. Silakan periksa dan koreksi sebelum disimpan.";
      
      renderEditableAICards();
      document.getElementById('ai-result-section').classList.remove('hidden');
      App.showToast("Estimasi AI berhasil diperoleh!", "success");
    } else {
      App.showToast(res.message || "Gagal menganalisis makanan dengan Gemini.", "error");
    }
  }

  function renderEditableAICards() {
    const container = document.getElementById('ai-items-container');
    if (pendingAIItems.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">Semua item telah dihapus. Tambahkan baris baru jika diperlukan.</p>';
      updateAITotalSummary();
      return;
    }

    container.innerHTML = pendingAIItems.map((item) => `
      <div class="ai-editable-card" data-tempid="${item.tempId}">
        <button class="ai-card-del-btn" title="Hapus Baris" onclick="FoodModule.removeAIItemRow('${item.tempId}')">&times;</button>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label-sub">Nama Makanan</label>
            <input type="text" class="form-input" value="${escapeHtml(item.food_name)}" 
                   oninput="FoodModule.updateItemField('${item.tempId}', 'food_name', this.value)">
          </div>
          <div class="form-group">
            <label class="form-label-sub">Porsi</label>
            <input type="text" class="form-input" value="${escapeHtml(item.portion)}" 
                   oninput="FoodModule.updateItemField('${item.tempId}', 'portion', this.value)">
          </div>
        </div>
        <div class="form-row-3 mt-2">
          <div class="form-group">
            <label class="form-label-sub">Kalori (kkal)</label>
            <input type="number" class="form-input" min="0" value="${item.calories}" 
                   oninput="FoodModule.updateItemField('${item.tempId}', 'calories', Number(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label-sub">Protein (g)</label>
            <input type="number" class="form-input" min="0" value="${item.protein}" 
                   oninput="FoodModule.updateItemField('${item.tempId}', 'protein', Number(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label-sub">Karbo (g)</label>
            <input type="number" class="form-input" min="0" value="${item.carbs}" 
                   oninput="FoodModule.updateItemField('${item.tempId}', 'carbs', Number(this.value))">
          </div>
        </div>
        <div class="form-row-2 mt-2">
          <div class="form-group">
            <label class="form-label-sub">Lemak (g)</label>
            <input type="number" class="form-input" min="0" value="${item.fat}" 
                   oninput="FoodModule.updateItemField('${item.tempId}', 'fat', Number(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label-sub">Serat / Fiber (g)</label>
            <input type="number" class="form-input" min="0" value="${item.fiber}" 
                   oninput="FoodModule.updateItemField('${item.tempId}', 'fiber', Number(this.value))">
          </div>
        </div>
      </div>
    `).join('');

    updateAITotalSummary();
  }

  function updateItemField(tempId, field, val) {
    const target = pendingAIItems.find(i => i.tempId === tempId);
    if (target) {
      target[field] = val;
      updateAITotalSummary();
    }
  }

  function removeAIItemRow(tempId) {
    pendingAIItems = pendingAIItems.filter(i => i.tempId !== tempId);
    renderEditableAICards();
  }

  function addEmptyItemRow() {
    const mealDate = document.getElementById('input-meal-date').value || new Date().toISOString().split('T')[0];
    const mealTime = document.getElementById('input-meal-time').value || new Date().toTimeString().slice(0, 5);

    pendingAIItems.push({
      tempId: 'temp_' + Date.now(),
      food_name: 'Makanan Tambahan',
      portion: '1 porsi',
      calories: 100,
      protein: 5,
      carbs: 15,
      fat: 2,
      fiber: 0,
      confidence: 'user_added',
      date: mealDate,
      time: mealTime
    });

    renderEditableAICards();
  }

  function updateAITotalSummary() {
    let totCal = 0, totPro = 0, totCarbs = 0, totFat = 0;
    pendingAIItems.forEach(i => {
      totCal += Number(i.calories || 0);
      totPro += Number(i.protein || 0);
      totCarbs += Number(i.carbs || 0);
      totFat += Number(i.fat || 0);
    });

    document.getElementById('ai-sum-calories').textContent = totCal;
    document.getElementById('ai-sum-protein').textContent = totPro;
    document.getElementById('ai-sum-carbs').textContent = totCarbs;
    document.getElementById('ai-sum-fat').textContent = totFat;
  }

  function cancelAIResult() {
    pendingAIItems = [];
    removePhoto();
    document.getElementById('ai-result-section').classList.add('hidden');
    document.getElementById('ai-food-input').value = '';
  }

  async function saveConfirmedItems() {
    if (pendingAIItems.length === 0) {
      App.showToast("Tidak ada item yang dapat disimpan.", "error");
      return;
    }

    App.showLoading("Menyimpan catatan makanan ke Google Sheets...");
    const res = await Api.request('saveFood', { items: pendingAIItems });
    App.hideLoading();

    if (res.success) {
      App.showToast("Catatan makanan berhasil disimpan!", "success");
      cancelAIResult();
      await App.refreshAllData();
      App.navigate('dashboard');
    } else {
      App.showToast(res.message || "Gagal menyimpan catatan makanan.", "error");
    }
  }

  /**
   * Menyimpan makanan dari form Input Manual
   */
  async function handleSaveManual(e) {
    e.preventDefault();

    const manualItem = {
      food_name: document.getElementById('manual-food-name').value.trim(),
      portion: document.getElementById('manual-food-portion').value.trim(),
      calories: Number(document.getElementById('manual-food-cal').value) || 0,
      protein: Number(document.getElementById('manual-food-pro').value) || 0,
      carbs: Number(document.getElementById('manual-food-carbs').value) || 0,
      fat: Number(document.getElementById('manual-food-fat').value) || 0,
      fiber: 0,
      source: 'manual_input',
      date: document.getElementById('manual-meal-date').value || new Date().toISOString().split('T')[0],
      time: document.getElementById('manual-meal-time').value || new Date().toTimeString().slice(0, 5)
    };

    if (!manualItem.food_name) {
      App.showToast("Nama makanan wajib diisi.", "error");
      return;
    }

    App.showLoading("Menyimpan makanan manual...");
    const res = await Api.request('saveFood', { items: [manualItem] });
    App.hideLoading();

    if (res.success) {
      App.showToast("Makanan berhasil dicatat!", "success");
      // Reset form
      document.getElementById('manual-food-name').value = '';
      document.getElementById('manual-food-portion').value = '';
      document.getElementById('manual-food-cal').value = '';
      document.getElementById('manual-food-pro').value = '';
      document.getElementById('manual-food-carbs').value = '';
      document.getElementById('manual-food-fat').value = '';
      
      await App.refreshAllData();
      App.navigate('dashboard');
    } else {
      App.showToast(res.message || "Gagal menyimpan makanan.", "error");
    }
  }

  function setFoodLogs(logs) {
    allFoodLogs = logs || [];
    filterHistoryByDate();
  }

  function filterHistoryByDate() {
    const selectedDate = document.getElementById('filter-history-date').value;
    const dateStrEl = document.getElementById('history-selected-date-str');
    const container = document.getElementById('history-items-list');

    if (!selectedDate) {
      if (container) container.innerHTML = '<p class="text-muted text-center">Pilih tanggal untuk melihat riwayat.</p>';
      return;
    }

    if (dateStrEl) dateStrEl.textContent = selectedDate;
    const filtered = allFoodLogs.filter(item => item.date === selectedDate);

    let totCal = 0, totPro = 0, totCarbs = 0, totFat = 0;
    filtered.forEach(i => {
      totCal += Number(i.calories || 0);
      totPro += Number(i.protein || 0);
      totCarbs += Number(i.carbs || 0);
      totFat += Number(i.fat || 0);
    });

    const totCalEl = document.getElementById('hist-tot-cal');
    const totProEl = document.getElementById('hist-tot-pro');
    const totCarbsEl = document.getElementById('hist-tot-carbs');
    const totFatEl = document.getElementById('hist-tot-fat');

    if (totCalEl) totCalEl.textContent = totCal;
    if (totProEl) totProEl.textContent = totPro;
    if (totCarbsEl) totCarbsEl.textContent = totCarbs;
    if (totFatEl) totFatEl.textContent = totFat;

    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>Tidak ada catatan makanan pada tanggal ${selectedDate}.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => `
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

  function resetHistoryFilterToday() {
    const today = new Date().toISOString().split('T')[0];
    const filterEl = document.getElementById('filter-history-date');
    if (filterEl) filterEl.value = today;
    filterHistoryByDate();
  }

  function openEditModal(foodId) {
    const item = allFoodLogs.find(i => String(i.id) === String(foodId));
    if (!item) return;

    document.getElementById('edit-food-id').value = item.id;
    document.getElementById('edit-food-name').value = item.food_name;
    document.getElementById('edit-food-portion').value = item.portion;
    document.getElementById('edit-food-cal').value = item.calories;
    document.getElementById('edit-food-pro').value = item.protein;
    document.getElementById('edit-food-carbs').value = item.carbs;
    document.getElementById('edit-food-fat').value = item.fat;

    document.getElementById('modal-edit-food').classList.remove('hidden');
  }

  function closeEditModal() {
    document.getElementById('modal-edit-food').classList.add('hidden');
  }

  async function submitEditFood(e) {
    e.preventDefault();
    const foodId = document.getElementById('edit-food-id').value;
    const updated = {
      id: foodId,
      food_name: document.getElementById('edit-food-name').value,
      portion: document.getElementById('edit-food-portion').value,
      calories: Number(document.getElementById('edit-food-cal').value),
      protein: Number(document.getElementById('edit-food-pro').value),
      carbs: Number(document.getElementById('edit-food-carbs').value),
      fat: Number(document.getElementById('edit-food-fat').value)
    };

    closeEditModal();
    App.showLoading("Menyimpan perubahan...");
    const res = await Api.request('updateFood', { food: updated });
    App.hideLoading();

    if (res.success) {
      App.showToast("Perubahan makanan berhasil disimpan.", "success");
      await App.refreshAllData();
    } else {
      App.showToast(res.message || "Gagal mengubah makanan.", "error");
    }
  }

  async function deleteFoodItem(foodId) {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan makanan ini?")) return;

    App.showLoading("Menghapus makanan...");
    const res = await Api.request('deleteFood', { id: foodId });
    App.hideLoading();

    if (res.success) {
      App.showToast("Catatan makanan berhasil dihapus.", "success");
      await App.refreshAllData();
    } else {
      App.showToast(res.message || "Gagal menghapus catatan makanan.", "error");
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
    switchMode,
    fillSample,
    handleImageSelected,
    removePhoto,
    analyzeWithAI,
    updateItemField,
    removeAIItemRow,
    addEmptyItemRow,
    cancelAIResult,
    saveConfirmedItems,
    handleSaveManual,
    setFoodLogs,
    filterHistoryByDate,
    resetHistoryFilterToday,
    openEditModal,
    closeEditModal,
    submitEditFood,
    deleteFoodItem
  };
})();
