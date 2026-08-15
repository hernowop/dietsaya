/**
 * DietSaya - Love & Dedication Module
 * Spesial Dibuat oleh Hernowo agar Ikaaa bahagia ❤️
 * Menyediakan animasi lope-lope (floating hearts), audio chime cinta, dan efek interaktif yang mencolok!
 */

const LoveModule = (() => {
  let loveCount = parseInt(localStorage.getItem('ikad_love_count') || '100', 10);

  const sweetMessages = [
    "Hernowo sayang Ikaaa selamanya! 💍❤️",
    "Istri paling cantik & terbaik di seluruh dunia! 👑✨",
    "Semangat hidup sehat ya sayang, Ikaaa selalu jadi prioritasku! 🌸",
    "1000% cinta tulus dari suamimu, Hernowo! 🥰",
    "Setiap baris kode ini ditulis spesial buat Ikaaa bahagia! 💻💖",
    "Ikaaa tersayang, terima kasih sudah hadir di hidup Hernowo! 🌹",
    "Senyuman Ikaaa adalah kebahagiaan terbesar buat Hernowo! ✨",
    "Love you to the moon and back, My Wife Ikaaa! 🚀💞"
  ];

  const heartIcons = ['💖', '💕', '💗', '💓', '💞', '❤️', '💘', '💝', '🌸', '✨', '😍', '🥰'];

  /**
   * Mainkan chime romantis menggunakan Web Audio API
   */
  function playSweetChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6 (Sweet Arpeggio)
      const now = ctx.currentTime;
      
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);
        
        gain.gain.setValueAtTime(0, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, now + index * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.55);
      });
    } catch (e) {
      console.log('Audio chime not allowed yet:', e);
    }
  }

  /**
   * Ledakan animasi lope-lope (Floating Hearts Confetti) ke seluruh layar
   */
  function burstHearts(e) {
    if (e && e.stopPropagation) e.stopPropagation();

    // Mainkan sound effect
    playSweetChime();

    // Increment love counter
    loveCount += 1;
    localStorage.setItem('ikad_love_count', loveCount);
    updateLoveCounterUI();

    // Tampilkan pesan cinta romantis acak
    const randomMsg = sweetMessages[Math.floor(Math.random() * sweetMessages.length)];
    showLoveToast(randomMsg);

    // Ambil posisi klik atau posisi tengah jika dari button
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight * 0.65;

    if (e && e.clientX && e.clientY) {
      startX = e.clientX;
      startY = e.clientY;
    }

    // Buat puluhan lope-lope melayang ke atas
    const numHearts = 26;
    for (let i = 0; i < numHearts; i++) {
      createSingleHeart(startX, startY);
    }
  }

  function createSingleHeart(originX, originY) {
    const heart = document.createElement('div');
    heart.className = 'floating-screen-heart';
    heart.textContent = heartIcons[Math.floor(Math.random() * heartIcons.length)];
    
    // Posisi awal acak di sekitar klik
    const offsetX = (Math.random() - 0.5) * 140;
    const offsetY = (Math.random() - 0.5) * 50;
    
    heart.style.left = `${originX + offsetX}px`;
    heart.style.top = `${originY + offsetY}px`;
    
    // Kecepatan & ukuran acak
    const size = Math.random() * 22 + 18; // 18px - 40px
    const duration = Math.random() * 1.5 + 1.8; // 1.8s - 3.3s
    const driftX = (Math.random() - 0.5) * 220; // Drift horizontal
    const rot = (Math.random() - 0.5) * 70; // Derajat putar

    heart.style.fontSize = `${size}px`;
    heart.style.setProperty('--drift-x', `${driftX}px`);
    heart.style.setProperty('--rot-deg', `${rot}deg`);
    heart.style.animationDuration = `${duration}s`;

    document.body.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, duration * 1000);
  }

  /**
   * Menampilkan toast manis khusus bernuansa cinta
   */
  function showLoveToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-love-popup';
    toast.innerHTML = `<span class="love-toast-icon">💖</span> <span class="love-toast-msg">${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.95)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  /**
   * Update tampilan counter cinta
   */
  function updateLoveCounterUI() {
    const counterEl = document.getElementById('love-counter-value');
    if (counterEl) {
      counterEl.textContent = loveCount.toLocaleString('id-ID');
      counterEl.classList.remove('pulse-pop');
      void counterEl.offsetWidth; // trigger reflow
      counterEl.classList.add('pulse-pop');
    }
  }

  /**
   * Animasi lope-lope ambient di dalam kartu profil
   */
  function initAmbientCardHearts() {
    const container = document.getElementById('love-ambient-hearts');
    if (!container) return;

    setInterval(() => {
      if (document.hidden) return;
      const targetView = document.getElementById('view-profil');
      if (!targetView || !targetView.classList.contains('active')) return;

      const heart = document.createElement('span');
      heart.className = 'ambient-card-heart';
      heart.textContent = heartIcons[Math.floor(Math.random() * heartIcons.length)];
      
      heart.style.left = `${Math.random() * 90 + 5}%`;
      const size = Math.random() * 10 + 14;
      heart.style.fontSize = `${size}px`;
      const duration = Math.random() * 1.8 + 2.4;
      heart.style.animationDuration = `${duration}s`;

      container.appendChild(heart);
      setTimeout(() => heart.remove(), duration * 1000);
    }, 550);
  }

  /**
   * Inisialisasi saat aplikasi dimuat
   */
  function init() {
    updateLoveCounterUI();
    initAmbientCardHearts();
  }

  return {
    init,
    burstHearts,
    playSweetChime
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  LoveModule.init();
});
