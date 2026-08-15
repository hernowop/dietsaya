/**
 * DietSaya - Authentication Module
 * Menggunakan Google Identity Services (GIS) dengan Auto-Login Persistent (LocalStorage).
 * User tidak perlu login ulang setiap kali membuka aplikasi.
 */

const AuthModule = (() => {
  const GOOGLE_CLIENT_ID = "446360710878-kg53d5r5ljtjh79ekjo5p069apknm9l0.apps.googleusercontent.com";

  let currentUser = null;
  let currentIdToken = null;

  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  /**
   * Inisialisasi Auth & Auto-Login
   */
  async function initGoogleAuth() {
    // 1. Cek apakah ada sesi login tersimpan di localStorage
    const savedToken = localStorage.getItem('diet_id_token');
    const savedUserStr = localStorage.getItem('diet_user_profile');

    if (savedUserStr) {
      try {
        currentUser = JSON.parse(savedUserStr);
        currentIdToken = savedToken || '';

        // Langsung tampilkan dashboard tanpa menunggu
        updateHeaderAndProfile(currentUser, null);
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');

        // Refresh data di background
        App.refreshAllData().catch(err => console.log('Background sync:', err));
      } catch (e) {
        console.error('Failed to restore saved session:', e);
      }
    }

    // 2. Inisialisasi Google Identity SDK untuk background token refresh & button
    if (window.google && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        auto_select: true, // Otomatis login jika sudah pernah login sebelumnya
        cancel_on_tap_outside: true
      });

      const btnContainer = document.getElementById('google-signin-btn');
      if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'filled_blue',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 280
        });
      }

      // Jika belum ada user tersimpan, coba one-tap prompt
      if (!savedUserStr) {
        window.google.accounts.id.prompt();
      }
    } else {
      setTimeout(initGoogleAuth, 300);
    }
  }

  /**
   * Callback setelah user memilih akun Google
   */
  async function handleGoogleCredentialResponse(response) {
    const idToken = response.credential;
    if (!idToken) {
      showAuthError("Gagal menerima kredensial Google.");
      return;
    }

    currentIdToken = idToken;
    const profile = parseJwt(idToken);
    currentUser = {
      name: profile?.name || 'User',
      email: profile?.email || '',
      picture: profile?.picture || ''
    };

    // Simpan ke localStorage agar tidak perlu login ulang
    localStorage.setItem('diet_id_token', idToken);
    localStorage.setItem('diet_user_profile', JSON.stringify(currentUser));

    await verifyAndLaunchApp(idToken);
  }

  /**
   * Verifikasi token ke Google Apps Script Backend
   */
  async function verifyAndLaunchApp(token) {
    App.showLoading("Memverifikasi otorisasi akun...");
    hideAuthError();

    const result = await Api.request('verifyUser', { idToken: token });
    App.hideLoading();

    if (result.success && result.data) {
      updateHeaderAndProfile(currentUser, result.data.settings);

      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-container').classList.remove('hidden');

      App.initAppData(result.data);
      App.showToast(`Selamat datang, ${currentUser.name}!`, "success");
    } else {
      // Jika akun ditolak oleh backend (bukan akun pemilik)
      if (result.message && result.message.includes('tidak memiliki akses')) {
        logout();
        showAuthError(result.message);
      }
    }
  }

  function updateHeaderAndProfile(user, settings) {
    if (!user) return;
    const nameEl = document.getElementById('user-name');
    const pNameEl = document.getElementById('profile-name');
    const pEmailEl = document.getElementById('profile-email');
    const avatarEl = document.getElementById('user-avatar');
    const pAvatarEl = document.getElementById('profile-avatar');

    if (nameEl) nameEl.textContent = user.name;
    if (pNameEl) pNameEl.textContent = user.name;
    if (pEmailEl) pEmailEl.textContent = user.email;
    
    if (user.picture) {
      if (avatarEl) avatarEl.src = user.picture;
      if (pAvatarEl) pAvatarEl.src = user.picture;
    }

    if (settings) {
      const calEl = document.getElementById('target-calories');
      const proEl = document.getElementById('target-protein');
      const carEl = document.getElementById('target-carbs');
      const fatEl = document.getElementById('target-fat');

      if (calEl) calEl.value = settings.calorie_target || 2000;
      if (proEl) proEl.value = settings.protein_target || 120;
      if (carEl) carEl.value = settings.carbs_target || 250;
      if (fatEl) fatEl.value = settings.fat_target || 65;
    }
  }

  function showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  function hideAuthError() {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) errorEl.classList.add('hidden');
  }

  function logout() {
    localStorage.removeItem('diet_id_token');
    localStorage.removeItem('diet_user_profile');
    sessionStorage.clear();
    currentUser = null;
    currentIdToken = null;

    if (window.google && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }

    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    App.showToast("Anda telah keluar dari akun.", "info");
  }

  return {
    init: initGoogleAuth,
    getUser: () => currentUser,
    getIdToken: () => currentIdToken || localStorage.getItem('diet_id_token'),
    logout
  };
})();
