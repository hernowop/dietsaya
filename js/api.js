/**
 * DietSaya - API Client Layer
 * Berkomunikasi dengan Google Apps Script Web App Backend.
 */

const Api = (() => {
  // Ganti URL ini dengan URL Google Apps Script Web App hasil deploy Anda
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzfUmLQdpOjreQScyKMf-ubqoXqbxtIhkzNHprrbnZyT2fR5iacaCMqj3yXSuccWgul/exec";

  /**
   * Mengirim request ke Apps Script Web App
   * @param {string} action - Nama action backend (misal: 'analyzeFood', 'saveFood', dll)
   * @param {object} payload - Data payload yang akan dikirim
   * @param {string} method - 'GET' atau 'POST'
   * @returns {Promise<object>} Response JSON { success, data, message }
   */
  async function request(action, payload = {}, method = 'POST') {
    const idToken = AuthModule.getIdToken();
    if (!idToken && action !== 'verifyUser') {
      console.warn("Permintaan API dibatalkan: ID Token Google belum tersedia.");
    }

    // Gabungkan token ke dalam request payload
    const requestData = {
      action: action,
      idToken: idToken,
      ...payload
    };

    try {
      let response;
      if (method === 'GET') {
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(requestData)) {
          queryParams.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        }
        response = await fetch(`${APPS_SCRIPT_URL}?${queryParams.toString()}`, {
          method: 'GET',
          mode: 'cors'
        });
      } else {
        // Apps Script Web App menangani POST dengan text/plain payload untuk menghindari CORS preflight block
        response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(requestData)
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`[API Error - ${action}]:`, error);
      return {
        success: false,
        data: null,
        message: error.message || 'Gagal terhubung ke server backend Apps Script.'
      };
    }
  }

  return {
    getScriptUrl: () => APPS_SCRIPT_URL,
    setScriptUrl: (url) => { /* Helper jika ingin ganti dinamis */ },
    request
  };
})();
