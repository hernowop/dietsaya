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

    const filterHistInput = document.getElementById('filter-history-date');

    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = nowTime;

    if (filterHistInput) filterHistInput.value = today;

    renderSmartPresets();
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

        const previewImg = document.getElementById('photo-preview-img');
        const placeholder = document.getElementById('photo-upload-placeholder');
        const previewWrap = document.getElementById('photo-preview-wrapper');

        if (previewImg) previewImg.src = dataUrl;
        if (placeholder) placeholder.classList.add('hidden');
        if (previewWrap) previewWrap.classList.remove('hidden');

        App.showToast("Foto berhasil dimuat.", "success");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    currentImageBase64 = null;
    currentImageMimeType = null;
    
    const camInput = document.getElementById('ai-food-camera-input');
    const galInput = document.getElementById('ai-food-gallery-input');
    const oldInput = document.getElementById('ai-food-image-input');
    if (camInput) camInput.value = '';
    if (galInput) galInput.value = '';
    if (oldInput) oldInput.value = '';

    const previewImg = document.getElementById('photo-preview-img');
    const previewWrap = document.getElementById('photo-preview-wrapper');
    const placeholder = document.getElementById('photo-upload-placeholder');

    if (previewImg) previewImg.src = '';
    if (previewWrap) previewWrap.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
  }

  async function analyzeWithAI() {
    const textarea = document.getElementById('ai-food-input');
    const foodText = textarea ? textarea.value.trim() : '';

    if (!foodText && !currentImageBase64) {
      App.showToast("Silakan ambil foto atau tulis makanan terlebih dahulu.", "error");
      return;
    }

    const mealDate = document.getElementById('input-meal-date')?.value || new Date().toISOString().split('T')[0];
    const mealTime = document.getElementById('input-meal-time')?.value || new Date().toTimeString().slice(0, 5);

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
      const currentMealGroup = res.data.meal_group || 'Menu Makanan';
      const currentGroupId = res.data.group_id || ('grp_' + Date.now());

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
        time: mealTime,
        meal_group: item.meal_group || currentMealGroup,
        group_id: item.group_id || currentGroupId
      }));

      const noteEl = document.getElementById('ai-estimation-note');
      if (noteEl) {
        noteEl.textContent = res.data.note || `Estimasi Gemini AI untuk paket: ${currentMealGroup}. Periksa dan koreksi sebelum disimpan.`;
      }
      
      renderEditableAICards();
      const resultSec = document.getElementById('ai-result-section');
      if (resultSec) resultSec.classList.remove('hidden');
      App.showToast(`Estimasi AI untuk "${currentMealGroup}" berhasil diperoleh!`, "success");
    } else {
      App.showToast(res.message || "Gagal menganalisis makanan dengan Gemini.", "error");
    }
  }

  function renderEditableAICards() {
    const container = document.getElementById('ai-items-container');
    if (!container) return;

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
    const mealDate = document.getElementById('input-meal-date')?.value || new Date().toISOString().split('T')[0];
    const mealTime = document.getElementById('input-meal-time')?.value || new Date().toTimeString().slice(0, 5);

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

    const sumCal = document.getElementById('ai-sum-calories');
    const sumPro = document.getElementById('ai-sum-protein');
    const sumCarbs = document.getElementById('ai-sum-carbs');
    const sumFat = document.getElementById('ai-sum-fat');

    if (sumCal) sumCal.textContent = totCal;
    if (sumPro) sumPro.textContent = totPro;
    if (sumCarbs) sumCarbs.textContent = totCarbs;
    if (sumFat) sumFat.textContent = totFat;
  }

  function cancelAIResult() {
    pendingAIItems = [];
    removePhoto();
    const resultSec = document.getElementById('ai-result-section');
    const inputArea = document.getElementById('ai-food-input');
    if (resultSec) resultSec.classList.add('hidden');
    if (inputArea) inputArea.value = '';
  }

  async function saveConfirmedItems() {
    if (pendingAIItems.length === 0) {
      App.showToast("Tidak ada item yang dapat disimpan.", "error");
      return;
    }

    App.showLoading("Menyimpan & meminta saran AI...");
    const res = await Api.request('saveFood', { items: pendingAIItems });
    App.hideLoading();

    if (res.success) {
      if (res.data) {
        if (res.data.aiAdvice) {
          DashboardModule.setAiAdvice(res.data.aiAdvice);
        }
        if (res.data.dashboard) {
          DashboardModule.render(res.data.dashboard);
        }
        if (res.data.foodLogs) {
          FoodModule.setFoodLogs(res.data.foodLogs);
        }
        try {
          localStorage.setItem('dietsaya_cached_data', JSON.stringify(res.data));
        } catch (e) {}
      }
      App.showToast("Catatan makanan berhasil disimpan!", "success");
      cancelAIResult();
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

    App.showLoading("Menyimpan & menganalisis nutrisi...");
    const res = await Api.request('saveFood', { items: [manualItem] });
    App.hideLoading();

    if (res.success) {
      if (res.data) {
        if (res.data.aiAdvice) {
          DashboardModule.setAiAdvice(res.data.aiAdvice);
        }
        if (res.data.dashboard) {
          DashboardModule.render(res.data.dashboard);
        }
        if (res.data.foodLogs) {
          FoodModule.setFoodLogs(res.data.foodLogs);
        }
        try {
          localStorage.setItem('dietsaya_cached_data', JSON.stringify(res.data));
        } catch (e) {}
      }
      App.showToast("Makanan berhasil dicatat!", "success");
      // Reset form
      document.getElementById('manual-food-name').value = '';
      document.getElementById('manual-food-portion').value = '';
      document.getElementById('manual-food-cal').value = '';
      document.getElementById('manual-food-pro').value = '';
      document.getElementById('manual-food-carbs').value = '';
      document.getElementById('manual-food-fat').value = '';
      
      App.navigate('dashboard');
    } else {
      App.showToast(res.message || "Gagal menyimpan makanan.", "error");
    }
  }

  function setFoodLogs(logs) {
    allFoodLogs = logs || [];
    filterHistoryByDate();
    renderSmartPresets();
  }

  function filterHistoryByDate() {
    const selectedDate = document.getElementById('filter-history-date')?.value;
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

    const groupedMeals = (typeof DashboardModule !== 'undefined' && DashboardModule.groupFoodLogs) 
      ? DashboardModule.groupFoodLogs(filtered) 
      : [{ items: filtered }];

    container.innerHTML = groupedMeals.map(group => {
      if (group.items.length > 1) {
        let groupCal = 0, groupPro = 0, groupCarbs = 0, groupFat = 0;
        group.items.forEach(it => {
          groupCal += Number(it.calories || 0);
          groupPro += Number(it.protein || 0);
          groupCarbs += Number(it.carbs || 0);
          groupFat += Number(it.fat || 0);
        });

        return `
          <div class="meal-group-card" id="hist-group-${group.groupId}">
            <div class="meal-group-header" onclick="DashboardModule.toggleMealGroup(this.parentElement)">
              <div class="meal-group-main-info">
                <div class="meal-group-title-row">
                  <span class="meal-group-title">🍱 ${escapeHtml(group.mealGroup)}</span>
                  <span class="meal-group-badge-count">${group.items.length} Komponen</span>
                </div>
                <div class="meal-group-time-tag">
                  <span>${group.time || ''}</span> • 
                  <span class="tag-p">P:${groupPro}g</span> <span class="tag-c">K:${groupCarbs}g</span> <span class="tag-f">L:${groupFat}g</span>
                </div>
              </div>
              <div class="meal-group-summary-right">
                <div class="meal-group-total-cal">
                  <strong>${groupCal}</strong>
                  <small>kkal total</small>
                </div>
                <div class="meal-group-expand-icon">▾</div>
              </div>
            </div>

            <!-- Rincian Komponen Bahan (Accordion) -->
            <div class="meal-group-content">
              <div class="meal-subitems-list">
                ${group.items.map(item => `
                  <div class="meal-subitem-row" data-id="${item.id}">
                    <div class="meal-subitem-info">
                      <div class="meal-subitem-name">
                        <span>•</span>
                        <span>${escapeHtml(item.food_name)}</span>
                      </div>
                      <div class="meal-subitem-portion">${escapeHtml(item.portion || '')}</div>
                      <div class="meal-subitem-macros">
                        <span class="tag-p">P: ${item.protein || 0}g</span>
                        <span class="tag-c">K: ${item.carbs || 0}g</span>
                        <span class="tag-f">L: ${item.fat || 0}g</span>
                      </div>
                    </div>
                    <div class="meal-subitem-right">
                      <div class="meal-subitem-cal">
                        ${item.calories || 0} <small class="text-muted">kkal</small>
                      </div>
                      <div class="food-actions">
                        <button class="icon-btn" title="Edit" onclick="event.stopPropagation(); FoodModule.openEditModal('${item.id}')">✏️</button>
                        <button class="icon-btn" title="Hapus Item Ini" onclick="event.stopPropagation(); FoodModule.deleteFoodItem('${item.id}')">🗑️</button>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="meal-group-footer">
                <span class="text-muted text-sm">${group.items.length} item dalam paket ini</span>
                <button class="btn-delete-group" onclick="FoodModule.deleteMealGroup('${group.groupId}', '${escapeHtml(group.mealGroup)}')">
                  <span>🗑️ Hapus Seluruh Paket</span>
                </button>
              </div>
            </div>
          </div>
        `;
      } else {
        const item = group.items[0];
        return `
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
        `;
      }
    }).join('');
  }

  async function deleteMealGroup(groupId, groupName = 'Menu Paket') {
    if (!confirm(`Apakah Anda yakin ingin menghapus seluruh paket "${groupName}"?`)) return;

    App.showLoading("Menghapus paket menu...");
    const res = await Api.request('deleteMealGroup', { groupId: groupId });
    App.hideLoading();

    if (res.success) {
      App.showToast(`Paket "${groupName}" berhasil dihapus.`, "success");
      await App.refreshAllData();
    } else {
      App.showToast(res.message || "Gagal menghapus paket menu.", "error");
    }
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

  /* ==========================================================
     AI & HISTORY-DRIVEN SMART QUICK PRESETS
     ========================================================== */
  function getCurrentMealContext() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) {
      return { slot: 'breakfast', name: 'Sarapan', subtitle: 'Rekomendasi sarapan favorit & bernutrisi Anda', badgeText: 'Sarapan Favorit' };
    } else if (hour >= 11 && hour < 15) {
      return { slot: 'lunch', name: 'Makan Siang', subtitle: 'Rekomendasi makan siang berenergi Anda', badgeText: 'Makan Siang Favorit' };
    } else if (hour >= 15 && hour < 18) {
      return { slot: 'snack', name: 'Camilan Sore', subtitle: 'Rekomendasi camilan sehat & booster sore', badgeText: 'Camilan Sehat' };
    } else {
      return { slot: 'dinner', name: 'Makan Malam', subtitle: 'Rekomendasi makan malam nyaman & teratur', badgeText: 'Makan Malam Favorit' };
    }
  }

  function detectFoodEmoji(name) {
    if (!name) return '🍱';
    const n = name.toLowerCase();
    if (n.includes('telur') || n.includes('egg') || n.includes('omelet')) return '🥚';
    if (n.includes('ayam') || n.includes('chicken') || n.includes('katsu') || n.includes('dada')) return '🍗';
    if (n.includes('rendang') || n.includes('sapi') || n.includes('beef') || n.includes('daging') || n.includes('steak')) return '🥩';
    if (n.includes('nasi') || n.includes('rice') || n.includes('padang') || n.includes('uduk') || n.includes('goreng')) return '🍚';
    if (n.includes('pisang') || n.includes('banana')) return '🍌';
    if (n.includes('apel') || n.includes('apple')) return '🍎';
    if (n.includes('alpukat') || n.includes('avocado')) return '🥑';
    if (n.includes('buah') || n.includes('salad') || n.includes('fruit')) return '🥗';
    if (n.includes('soto') || n.includes('sop') || n.includes('soup') || n.includes('rawon') || n.includes('bakso') || n.includes('mie') || n.includes('noodle')) return '🍜';
    if (n.includes('roti') || n.includes('bread') || n.includes('toast') || n.includes('sandwich')) return '🥪';
    if (n.includes('kopi') || n.includes('coffee') || n.includes('latte')) return '☕';
    if (n.includes('susu') || n.includes('milk') || n.includes('whey') || n.includes('protein')) return '🥛';
    if (n.includes('ikan') || n.includes('fish') || n.includes('salmon') || n.includes('tuna')) return '🐟';
    if (n.includes('tempe') || n.includes('tahu') || n.includes('tofu')) return '🥢';
    if (n.includes('oat') || n.includes('havermut') || n.includes('cereal')) return '🥣';
    return '🍱';
  }

  function getSmartRecommendationsFromHistory() {
    const context = getCurrentMealContext();
    const map = {};

    // Kumpulkan makanan dari riwayat
    allFoodLogs.forEach(item => {
      // Kelompokkan berdasarkan meal_group jika ada dan valid, atau nama makanan
      const key = (item.meal_group && item.meal_group !== 'Menu Makanan' && item.meal_group !== 'Menu Komposit') 
        ? item.meal_group 
        : item.food_name;

      if (!key) return;

      if (!map[key]) {
        map[key] = {
          name: key,
          portion: item.portion || '1 porsi',
          calories: Number(item.calories) || 0,
          protein: Number(item.protein) || 0,
          carbs: Number(item.carbs) || 0,
          fat: Number(item.fat) || 0,
          count: 0,
          timeSlotMatch: 0,
          lastDate: item.date || '',
          source: 'history'
        };
      }

      map[key].count++;

      // Cek kecocokan jam makan riwayat dengan waktu saat ini
      if (item.time) {
        const h = parseInt(item.time.split(':')[0]) || 12;
        if (context.slot === 'breakfast' && h >= 4 && h < 11) map[key].timeSlotMatch += 3;
        else if (context.slot === 'lunch' && h >= 11 && h < 15) map[key].timeSlotMatch += 3;
        else if (context.slot === 'snack' && h >= 15 && h < 18) map[key].timeSlotMatch += 3;
        else if (context.slot === 'dinner' && (h >= 18 || h < 4)) map[key].timeSlotMatch += 3;
      }
    });

    // Urutkan berdasarkan skor relevansi: (frekuensi * 2) + kecocokan slot jam makan
    const sortedFromHistory = Object.values(map).sort((a, b) => {
      const scoreA = (a.count * 2) + a.timeSlotMatch;
      const scoreB = (b.count * 2) + b.timeSlotMatch;
      return scoreB - scoreA;
    });

    // AI & Nutrisi Fallbacks cerdas
    const fallbacks = [
      { name: '2 Telur Rebus', portion: '2 butir', calories: 155, protein: 13, carbs: 1, fat: 11, source: 'ai', badge: 'Tinggi Protein' },
      { name: 'Nasi Putih 150g', portion: '1 porsi (150g)', calories: 195, protein: 4, carbs: 43, fat: 0, source: 'ai', badge: 'Energi Karbo' },
      { name: 'Dada Ayam Panggang', portion: '1 potong (150g)', calories: 248, protein: 46, carbs: 0, fat: 5, source: 'ai', badge: 'Tinggi Protein' },
      { name: 'Pisang Cavendish', portion: '1 buah sedang', calories: 105, protein: 1, carbs: 27, fat: 0, source: 'ai', badge: 'Serat Alami' },
      { name: 'Oatmeal & Susu', portion: '1 mangkok (40g oat)', calories: 220, protein: 9, carbs: 36, fat: 4, source: 'ai', badge: 'Kaya Serat' },
      { name: 'Tempe & Tahu Bacem', portion: '2 potong sedang', calories: 180, protein: 14, carbs: 12, fat: 8, source: 'ai', badge: 'Nabati Sehat' }
    ];

    const result = [];
    const usedNames = new Set();

    // 1. Masukkan hasil riwayat yang relevan (maksimal 3-4 item)
    for (const hItem of sortedFromHistory) {
      if (result.length >= 4) break;
      const lower = hItem.name.toLowerCase().trim();
      if (!usedNames.has(lower)) {
        usedNames.add(lower);
        result.push({
          ...hItem,
          badge: hItem.timeSlotMatch > 0 ? context.badgeText : (hItem.count > 1 ? `${hItem.count}x Dicatat` : 'Dari Riwayat')
        });
      }
    }

    // 2. Lengkapi dengan fallback cerdas jika kurang dari 4
    for (const fItem of fallbacks) {
      if (result.length >= 4) break;
      const lower = fItem.name.toLowerCase().trim();
      if (!usedNames.has(lower)) {
        usedNames.add(lower);
        result.push(fItem);
      }
    }

    return {
      context,
      items: result.slice(0, 4)
    };
  }

  function renderSmartPresets() {
    const grid = document.getElementById('quick-presets-grid');
    const titleEl = document.getElementById('smart-presets-title');
    const subtitleEl = document.getElementById('smart-presets-subtitle');
    if (!grid) return;

    const { context, items } = getSmartRecommendationsFromHistory();

    if (titleEl) {
      titleEl.innerHTML = `✨ Rekomendasi ${escapeHtml(context.name)} & Favorit`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = context.subtitle;
    }

    grid.innerHTML = items.map(item => {
      const emoji = detectFoodEmoji(item.name);
      const isHistory = item.source === 'history';
      const badgeClass = isHistory ? 'tag-history' : 'tag-ai';

      return `
        <button type="button" class="preset-card-btn" onclick="FoodModule.selectQuickPreset('${escapeHtml(item.name)}', '${escapeHtml(item.portion)}', ${item.calories}, ${item.protein}, ${item.carbs}, ${item.fat})">
          <span class="preset-icon">${emoji}</span>
          <div class="preset-info">
            <div class="preset-top-row">
              <span class="preset-name">${escapeHtml(item.name)}</span>
              <span class="preset-badge-tag ${badgeClass}">${escapeHtml(item.badge || 'Favorit')}</span>
            </div>
            <span class="preset-macros">${item.calories} kkal • ${item.protein}g P</span>
          </div>
        </button>
      `;
    }).join('');
  }

  function refreshSmartPresets() {
    if (typeof App !== 'undefined' && App.triggerHaptic) App.triggerHaptic(30);
    renderSmartPresets();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast("Rekomendasi menu diperbarui!", "info");
    }
  }

  function selectQuickPreset(name, portion, calories, protein, carbs, fat) {
    if (typeof App !== 'undefined' && App.triggerHaptic) App.triggerHaptic(40);
    
    // Isi ke text input AI
    const area = document.getElementById('ai-food-input');
    if (area) {
      area.value = `${name} (${portion})`;
    }

    // Isi ke form manual juga
    const mName = document.getElementById('manual-food-name');
    const mPortion = document.getElementById('manual-food-portion');
    const mCal = document.getElementById('manual-food-cal');
    const mPro = document.getElementById('manual-food-pro');
    const mCarbs = document.getElementById('manual-food-carbs');
    const mFat = document.getElementById('manual-food-fat');

    if (mName) mName.value = name;
    if (mPortion) mPortion.value = portion;
    if (mCal) mCal.value = calories;
    if (mPro) mPro.value = protein;
    if (mCarbs) mCarbs.value = carbs;
    if (mFat) mFat.value = fat;

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Pilihan cepat: ${name} (${calories} kkal)`, "info");
    }
  }

  return {
    init,
    switchMode,
    fillSample,
    selectQuickPreset,
    renderSmartPresets,
    refreshSmartPresets,
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
    deleteFoodItem,
    deleteMealGroup,
    getAllLogs: () => allFoodLogs
  };
})();
