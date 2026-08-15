/**
 * DietSaya - Authentication Module
 * Menggunakan Google Identity Services (GIS) OAuth 2.0 ID Token.
 * Keamanan: ID Token diverifikasi langsung di server Google Apps Script.
 */

const AuthModule = (() => {
  // Masukkan Google OAuth Web Client ID Anda dari Google Cloud Console
  const GOOGLE_CLIENT_ID = "446360710878-kg53d5r5ljtjh79ekjo5p069apknm9l0.apps.googleusercontent.com";

  let currentUser = null;
  let currentIdToken = null;

  /**
   * Parse payload JWT dari Google ID Token
   */
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("Gagal membaca payload JWT:", e);
      return null;
    }
  }

  /**
   * Inisialisasi Google Sign-In Button
   */
  function initGoogleAuth() {
    // Periksa token tersimpan di sessionStorage
    const savedToken = sessionStorage.getItem('diet_id_token');
    if (savedToken) {
      currentIdToken = savedToken;
      const profile = parseJwt(savedToken);
      if (profile && profile.exp * 1000 > Date.now()) {
        currentUser = {
          name: profile.name,
          email: profile.email,
          picture: profile.picture
        };
        verifyAndLaunchApp(savedToken);
        return;
      } else {
        sessionStorage.removeItem('diet_id_token');
      }
    }

    if (window.google && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
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
    } else {
      setTimeout(initGoogleAuth, 300);
    }
  }

  /**
   * Callback setelah user memilih akun Google di popup/button
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
      // Simpan session
      sessionStorage.setItem('diet_id_token', token);
      
      // Update UI Profil
      updateHeaderAndProfile(currentUser, result.data.settings);

      // Tampilkan App Container, sembunyikan Login Screen
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-container').classList.remove('hidden');

      // Load data dashboard & inisialisasi aplikasi
      App.initAppData(result.data);
      App.showToast(`Selamat datang, ${currentUser.name}!`, "success");
    } else {
      sessionStorage.removeItem('diet_id_token');
      showAuthError(result.message || "Akun tidak memiliki akses ke sistem ini.");
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('app-container').classList.add('hidden');
    }
  }

  function updateHeaderAndProfile(user, settings) {
    if (!user) return;
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-email').textContent = user.email;
    
    if (user.picture) {
      document.getElementById('user-avatar').src = user.picture;
      document.getElementById('profile-avatar').src = user.picture;
    }

    if (settings) {
      document.getElementById('target-calories').value = settings.calorie_target || 2000;
      document.getElementById('target-protein').value = settings.protein_target || 120;
      document.getElementById('target-carbs').value = settings.carbs_target || 250;
      document.getElementById('target-fat').value = settings.fat_target || 65;
    }
  }

  function showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function hideAuthError() {
    const errorEl = document.getElementById('auth-error');
    errorEl.classList.add('hidden');
  }

  function logout() {
    sessionStorage.removeItem('diet_id_token');
    currentUser = null;
    currentIdToken = null;
    if (window.google && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    App.showToast("Anda telah keluar.", "info");
  }

  return {
    init: initGoogleAuth,
    getUser: () => currentUser,
    getIdToken: () => currentIdToken,
    logout
  };
})();
