/**
 * DietSaya - API Client Layer
 * Berkomunikasi dengan Google Apps Script Web App Backend secara realtime & persistent.
 */

const Api = (() => {
  // Ganti URL ini dengan URL Google Apps Script Web App hasil deploy Anda
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzfUmLQdpOjreQScyKMf-ubqoXqbxtIhkzNHprrbnZyT2fR5iacaCMqj3yXSuccWgul/exec";

  /**
   * Mengirim request ke Apps Script Web App
   * @param {string} action - Nama action backend (misal: 'getDashboardData', 'saveFood', dll)
   * @param {object} payload - Data payload yang akan dikirim
   * @param {string} method - 'POST' (disarankan untuk kompatibilitas Apps Script)
   * @returns {Promise<object>} Response JSON { success, data, message }
   */
  async function request(action, payload = {}, method = 'POST') {
    const user = (typeof AuthModule !== 'undefined') ? AuthModule.getUser() : null;
    const idToken = (typeof AuthModule !== 'undefined') ? AuthModule.getIdToken() : '';

    // Gabungkan kredensial & timestamp untuk mencegah browser caching
    const requestData = {
      action: action,
      idToken: idToken || '',
      userEmail: user?.email || '',
      userId: user?.sub || user?.id || user?.user_id || '',
      _t: Date.now(),
      ...payload
    };

    try {
      // Menggunakan POST dengan text/plain payload untuk menghindari CORS preflight block
      // serta mencegah pemotongan data query URL di Google Apps Script
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-store',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Jika ada respon token expired dari backend, coba picu silent refresh di auth module
      if (!result.success && result.message && (result.message.includes('kadaluarsa') || result.message.includes('expired'))) {
        if (typeof AuthModule !== 'undefined' && AuthModule.handleTokenExpired) {
          AuthModule.handleTokenExpired();
        }
      }

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
