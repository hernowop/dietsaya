/**
 * DietSaya — Backend Google Apps Script (Web App API)
 * Mendukung Multimodal Vision (Teks + Foto Makanan Kamera/Galeri) & Persistent Session
 */
const SHEET_USERS = 'Users';
const SHEET_FOOD_LOGS = 'FoodLogs';
const SHEET_WEIGHT_LOGS = 'WeightLogs';
const SHEET_SETTINGS = 'Settings';

function doGet(e) { return handleRequest(e, 'GET'); }
function doPost(e) { return handleRequest(e, 'POST'); }

function handleRequest(e, method) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    let params = {};
    if (method === 'POST') {
      if (e.postData && e.postData.contents) {
        try { params = JSON.parse(e.postData.contents); } catch (err) { params = e.parameter || {}; }
      }
    } else {
      params = e.parameter || {};
      if (typeof params.payload === 'string') {
        try { params = { ...params, ...JSON.parse(params.payload) }; } catch (err) {}
      }
    }

    const action = params.action;
    const idToken = params.idToken;
    const userEmail = params.userEmail;
    const userId = params.userId;

    const authResult = verifyGoogleIdToken(idToken, userEmail, userId);
    if (!authResult.valid) {
      return jsonResponse({ success: false, data: null, message: authResult.error || 'Akun tidak memiliki akses.' });
    }

    const user = authResult.user;
    ensureSheetsInitialized();

    let result = null;
    switch (action) {
      case 'verifyUser':
      case 'getDashboardData':
        result = getDashboardData(user);
        break;
      case 'getSpreadsheetUrl':
        result = { spreadsheetUrl: getSpreadsheet().getUrl() };
        break;
      case 'analyzeFood':
        result = analyzeFoodWithGemini(params.foodText, params.imageBase64, params.imageMimeType, params.date, params.time);
        break;
      case 'saveFood':
        result = saveFoodLogs(user, params.items);
        break;
      case 'updateFood':
        result = updateFoodLog(user, params.food);
        break;
      case 'deleteFood':
        result = deleteFoodLog(user, params.id);
        break;
      case 'getFoodLogs':
        result = getFoodLogs(user);
        break;
      case 'saveWeight':
        result = saveWeightLog(user, params.date, params.weight, params.note);
        break;
      case 'deleteWeight':
        result = deleteWeightLog(user, params.id);
        break;
      case 'getWeightLogs':
        result = getWeightLogs(user);
        break;
      case 'updateSettings':
        result = updateUserSettings(user, params.settings);
        break;
      default:
        return jsonResponse({ success: false, data: null, message: 'Action ' + action + ' tidak dikenal.' });
    }

    return jsonResponse({ success: true, data: result, message: 'Berhasil' });
  } catch (error) {
    return jsonResponse({ success: false, data: null, message: 'Server Error: ' + error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function verifyGoogleIdToken(idToken, userEmail, userId) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const allowedEmail = (scriptProperties.getProperty('ALLOWED_EMAIL') || '').toLowerCase().trim();

  // 1. Coba verifikasi Google ID Token resmi jika disertakan
  if (idToken) {
    try {
      const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        const payload = JSON.parse(response.getContentText());
        const email = (payload.email || '').toLowerCase().trim();
        const sub = payload.sub || userId;
        const name = payload.name || email.split('@')[0];

        if (allowedEmail && email !== allowedEmail) {
          return { valid: false, error: 'Akun (' + email + ') tidak memiliki akses. Aplikasi hanya untuk pemilik.' };
        }

        return { valid: true, user: { user_id: sub, email: email, name: name } };
      }
    } catch (err) {
      console.warn('Tokeninfo validation warning:', err.message);
    }
  }

  // 2. Persistent Session Fallback (Khusus Pemilik Aplikasi / Whitelisted User)
  // Memungkinkan aplikasi tetap update data secara realtime tanpa harus login ulang tiap 1 jam
  if (userEmail) {
    const cleanEmail = userEmail.toLowerCase().trim();
    if (!allowedEmail || cleanEmail === allowedEmail) {
      const safeSub = userId || 'user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      return {
        valid: true,
        user: {
          user_id: safeSub,
          email: cleanEmail,
          name: cleanEmail.split('@')[0]
        }
      };
    }
  }

  return { valid: false, error: 'Sesi autentikasi tidak valid atau sudah kadaluarsa. Silakan masuk kembali.' };
}

/**
 * Analisis Teks dan/atau Foto Makanan dengan Gemini Multimodal Vision API (Flash / Fast Models)
 */
function analyzeFoodWithGemini(foodText, imageBase64, imageMimeType, mealDate, mealTime) {
  if ((!foodText || foodText.trim() === '') && !imageBase64) {
    throw new Error('Teks makanan atau foto tidak boleh kosong.');
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const apiKey = scriptProperties.getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY belum dikonfigurasi di Script Properties Google Apps Script.');

  // Daftar model Flash resmi Google Gemini yang aktif & super cepat
  const candidateModels = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-8b',
    'gemini-2.5-flash',
    'gemini-3.7-flash'
  ];

  const systemInstruction = `Kamu adalah AI Nutritionist & Dietitian profesional untuk aplikasi pencatat diet di Indonesia.
Tugasmu adalah menganalisis foto makanan dan/atau teks makanan/minuman yang dikonsumsi pengguna dan memperkirakan rincian nutrisinya secara akurat.

ATURAN PENTING:
1. Ekstrak setiap makanan atau minuman menjadi item terpisah dalam array "items".
2. Tentukan perkiraan porsi (portion), kalori (calories dalam kkal), protein (dalam gram), karbohidrat (carbs dalam gram), lemak (fat dalam gram), dan serat (fiber dalam gram).
3. Semua nilai makronutrisi HARUS berupa bilangan bulat (integer non-negatif).
4. Berikan tingkat keyakinan (confidence): "high", "medium", atau "low".
5. Hitung total seluruh nutrisi di object "total".
6. Berikan kalimat catatan (note) bahwa nilai merupakan estimasi.
7. JANGAN menambahkan format markdown. Keluarkan HANYA string JSON murni yang valid sesuai format:
{
  "items": [
    {
      "food_name": "Nama Makanan",
      "portion": "1 porsi",
      "calories": 250,
      "protein": 15,
      "carbs": 30,
      "fat": 8,
      "fiber": 2,
      "confidence": "high"
    }
  ],
  "total": {
    "calories": 250,
    "protein": 15,
    "carbs": 30,
    "fat": 8,
    "fiber": 2
  },
  "note": "Estimasi kalori dan nutrisi makanan."
}`;

  const userParts = [];
  let promptText = foodText ? "Analisis makanan ini: " + foodText : "Tolong identifikasi dan analisis seluruh makanan pada foto ini:";
  userParts.push({ text: promptText });

  if (imageBase64) {
    userParts.push({
      inline_data: {
        mime_type: imageMimeType || 'image/jpeg',
        data: imageBase64
      }
    });
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts: userParts
      }
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.2,
      response_mime_type: "application/json"
    }
  };

  let lastErrorMsg = '';
  for (let m = 0; m < candidateModels.length; m++) {
    const model = candidateModels[m];
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(apiKey);

    try {
      const response = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (responseCode === 200) {
        const resJson = JSON.parse(responseText);
        if (resJson.candidates && resJson.candidates[0] && resJson.candidates[0].content) {
          let rawText = resJson.candidates[0].content.parts[0].text;
          
          // Bersihkan markdown backticks jika ada
          rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
          const parsedData = JSON.parse(rawText);

          const today = mealDate || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');
          const nowTime = mealTime || Utilities.formatDate(new Date(), 'GMT+7', 'HH:mm');

          if (parsedData.items && Array.isArray(parsedData.items)) {
            parsedData.items.forEach(item => {
              item.date = today;
              item.time = nowTime;
              item.source = imageBase64 ? 'gemini_vision' : 'gemini_text';
            });
          }

          return parsedData;
        }
      } else {
        lastErrorMsg = 'Model ' + model + ' (' + responseCode + '): ' + responseText;
        console.warn('Try next model. Error:', lastErrorMsg);
      }
    } catch (e) {
      lastErrorMsg = 'Error ' + model + ': ' + e.message;
      console.warn(lastErrorMsg);
    }
  }

  throw new Error('Gagal menganalisis dengan Gemini API: ' + lastErrorMsg);
}

function getSpreadsheet() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheetsInitialized() {
  const ss = getSpreadsheet();
  const schemas = [
    { name: SHEET_USERS, headers: ['user_id', 'email', 'name', 'created_at'] },
    { name: SHEET_FOOD_LOGS, headers: ['id', 'user_id', 'date', 'time', 'food_name', 'portion', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'source', 'created_at'] },
    { name: SHEET_WEIGHT_LOGS, headers: ['id', 'user_id', 'date', 'weight', 'note', 'created_at'] },
    { name: SHEET_SETTINGS, headers: ['user_id', 'calorie_target', 'protein_target', 'carbs_target', 'fat_target'] }
  ];

  schemas.forEach(schema => {
    let sheet = ss.getSheetByName(schema.name);
    if (!sheet) {
      sheet = ss.insertSheet(schema.name);
      sheet.appendRow(schema.headers);
      sheet.getRange(1, 1, 1, schema.headers.length).setFontWeight('bold').setBackground('#f1f5f9');
    }
  });
}

function getUserSettings(user) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(user.user_id)) {
      return {
        user_id: data[i][0],
        calorie_target: Number(data[i][1]) || 2000,
        protein_target: Number(data[i][2]) || 120,
        carbs_target: Number(data[i][3]) || 250,
        fat_target: Number(data[i][4]) || 65
      };
    }
  }
  const defaultSettings = { user_id: user.user_id, calorie_target: 2000, protein_target: 120, carbs_target: 250, fat_target: 65 };
  sheet.appendRow([defaultSettings.user_id, defaultSettings.calorie_target, defaultSettings.protein_target, defaultSettings.carbs_target, defaultSettings.fat_target]);
  return defaultSettings;
}

function updateUserSettings(user, settings) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  const data = sheet.getDataRange().getValues();
  let rowToUpdate = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(user.user_id)) { rowToUpdate = i + 1; break; }
  }
  const values = [user.user_id, Number(settings.calorie_target || 2000), Number(settings.protein_target || 120), Number(settings.carbs_target || 250), Number(settings.fat_target || 65)];
  if (rowToUpdate > 0) sheet.getRange(rowToUpdate, 1, 1, 5).setValues([values]);
  else sheet.appendRow(values);
  return { success: true };
}

function saveFoodLogs(user, items) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_FOOD_LOGS);
  const now = new Date().toISOString();
  const rows = items.map(item => [
    'food_' + Utilities.getUuid(),
    user.user_id,
    item.date || now.split('T')[0],
    item.time || new Date().toTimeString().slice(0, 5),
    item.food_name || 'Makanan',
    item.portion || '1 porsi',
    Number(item.calories) || 0,
    Number(item.protein) || 0,
    Number(item.carbs) || 0,
    Number(item.fat) || 0,
    Number(item.fiber) || 0,
    item.source || 'gemini_ai',
    now
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return { savedCount: rows.length };
}

function getFoodLogs(user) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_FOOD_LOGS);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const logs = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(user.user_id)) {
      logs.push({
        id: String(data[i][0]),
        user_id: data[i][1],
        date: formatDateString(data[i][2]),
        time: String(data[i][3]),
        food_name: String(data[i][4]),
        portion: String(data[i][5]),
        calories: Number(data[i][6]) || 0,
        protein: Number(data[i][7]) || 0,
        carbs: Number(data[i][8]) || 0,
        fat: Number(data[i][9]) || 0,
        fiber: Number(data[i][10]) || 0,
        source: data[i][11],
        created_at: data[i][12]
      });
    }
  }
  logs.sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`));
  return logs;
}

function updateFoodLog(user, food) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_FOOD_LOGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(food.id) && String(data[i][1]) === String(user.user_id)) {
      const row = i + 1;
      sheet.getRange(row, 5).setValue(food.food_name);
      sheet.getRange(row, 6).setValue(food.portion);
      sheet.getRange(row, 7).setValue(Number(food.calories) || 0);
      sheet.getRange(row, 8).setValue(Number(food.protein) || 0);
      sheet.getRange(row, 9).setValue(Number(food.carbs) || 0);
      sheet.getRange(row, 10).setValue(Number(food.fat) || 0);
      return { success: true };
    }
  }
  throw new Error('Data makanan tidak ditemukan.');
}

function deleteFoodLog(user, foodId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_FOOD_LOGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(foodId) && String(data[i][1]) === String(user.user_id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('Data tidak ditemukan.');
}

function saveWeightLog(user, date, weight, note) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_WEIGHT_LOGS);
  const logId = 'w_' + Utilities.getUuid();
  const now = new Date().toISOString();
  sheet.appendRow([logId, user.user_id, date || now.split('T')[0], Number(weight), note || '', now]);
  return { id: logId, weight: weight };
}

function getWeightLogs(user) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_WEIGHT_LOGS);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const logs = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(user.user_id)) {
      logs.push({
        id: String(data[i][0]),
        user_id: data[i][1],
        date: formatDateString(data[i][2]),
        weight: Number(data[i][3]),
        note: String(data[i][4] || ''),
        created_at: data[i][5]
      });
    }
  }
  return logs;
}

function deleteWeightLog(user, weightId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_WEIGHT_LOGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(weightId) && String(data[i][1]) === String(user.user_id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('Data berat badan tidak ditemukan.');
}

function getDashboardData(user) {
  const settings = getUserSettings(user);
  const foodLogs = getFoodLogs(user);
  const weightLogs = getWeightLogs(user);
  const ss = getSpreadsheet();

  const todayStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');
  const todayLogs = foodLogs.filter(f => f.date === todayStr);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = Utilities.formatDate(sevenDaysAgo, 'GMT+7', 'yyyy-MM-dd');
  const logs7d = foodLogs.filter(f => f.date >= sevenDaysAgoStr && f.date <= todayStr);
  
  const uniqueDays = [...new Set(logs7d.map(f => f.date))];
  const divisor = uniqueDays.length > 0 ? uniqueDays.length : 1;

  let totCal7d = 0, totPro7d = 0;
  logs7d.forEach(f => {
    totCal7d += (f.calories || 0);
    totPro7d += (f.protein || 0);
  });

  const sortedWeight = [...weightLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
  let lastWeight = null, weightChange = 0;

  if (sortedWeight.length > 0) {
    lastWeight = sortedWeight[sortedWeight.length - 1].weight;
    if (sortedWeight.length > 1) {
      weightChange = lastWeight - sortedWeight[0].weight;
    }
  }

  return {
    user: user,
    settings: settings,
    spreadsheetUrl: ss ? ss.getUrl() : 'https://drive.google.com',
    dashboard: {
      settings: settings,
      todayLogs: todayLogs,
      sevenDaysSummary: {
        avgCalories: Math.round(totCal7d / divisor),
        avgProtein: Math.round(totPro7d / divisor),
        lastWeight: lastWeight,
        weightChange: weightChange
      }
    },
    foodLogs: foodLogs,
    weightLogs: weightLogs
  };
}

function formatDateString(val) {
  if (val instanceof Date) return Utilities.formatDate(val, 'GMT+7', 'yyyy-MM-dd');
  return String(val || '');
}
