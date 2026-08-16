/**
 * DietSaya - Authentication Module
 * Menggunakan Google Identity Services (GIS) dengan Auto-Login Persistent (LocalStorage).
 * User tidak perlu login ulang setiap kali membuka aplikasi, dan token diperbarui otomatis di background.
 */

const AuthModule = (() => {
  const GOOGLE_CLIENT_ID = "446360710878-kg53d5r5ljtjh79ekjo5p069apknm9l0.apps.googleusercontent.com";

  let currentUser = null;
  let currentIdToken = null;
  let isRefreshingToken = false;

  function parseJwt(token) {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  function isTokenExpired(token) {
    if (!token) return true;
    const payload = parseJwt(token);
    if (!payload || !payload.exp) return true;
    // Anggap expired jika sisa waktu kurang dari 5 menit
    return (payload.exp * 1000) < (Date.now() + 5 * 60 * 1000);
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

        // Langsung tampilkan dashboard tanpa menunggu proses login ulang
        updateHeaderAndProfile(currentUser, null);
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');

        // OPTIMASI: Muat data dari cache lokal secara instan (0ms)
        const savedDataStr = localStorage.getItem('dietsaya_cached_data');
        if (savedDataStr) {
          try {
            const cachedData = JSON.parse(savedDataStr);
            App.initAppData(cachedData);
          } catch (e) {}
        }

        // Sinkronisasi diam-diam di background
        App.refreshAllData().catch(err => console.log('Background initial sync:', err));
      } catch (e) {
        console.error('Failed to restore saved session:', e);
      }
    }

    // 2. Inisialisasi Google Identity SDK untuk background token refresh & tombol login
    setupGoogleIdentitySDK(savedUserStr, savedToken);
  }

  function setupGoogleIdentitySDK(savedUserStr, savedToken) {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        auto_select: true, // Otomatis login/perbarui token tanpa interupsi
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

      // Jika belum ada user tersimpan atau token sudah expired, coba one-tap prompt di background
      if (!savedUserStr || isTokenExpired(savedToken)) {
        try {
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              console.log('Google One-Tap prompt status:', notification.getNotDisplayedReason() || notification.getSkippedReason());
            }
          });
        } catch (err) {
          console.warn('One-tap prompt error:', err);
        }
      }
    } else {
      setTimeout(() => setupGoogleIdentitySDK(savedUserStr, savedToken), 300);
    }
  }

  /**
   * Callback setelah user memilih akun Google atau setelah silent auto_select
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
      picture: profile?.picture || '',
      sub: profile?.sub || ''
    };

    // Simpan ke localStorage agar sesi tetap bertahan permanen
    localStorage.setItem('diet_id_token', idToken);
    localStorage.setItem('diet_user_profile', JSON.stringify(currentUser));

    isRefreshingToken = false;

    // Pastikan UI menampilkan data pengguna terbaru
    updateHeaderAndProfile(currentUser, null);
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');

    // Tarik data terbaru
    await App.refreshAllData();
  }

  /**
   * Memperbarui token di background saat token lama expired
   */
  function handleTokenExpired() {
    if (isRefreshingToken) return;
    isRefreshingToken = true;
    console.log("Mencoba memperbarui token Google di background...");

    if (window.google && window.google.accounts) {
      try {
        window.google.accounts.id.prompt((notification) => {
          isRefreshingToken = false;
        });
      } catch (e) {
        isRefreshingToken = false;
      }
    } else {
      isRefreshingToken = false;
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
    handleTokenExpired,
    logout
  };
})();
