// ── GLOBAL APPLICATION STATE ──
let sessions = [];
let activeCode = ''; // Currently validated code
let capturedImages = []; // Stores 4 base64 images from camera
let localStream = null;
let digitalShareUrl = '';
const syncChannel = new BroadcastChannel('photobooth-sync');
let isServerMode = false;
let serverUrl = '';

// Editor Settings
let currentLayout = '4cut'; // '4cut' or '2x2'
let currentFrameTheme = 'white'; // 'white', 'ink', 'black'
let currentReceiptTheme = 'kopimigi'; // 'kopimigi', 'purchase', 'mail'
let currentPhotoArrangement = 'story'; // 'story' or 'grid'
let currentPhotoBackground = 'original'; // 'original', 'white', 'burst'
let currentSingleFrameShape = 'rounded'; // 'rounded', 'circle', 'scallop'
let currentFilter = 'bw'; // final booth output is monochrome for thermal printing
let currentFontFamily = 'mono'; // 'mono', 'serif', 'hand'
let placedStickers = []; // List of placed sticker objects
let stickerIdCounter = 0;
let activeSelectedSticker = null;

// Photo session settings
let selectedPhotoCount = 4; // 1, 2, or 4
let currentPrintQuantity = 1;
let retakeUsed = []; // tracks if retake has been used for each slot
let retakeTargetIndex = -1; // which photo slot is being retaken
let reviewSelectedSlot = 1;
let autoFinishTimer = null;
let liveReceiptPreviewTimer = null;
let liveReceiptPreviewSeq = 0;
let printAnimationTimer = null;
let isCameraMirrored = true;
let photoFrameOffsets = [];
let suppressPhotoHotspotClick = false;
let selfieSegmentation = null;
let selfieSegmentationReady = null;
const backgroundRemovalCache = new Map();
const MAX_PRINT_QUANTITY = 4;
const THERMAL_CUT_GUIDE_BOTTOM_PADDING = 4;
const THERMAL_POST_PRINT_FEED_DOTS = 144;
const PRINT_ANIMATION_FINAL_PROGRESS = 0.94;
const PACKAGE_PHOTO_COUNTS = {
  single: 1,
  couple: 1,
  classic: 2,
  premium: 4
};
const receiptThemes = ['kopimigi', 'purchase', 'mail', 'simple'];

// Sound Effects Engine using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(freq = 880, duration = 0.1, type = 'sine') {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playCameraShutter() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  // Noise buffer for mechanical shutter sound
  const bufferSize = audioCtx.sampleRate * 0.25; // 0.25s
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = buffer;
  
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1000;
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
  
  noiseNode.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  noiseNode.start();
}

// ── SYNC LOGIC ──
function setSyncBadge(text, className) {
  const textEl = document.getElementById('booth-sync-text');
  const dotEl = document.getElementById('booth-sync-dot');
  if (textEl) textEl.textContent = text;
  if (dotEl) dotEl.className = className;
}

setSyncBadge('Mencari Server...', 'status-dot local-only');

function loadLocalSessions() {
  const stored = localStorage.getItem('pb_sessions');
  if (stored) {
    sessions = JSON.parse(stored);
  }
}

// Listen to sync updates
syncChannel.onmessage = function(e) {
  const { action, data, sender } = e.data;
  console.log("Broadcast received at Booth:", e.data);

  if (sender === 'cashier') {
    if (action === 'update_sessions') {
      sessions = data;
      localStorage.setItem('pb_sessions', JSON.stringify(sessions));
    }
    else if (action === 'code_claimed_ok') {
      if (activeCode === data.code) {
        const activeSession = sessions.find(s => s.code === activeCode);
        applySessionPackageSettings(activeSession);
        document.getElementById('login-msg-ok').style.display = 'flex';
        document.getElementById('login-msg-err').style.display = 'none';
        
        setTimeout(() => {
          transitionScreen('screen-login', 'screen-camera');
          initWebcam();
        }, 250);
      }
    }
  }
};

// Request initial list from Cashier
async function requestInitialSync() {
  loadLocalSessions();
  syncChannel.postMessage({ action: 'request_sync', sender: 'booth' });

  try {
    const res = await fetch('/api/sessions', { cache: 'no-store' });
    if (res.ok) {
      sessions = await res.json();
      localStorage.setItem('pb_sessions', JSON.stringify(sessions));
      isServerMode = true;
      setSyncBadge('Server Sync', 'status-dot online');
      setInterval(fetchSessionsFromServer, 3000);
      return;
    }
  } catch (err) {
    console.warn('Server sync unavailable, using local fallback:', err);
  }

  isServerMode = false;
  setSyncBadge('Local Sync', 'status-dot local-only');
}

function startServerPolling() {
  if (isServerMode) {
    fetchSessionsFromServer();
  }
}

async function fetchSessionsFromServer() {
  try {
    const res = await fetch('/api/sessions');
    if (res.ok) {
      sessions = await res.json();
      localStorage.setItem('pb_sessions', JSON.stringify(sessions));
      const currentSession = sessions.find(s => s.code === activeCode);
      const resultScreen = document.getElementById('screen-result');
      if (currentSession?.status === 'used' && resultScreen?.style.display !== 'none') {
        scheduleSessionAutoFinish('Cetak selesai di kasir. Sesi selesai dalam 10 detik...');
      }
    }
  } catch (err) {
    console.warn("Failed to contact local API server:", err);
  }
}

async function sendServerAction(action, code, payload = {}) {
  if (!isServerMode) return false;
  try {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, code, ...payload })
    });
    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        sessions = result.sessions;
        localStorage.setItem('pb_sessions', JSON.stringify(sessions));
        return true;
      }
    }
  } catch (err) {
    console.error("Failed sending server action:", err);
  }
  return false;
}

// ── SCREEN TRANSITIONS ──
function getScreenDisplay(screenId) {
  return screenId === 'screen-login' ? 'flex' : 'block';
}

function resetLoginMessages() {
  const okBox = document.getElementById('login-msg-ok');
  const errBox = document.getElementById('login-msg-err');
  const inputEl = document.getElementById('booth-input-code');
  if (okBox) okBox.style.display = 'none';
  if (errBox) errBox.style.display = 'none';
  if (inputEl) inputEl.classList.remove('shake');
}

function photoCountFromSession(session) {
  const fromSession = Number(session?.photoCount);
  if ([1, 2, 4].includes(fromSession)) return fromSession;
  return PACKAGE_PHOTO_COUNTS[String(session?.package || '').toLowerCase()] || 4;
}

function applySessionPackageSettings(session) {
  const count = photoCountFromSession(session);
  const printQty = Number(session?.printQuantity) || 1;
  currentPrintQuantity = Math.max(1, Math.min(MAX_PRINT_QUANTITY, printQty));
  const countButton = document.querySelector(`.photo-count-btn[data-photo-count="${count}"]`);
  setPhotoCount(count, countButton);
  const note = document.getElementById('print-qty-note');
  if (note) note.textContent = `Jumlah cetak: ${currentPrintQuantity}x (dari kasir)`;
  document.querySelectorAll('.photo-count-btn').forEach((button) => {
    button.disabled = true;
    button.title = 'Jumlah foto mengikuti paket kasir';
  });
}

function transitionScreen(fromId, toId) {
  const fromEl = document.getElementById(fromId);
  const toEl = document.getElementById(toId);
  
  fromEl.style.opacity = 0;
  setTimeout(() => {
    fromEl.style.display = 'none';
    if (toId === 'screen-login') resetLoginMessages();
    toEl.style.display = getScreenDisplay(toId);
    toEl.style.opacity = 0;
    toEl.offsetHeight; // force reflow
    toEl.style.opacity = 1;
    toEl.style.transition = 'opacity 0.4s ease';
  }, 300);
}

function focusBoothCode() {
  const input = document.getElementById('booth-input-code');
  if (input) input.focus();
}

async function toggleBoothFullscreen(event) {
  event?.stopPropagation();
  const btn = document.getElementById('btn-fullscreen-booth');
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
    } else {
      await document.exitFullscreen();
      if (btn) {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    }
  } catch (err) {
    alert('Fullscreen tidak didukung browser ini. Di Android, coba Chrome/Brave terbaru atau Add to Home Screen.');
  }
}

document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('btn-fullscreen-booth');
  if (!btn) return;
  btn.classList.toggle('active', Boolean(document.fullscreenElement));
  btn.setAttribute('aria-pressed', document.fullscreenElement ? 'true' : 'false');
});

// ── VERIFY CODE ──
async function verifyCode() {
  const inputEl = document.getElementById('booth-input-code');
  const code = inputEl.value.trim().toUpperCase();
  
  const errBox = document.getElementById('login-msg-err');
  const okBox = document.getElementById('login-msg-ok');
  
  errBox.style.display = 'none';
  okBox.style.display = 'none';
  inputEl.classList.remove('shake');
  
  if (!code) return;
  
  if (isServerMode) {
    // Contact server to claim code
    const success = await sendServerAction('claim', code);
    if (success) {
      activeCode = code;
      applySessionPackageSettings(sessions.find(s => s.code === code));
      okBox.style.display = 'flex';
      setTimeout(() => {
        transitionScreen('screen-login', 'screen-camera');
        initWebcam();
      }, 250);
    } else {
      errBox.style.display = 'flex';
      inputEl.classList.add('shake');
      inputEl.value = '';
      inputEl.focus();
    }
  } else {
    // Local / tab sync
    loadLocalSessions();
    const sessionIndex = sessions.findIndex(s => s.code === code && s.status === 'unused');
    
    if (sessionIndex !== -1) {
      activeCode = code;
      applySessionPackageSettings(sessions[sessionIndex]);
      
      // Mark code as active locally
      sessions[sessionIndex].status = 'active';
      localStorage.setItem('pb_sessions', JSON.stringify(sessions));
      
      // Notify cashier tab to claim
      syncChannel.postMessage({ action: 'claim_code', data: { code }, sender: 'booth' });
      
      // Wait for cashier acknowledgment or timeout
      setTimeout(() => {
        // If cashier tab was closed, proceed anyway as fallback
        if (activeCode === code && document.getElementById('screen-camera').style.display === 'none') {
          okBox.style.display = 'flex';
          setTimeout(() => {
            transitionScreen('screen-login', 'screen-camera');
            initWebcam();
          }, 250);
        }
      }, 400);
    } else {
      errBox.style.display = 'flex';
      inputEl.classList.add('shake');
      inputEl.value = '';
      inputEl.focus();
    }
  }
}

// ── WEBCAM OPERATIONS ──
async function initWebcam() {
  const video = document.getElementById('webcam-feed');
  const startBtn = document.getElementById('btn-start-capture');
  const screenSubtitle = document.getElementById('camera-screen-subtitle');
  try {
    if (startBtn) startBtn.disabled = true;
    if (screenSubtitle) screenSubtitle.textContent = 'Menyalakan kamera...';
    stopWebcam();
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 960, facingMode: "user" },
      audio: false
    });
    video.srcObject = localStream;
    await video.play().catch(() => {});
    // Preview langsung grayscale — sesuai hasil thermal printer
    video.style.filter = 'grayscale(1) contrast(1.1) brightness(1.02)';
    updateCameraPanPreview();
    if (screenSubtitle) screenSubtitle.textContent = 'Ambil foto terbaikmu secara otomatis';
    if (startBtn) startBtn.disabled = false;
  } catch (err) {
    console.error("Camera access failed:", err);
    alert("Kamera tidak dapat diakses. Mohon beri izin akses webcam.");
    exitCameraScreen();
  }
}

function updateCameraPanPreview() {
  const video = document.getElementById('webcam-feed');
  if (!video) return;
  const mirror = isCameraMirrored ? -1 : 1;
  video.style.transform = `scaleX(${mirror}) scale(1)`;
}

function toggleCameraMirror() {
  isCameraMirrored = !isCameraMirrored;
  const btn = document.getElementById('btn-camera-mirror');
  if (btn) {
    btn.classList.toggle('active', isCameraMirrored);
    btn.textContent = isCameraMirrored ? 'Mirror' : 'Normal';
  }
  updateCameraPanPreview();
}

function stopWebcam() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
}

function releaseActiveSessionCode() {
  if (activeCode) {
    if (isServerMode) {
      sendServerAction('release', activeCode);
    } else {
      loadLocalSessions();
      const s = sessions.find(x => x.code === activeCode);
      if (s && s.status === 'active') {
        s.status = 'unused';
        localStorage.setItem('pb_sessions', JSON.stringify(sessions));
        syncChannel.postMessage({ action: 'release_code', data: { code: activeCode }, sender: 'booth' });
      }
    }
  }
}

function exitCameraScreen() {
  stopWebcam();
  releaseActiveSessionCode();
  activeCode = '';
  document.getElementById('booth-input-code').value = '';
  // Pastikan viewport kamera kembali visible untuk sesi berikutnya
  const cameraLayout = document.querySelector('.camera-container-layout');
  if (cameraLayout) cameraLayout.style.display = '';
  // Sembunyikan section retake
  const retakeSection = document.getElementById('inline-retake-section');
  if (retakeSection) retakeSection.style.display = 'none';
  transitionScreen('screen-camera', 'screen-login');
}

// ── SET PHOTO COUNT ──
function setPhotoCount(count, el) {
  selectedPhotoCount = count;
  currentLayout = `${count}cut`;
  if (count === 1) currentPhotoArrangement = 'story';
  document.querySelectorAll('.photo-count-btn').forEach(b => b.classList.remove('active'));
  el?.classList.add('active');
  document.getElementById('btn-start-capture')?.setAttribute('aria-label', `Mulai sesi foto ${count} kali`);
  updateReceiptPreviewConcept(count);
  syncReceiptThemeControls();

  // Update indicator dots visibility
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) dot.style.display = i <= count ? 'block' : 'none';
  }

  // Update strip preview class immediately
  const strip = document.getElementById('strip-preview');
  if (strip) {
    // Remove all layout classes
    strip.classList.remove('layout-1cut', 'layout-2cut', 'layout-3cut', 'layout-4cut', 'layout-2x2', 'receipt-concept-1', 'receipt-concept-2', 'receipt-concept-4');
    strip.classList.add(`layout-${count}cut`);
    strip.classList.add(`receipt-concept-${count}`);
  }
}

function updateReceiptPreviewConcept(count = selectedPhotoCount) {
  const strip = document.getElementById('strip-preview');
  if (!strip) return;

  strip.classList.remove('receipt-concept-1', 'receipt-concept-2', 'receipt-concept-4');
  strip.classList.remove('receipt-theme-kopimigi', 'receipt-theme-purchase', 'receipt-theme-mail', 'receipt-theme-simple');
  strip.classList.add(`receipt-concept-${count}`);
  strip.classList.add(`receipt-theme-${currentReceiptTheme}`);

  const title = strip.querySelector('.receipt-preview-header strong');
  const subtitle = strip.querySelector('.receipt-preview-header span');
  const item = document.getElementById('receipt-preview-item');
  if (!title || !subtitle) return;

  const countLabel = count === 1 ? 'SINGLE FRAME' : count === 2 ? 'DOUBLE FRAME' : 'FOUR FRAME GRID';

  if (currentReceiptTheme === 'purchase') {
    title.textContent = 'RECEIPT PHOTOBOOTH';
    subtitle.textContent = 'KOPIMIGI STORE';
  } else if (currentReceiptTheme === 'mail') {
    title.textContent = 'MIGIEXPRESS';
    subtitle.textContent = 'PHOTO DELIVERY RECEIPT';
  } else if (currentReceiptTheme === 'simple') {
    title.textContent = 'KOPI MIGI';
    subtitle.textContent = 'PHOTOBOOTH';
  } else {
    title.textContent = 'KOPIMIGI';
    subtitle.textContent = 'CREATE STORY';
  }

  if (item) item.textContent = countLabel;
  syncArrangementControls();
}

function syncReceiptThemeControls() {
  document.querySelectorAll('.receipt-theme-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.receiptTheme === currentReceiptTheme);
  });
  // Sync dot indicators
  const idx = receiptThemes.indexOf(currentReceiptTheme);
  document.querySelectorAll('.theme-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === idx);
  });
}

function scrollThemeCarousel(index) {
  setReceiptThemeByIndex(index);
  const carousel = document.getElementById('theme-carousel');
  if (!carousel) return;
  const cardWidth = carousel.scrollWidth / receiptThemes.length;
  carousel.scrollTo({ left: cardWidth * index, behavior: 'smooth' });
}

function setReceiptThemeByIndex(index) {
  const normalized = (index + receiptThemes.length) % receiptThemes.length;
  setReceiptTheme(receiptThemes[normalized], document.querySelector(`.receipt-theme-card[data-receipt-theme="${receiptThemes[normalized]}"]`));
}

function cycleReceiptTheme(direction) {
  const current = receiptThemes.indexOf(currentReceiptTheme);
  setReceiptThemeByIndex(current + direction);
}

function initReceiptPreviewSwipe() {
  const stage = document.getElementById('receipt-preview-stage');
  if (!stage) return;
  let startX = 0;
  let startY = 0;
  let tracking = false;

  stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    tracking = true;
    startX = event.clientX;
    startY = event.clientY;
    stage.setPointerCapture?.(event.pointerId);
  });

  stage.addEventListener('pointerup', (event) => {
    if (!tracking) return;
    tracking = false;
    stage.releasePointerCapture?.(event.pointerId);
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      cycleReceiptTheme(dx < 0 ? 1 : -1);
    }
  });

  stage.addEventListener('pointercancel', () => {
    tracking = false;
  });
}

// Sync carousel scroll position → dots
(function initCarouselSync() {
  document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.getElementById('theme-carousel');
    if (!carousel) return;
    carousel.addEventListener('scroll', () => {
      const idx = Math.round(carousel.scrollLeft / (carousel.scrollWidth / 4));
      setReceiptThemeByIndex(idx);
    }, { passive: true });
  });
})();

function syncArrangementControls() {
  const picker = document.getElementById('arrangement-picker');
  const shapePicker = document.getElementById('single-frame-shape-picker');
  const storyLabel = document.getElementById('arrangement-story-label');
  if (!picker) return;

  picker.style.display = selectedPhotoCount === 1 ? 'none' : 'block';
  if (shapePicker) shapePicker.style.display = selectedPhotoCount === 1 ? 'block' : 'none';
  if (storyLabel) storyLabel.textContent = selectedPhotoCount === 2 ? 'Vertikal' : 'Story';

  document.querySelectorAll('.arrangement-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.arrangement === currentPhotoArrangement);
  });
  syncSingleFrameShapeControls();
}

function syncSingleFrameShapeControls() {
  document.querySelectorAll('.single-frame-shape-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.singleFrameShape === currentSingleFrameShape);
  });
}

function setPhotoArrangement(arrangement, element) {
  currentPhotoArrangement = arrangement;
  document.querySelectorAll('.arrangement-card').forEach((card) => card.classList.remove('active'));
  element?.classList.add('active');
  scheduleLiveReceiptPreview(0);
}

function setSingleFrameShape(shape, element) {
  currentSingleFrameShape = shape;
  document.querySelectorAll('.single-frame-shape-card').forEach((card) => card.classList.remove('active'));
  element?.classList.add('active');
  scheduleLiveReceiptPreview(0);
}

function setPhotoBackground(mode, element) {
  currentPhotoBackground = mode;
  document.querySelectorAll('.photo-bg-card').forEach((card) => card.classList.remove('active'));
  element?.classList.add('active');
  const status = mode === 'original'
    ? 'Background asli dipakai.'
    : mode === 'burst'
      ? 'Memproses background hitam pudar...'
      : 'Memproses background sederhana...';
  updatePhotoBackgroundStatus(status);
  scheduleLiveReceiptPreview(0);
}

function updatePhotoBackgroundStatus(message) {
  const status = document.getElementById('photo-bg-status');
  if (status) status.textContent = message;
}

function syncPhotoBackgroundControls() {
  document.querySelectorAll('.photo-bg-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.photoBg === currentPhotoBackground);
  });
}

// ── CAPTURE SESSION LOOP ──
async function startPhotoSession() {
  const btn = document.getElementById('btn-start-capture');
  btn.disabled = true;

  capturedImages = [];
  digitalShareUrl = '';
  retakeUsed = new Array(selectedPhotoCount).fill(false);
  photoFrameOffsets = Array.from({ length: selectedPhotoCount }, () => ({ x: 0, y: 0 }));

  // Clear indicator dots
  for (let d = 1; d <= 4; d++) {
    const dot = document.getElementById(`dot-${d}`);
    if (dot) dot.className = 'indicator-dot';
    if (dot) dot.style.display = d <= selectedPhotoCount ? 'block' : 'none';
  }

  const screenTitle = document.getElementById('camera-screen-title');
  const screenSubtitle = document.getElementById('camera-screen-subtitle');

  for (let count = 1; count <= selectedPhotoCount; count++) {
    screenTitle.textContent = `Foto ke-${count} dari ${selectedPhotoCount}`;
    screenSubtitle.textContent = "Bergayalah! Hitung mundur dimulai...";

    document.getElementById(`dot-${count}`).classList.add('active');

    await runTimer(3);

    triggerFlash();
    playCameraShutter();
    captureFrame(count);

    const dot = document.getElementById(`dot-${count}`);
    dot.className = 'indicator-dot captured';

    await new Promise(r => setTimeout(r, 1200));
  }

  screenTitle.textContent = "Semua foto berhasil!";
  screenSubtitle.textContent = "Ketuk foto untuk ambil ulang, atau lanjut ke editor.";

  btn.disabled = true;

  // Sembunyikan viewport kamera — tidak perlu lagi setelah semua foto diambil
  const cameraLayout = document.querySelector('.camera-container-layout');
  if (cameraLayout) cameraLayout.style.display = 'none';
  stopWebcam();

  showInlineRetakeSection();
}

function runTimer(seconds) {
  return new Promise((resolve) => {
    let timeLeft = seconds;
    const numOverlay = document.getElementById('countdown-number');
    const ringProgress = document.getElementById('countdown-ring-progress');
    const ringSvg = document.getElementById('countdown-ring');
    
    numOverlay.textContent = timeLeft;
    numOverlay.classList.add('active');
    ringSvg.classList.add('active');
    
    // Total circumference for dashoffset calculations (2 * PI * r) -> 2 * 3.14159 * 20 = 125.6
    const totalLength = 125.6;
    ringProgress.style.strokeDashoffset = 0;
    
    // Play sound beep on launch
    playBeep(880, 0.1);
    
    const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        numOverlay.textContent = timeLeft;
        playBeep(880, 0.1);
        
        // Update countdown circle progress
        const fraction = (seconds - timeLeft) / seconds;
        ringProgress.style.strokeDashoffset = totalLength * fraction;
      } else {
        clearInterval(interval);
        numOverlay.classList.remove('active');
        ringSvg.classList.remove('active');
        resolve();
      }
    }, 1000);
  });
}

function triggerFlash() {
  const flash = document.getElementById('camera-flash');
  flash.classList.add('trigger');
  setTimeout(() => {
    flash.classList.remove('trigger');
  }, 350);
}

function captureFrame(index) {
  const video = document.getElementById('webcam-feed');
  const canvas = document.getElementById('hidden-capture-canvas');
  const ctx = canvas.getContext('2d');
  const source = getVideoCoverSource(video, canvas.width / canvas.height);
  
  ctx.save();
  if (isCameraMirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, source.sx, source.sy, source.sw, source.sh, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  capturedImages.push(dataUrl);
}

function getVideoCoverSource(video, targetRatio, panX = 0, panY = 0) {
  const videoW = video.videoWidth || 640;
  const videoH = video.videoHeight || 480;
  const videoRatio = videoW / videoH;
  const previewZoom = 1;
  let sx = 0;
  let sy = 0;
  let sw = videoW;
  let sh = videoH;

  if (videoRatio > targetRatio) {
    sw = videoH * targetRatio;
    const extraX = Math.max(0, videoW - sw);
    sx = extraX / 2 + panX * extraX / 2;
  } else {
    sh = videoW / targetRatio;
    const extraY = Math.max(0, videoH - sh);
    sy = extraY / 2 + panY * extraY / 2;
  }

  const cropW = sw / previewZoom;
  const cropH = sh / previewZoom;
  sx += (sw - cropW) / 2 + panX * (sw - cropW) / 2;
  sy += (sh - cropH) / 2 + panY * (sh - cropH) / 2;
  sw = cropW;
  sh = cropH;

  sx = Math.max(0, Math.min(videoW - sw, sx));
  sy = Math.max(0, Math.min(videoH - sh, sy));
  return { sx, sy, sw, sh };
}

// ── EDITOR PREVIEW SCREEN SETUP ──
function setupEditorScreen() {
  // Show/hide photo slots based on count
  for (let i = 1; i <= 4; i++) {
    const wrapper = document.getElementById(`photo-wrapper-${i}`);
    if (wrapper) wrapper.style.display = i <= selectedPhotoCount ? '' : 'none';
  }

  // Populate preview pictures
  for (let i = 1; i <= selectedPhotoCount; i++) {
    const prevImg = document.getElementById(`prev-photo-${i}`);
    if (prevImg) prevImg.src = capturedImages[i - 1];
  }

  // Reset editor state
  currentFrameTheme = 'white';
  currentLayout = `${selectedPhotoCount}cut`;
  currentFilter = 'bw';
  currentPhotoArrangement = 'story';
  currentPhotoBackground = 'original';
  backgroundRemovalCache.clear();
  currentFontFamily = 'mono';
  placedStickers = [];
  document.getElementById('sticker-layer').innerHTML = '';
  const textInput = document.getElementById('text-caption-input');
  if (textInput) textInput.value = 'Pelanggan Setia';
  document.getElementById('strip-footer-text').textContent = 'Pelanggan Setia';
  const buyerPreview = document.getElementById('receipt-preview-buyer');
  if (buyerPreview) buyerPreview.textContent = 'Pelanggan Setia';

  // Set correct strip layout class
  const strip = document.getElementById('strip-preview');
  strip.className = `photostrip-canvas-container frame-white preview-source-hidden layout-${selectedPhotoCount}cut receipt-concept-${selectedPhotoCount}`;
  updateReceiptPreviewConcept(selectedPhotoCount);
  syncReceiptThemeControls();
  syncArrangementControls();
  syncPhotoBackgroundControls();
  updatePhotoBackgroundStatus('Mode gratis: potong background sederhana di browser.');

  // Apply monochrome preview to match the thermal print result.
  document.querySelectorAll('.strip-photo-img').forEach(img => {
    img.className = 'strip-photo-img filter-bw';
  });
  scheduleLiveReceiptPreview(0);

  transitionScreen('screen-camera', 'screen-editor');
}


function exitEditorToLogin() {
  releaseActiveSessionCode();
  transitionScreen('screen-editor', 'screen-login');
  activeCode = '';
  capturedImages = [];
  digitalShareUrl = '';
  document.getElementById('booth-input-code').value = '';
}

// ── INLINE RETAKE SYSTEM (screen-camera, bawah viewport) ──

function showInlineRetakeSection() {
  const section = document.getElementById('inline-retake-section');
  if (section) section.style.display = 'block';
  renderCapturedThumbnails();
}

function renderCapturedThumbnails() {
  const grid = document.getElementById('captured-thumbnails');
  if (!grid) return;
  grid.innerHTML = '';

  const cols = selectedPhotoCount === 1 ? 1 : selectedPhotoCount === 2 ? 2 : 4;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let i = 0; i < selectedPhotoCount; i++) {
    const slot = i + 1;
    const src = capturedImages[i] || '';
    const isActive = retakeTargetIndex === i;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative; border-radius:10px; overflow:hidden;';
    wrapper.style.border = isActive ? '2px solid var(--fg)' : '2px solid var(--border)';

    if (isActive) {
      // Tampilkan live kamera langsung di dalam frame thumbnail ini
      const video = document.createElement('video');
      video.id = 'inline-retake-video';
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.cssText = 'width:100%; display:block; aspect-ratio:3/4; object-fit:cover; filter:grayscale(1) contrast(1.05);';
      video.style.transform = isCameraMirrored ? 'scaleX(-1)' : 'scaleX(1)';

      // Countdown overlay di dalam frame
      const countOverlay = document.createElement('div');
      countOverlay.id = 'inline-retake-countdown';
      countOverlay.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:56px; font-weight:900; color:#fff; text-shadow:0 2px 12px rgba(0,0,0,0.8); pointer-events:none;';

      wrapper.appendChild(video);
      wrapper.appendChild(countOverlay);
    } else {
      // Thumbnail foto biasa
      const img = document.createElement('img');
      img.src = src;
      img.alt = `Foto ${slot}`;
      img.style.cssText = 'width:100%; display:block; aspect-ratio:3/4; object-fit:cover; filter:grayscale(1) contrast(1.05);';

      // Slot badge
      const badge = document.createElement('div');
      badge.style.cssText = 'position:absolute; top:5px; left:5px; background:rgba(0,0,0,0.55); color:#fff; font-size:9px; font-family:var(--font-mono); padding:2px 7px; border-radius:4px; letter-spacing:0.1em;';
      badge.textContent = `${slot}`;

      // Tombol retake minimalis — teks saja, 1 warna
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'ULANG';
      btn.style.cssText = 'position:absolute; bottom:0; left:0; right:0; width:100%; padding:6px 0; font-size:10px; font-family:var(--font-mono); font-weight:700; letter-spacing:0.12em; border:none; cursor:pointer; background:rgba(0,0,0,0.65); color:#fff; border-radius:0;';
      btn.onclick = () => startInlineRetake(slot);

      wrapper.appendChild(img);
      wrapper.appendChild(badge);
      wrapper.appendChild(btn);
    }

    grid.appendChild(wrapper);
  }
}

async function startInlineRetake(slotIndex) {
  retakeTargetIndex = slotIndex - 1;

  const label = document.getElementById('retake-slot-label');
  if (label) label.textContent = `Retake #${slotIndex}`;

  // Render ulang dulu agar frame thumbnail berubah jadi video
  renderCapturedThumbnails();

  // Nyalakan kamera, sambungkan ke video di dalam frame thumbnail
  const retakeVideo = document.getElementById('inline-retake-video');
  if (!retakeVideo) return;

  try {
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 960, facingMode: 'user' }, audio: false
      });
    }
    retakeVideo.srcObject = localStream;
    await retakeVideo.play().catch(() => {});
  } catch (err) {
    alert('Kamera tidak bisa diakses.');
    retakeTargetIndex = -1;
    renderCapturedThumbnails();
    return;
  }

  await doInlineRetakeCapture();
}

async function doInlineRetakeCapture() {
  const canvas    = document.getElementById('hidden-capture-canvas');
  const ctx       = canvas.getContext('2d');
  const retakeVideo = document.getElementById('inline-retake-video');
  const countEl   = document.getElementById('inline-retake-countdown');

  if (!retakeVideo || !retakeVideo.srcObject) return;

  // Countdown 5 detik di dalam frame thumbnail
  for (let i = 5; i >= 1; i--) {
    if (countEl) countEl.textContent = i;
    playBeep(880, 0.1);
    await new Promise(r => setTimeout(r, 1000));
  }
  if (countEl) countEl.textContent = '';

  // Flash + shutter
  triggerFlash();
  playCameraShutter();

  // Capture dari video di frame thumbnail
  const source = getVideoCoverSource(retakeVideo, canvas.width / canvas.height);
  ctx.save();
  if (isCameraMirrored) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(retakeVideo, source.sx, source.sy, source.sw, source.sh, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  capturedImages[retakeTargetIndex] = dataUrl;
  digitalShareUrl = '';
  retakeUsed[retakeTargetIndex] = true;

  // Stop kamera
  stopWebcam();

  retakeTargetIndex = -1;
  const label = document.getElementById('retake-slot-label');
  if (label) label.textContent = '';
  renderCapturedThumbnails();
}

function cancelInlineRetake() {
  retakeTargetIndex = -1;
  const label = document.getElementById('retake-slot-label');
  if (label) label.textContent = '';
  renderCapturedThumbnails();
}

function proceedToEditor() {
  cancelInlineRetake();
  const section = document.getElementById('inline-retake-section');
  if (section) section.style.display = 'none';
  // Restore camera layout untuk sesi berikutnya
  const cameraLayout = document.querySelector('.camera-container-layout');
  if (cameraLayout) cameraLayout.style.display = '';
  stopWebcam();
  setupEditorScreen();
}

// retakePhoto tidak lagi dipanggil dari editor — retake hanya ada di screen-camera
function retakePhoto() {
  // no-op: retake sekarang hanya tersedia di screen-camera (inline retake section)
}

// closeRetakeModal tidak lagi dibutuhkan, dijaga agar tidak error jika ada referensi sisa
function closeRetakeModal() {
  cancelInlineRetake();
}

// Tab navigation inside editor
function switchEditorTab(tabId) {
  document.querySelectorAll('.editor-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content-panel').forEach(panel => panel.classList.remove('active'));
  
  // Find which button maps to this tabId
  const tabMap = {
    'tab-frame': 0,
    'tab-text': 1
  };
  document.querySelectorAll('.editor-tab-btn')[tabMap[tabId]].classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

// Editor actions
function setFrameTheme(themeName, element) {
  const panel = element.parentNode;
  panel.querySelectorAll('.frame-theme-card').forEach(c => c.classList.remove('active'));
  element.classList.add('active');
  
  currentFrameTheme = themeName;
  const strip = document.getElementById('strip-preview');
  
  // Clean theme classes
  strip.className = strip.className.replace(/frame-\w+/, `frame-${themeName}`);
  scheduleLiveReceiptPreview();
}

function setLayoutFormat(layoutName, element) {
  const panel = element.parentNode;
  panel.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
  element.classList.add('active');
  
  currentLayout = layoutName;
  const strip = document.getElementById('strip-preview');
  
  // Remove existing layout classes and inject current one
  strip.className = strip.className.replace(/layout-\w+/, `layout-${layoutName}`);
}

function setLayoutFormatForCount(layoutName, photoCount, element) {
  if (photoCount !== selectedPhotoCount) return;
  setLayoutFormat(layoutName, element);
  updateReceiptPreviewConcept(photoCount);
}

function setReceiptTheme(themeName, element) {
  currentReceiptTheme = themeName;
  document.querySelectorAll('.receipt-theme-card').forEach(c => c.classList.remove('active'));
  if (element) element.classList.add('active');
  updateReceiptPreviewConcept(selectedPhotoCount);
  syncReceiptThemeControls();
  scheduleLiveReceiptPreview();
}

function setPhotoFilter(filterName, element) {
  const panel = element.parentNode;
  panel.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
  element.classList.add('active');
  
  currentFilter = filterName;
  
  document.querySelectorAll('.strip-photo-img').forEach(img => {
    img.className = `strip-photo-img filter-${filterName}`;
  });
}

function updateFooterText() {
  const text = document.getElementById('text-caption-input').value;
  document.getElementById('strip-footer-text').textContent = text || 'Pelanggan Setia';
  const buyer = document.getElementById('receipt-preview-buyer');
  if (buyer) buyer.textContent = text || 'Pelanggan Setia';
  scheduleLiveReceiptPreview();
}

function getPhotoFrameOffset(slotIndex) {
  if (!photoFrameOffsets[slotIndex - 1]) {
    photoFrameOffsets[slotIndex - 1] = { x: 0, y: 0 };
  }
  return photoFrameOffsets[slotIndex - 1];
}

function bindPhotoHotspotDrag(button, slotIndex, rect, layout) {
  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let baseY = 0;
  let moved = false;
  let dragging = false;

  button.addEventListener('pointerdown', (event) => {
    if (button.disabled) return;
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    const offset = getPhotoFrameOffset(slotIndex);
    baseX = offset.x;
    baseY = offset.y;
    button.setPointerCapture?.(event.pointerId);
  });

  button.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.hypot(dx, dy) < 5 && !moved) return;
    moved = true;
    suppressPhotoHotspotClick = true;

    const previewRect = button.parentElement.getBoundingClientRect();
    const visualW = previewRect.width * (rect.w / layout.totalW);
    const visualH = previewRect.height * (rect.h / layout.totalH);
    const offset = getPhotoFrameOffset(slotIndex);
    offset.x = Math.max(-1, Math.min(1, baseX + (dx / Math.max(1, visualW)) * 2));
    offset.y = Math.max(-1, Math.min(1, baseY + (dy / Math.max(1, visualH)) * 2));
    scheduleLiveReceiptPreview(60);
    event.preventDefault();
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    button.releasePointerCapture?.(event.pointerId);
    if (moved) {
      scheduleLiveReceiptPreview(0);
      setTimeout(() => { suppressPhotoHotspotClick = false; }, 120);
    }
  };

  button.addEventListener('pointerup', endDrag);
  button.addEventListener('pointercancel', endDrag);
}

function getReceiptPhotoRects() {
  const photoCount = Math.min(selectedPhotoCount, capturedImages.length || selectedPhotoCount);
  const targetWidth = 384;
  const margin = currentFrameTheme === 'ink' ? 6 : 2;
  const gutter = 4;
  const gridW = targetWidth - margin * 2;
  const isGrid = currentPhotoArrangement === 'grid';
  const defaultHeights = photoCount === 1 ? 1022 : photoCount === 2 ? (isGrid ? 922 : 1392) : (isGrid ? 1110 : 1450);
  const mailHeights = photoCount === 1 ? 985 : photoCount === 2 ? (isGrid ? 922 : 1352) : (isGrid ? 1100 : 1450);
  const totalH = currentReceiptTheme === 'mail' ? mailHeights : defaultHeights;
  const rects = [];

  const pushFourReceiptRects = (startY) => {
    const photoW = Math.floor((gridW - gutter) / 2);
    rects.push({ slot: 1, x: margin, y: startY, w: gridW, h: 292 });
    rects.push({ slot: 2, x: margin, y: startY + 322, w: photoW, h: 176 });
    rects.push({ slot: 3, x: margin + photoW + gutter, y: startY + 322, w: photoW, h: 176 });
    rects.push({ slot: 4, x: margin, y: startY + 528, w: gridW, h: 292 });
  };

  const pushCountRects = (startY, sizes) => {
    if (photoCount === 1) {
      rects.push({ x: margin, y: startY, w: gridW, h: sizes.singleH });
    } else if (photoCount === 2) {
      if (currentPhotoArrangement === 'grid') {
        const photoW = Math.floor((gridW - gutter) / 2);
        const h = sizes.twoGridH || sizes.gridH || sizes.twoH;
        rects.push({ x: margin, y: startY, w: photoW, h });
        rects.push({ x: margin + photoW + gutter, y: startY, w: photoW, h });
      } else {
        rects.push({ x: margin, y: startY, w: gridW, h: sizes.twoH });
        rects.push({ x: margin, y: startY + sizes.twoH + gutter, w: gridW, h: sizes.twoH });
      }
    } else {
      if (currentPhotoArrangement !== 'grid') {
        pushFourReceiptRects(startY);
        return;
      }
      const photoW = Math.floor((gridW - gutter) / 2);
      for (let index = 0; index < photoCount; index++) {
        const col = index % 2;
        const row = Math.floor(index / 2);
        rects.push({
          x: margin + col * (photoW + gutter),
          y: startY + row * (sizes.gridH + gutter),
          w: photoW,
          h: sizes.gridH
        });
      }
    }
  };

  if (currentReceiptTheme === 'purchase') {
    pushCountRects(340, { singleH: 499, twoH: 237, twoGridH: 292, gridH: 237 });
  } else if (currentReceiptTheme === 'mail') {
    pushCountRects(300, { singleH: 499, twoH: 237, twoGridH: 292, gridH: 237 });
  } else if (photoCount === 1) {
    rects.push({ x: margin, y: 363, w: gridW, h: gridW });
  } else if (photoCount === 2) {
    pushCountRects(363, { twoH: gridW, twoGridH: 292, gridH: 237 });
  } else {
    pushCountRects(363, { gridH: 237 });
  }

  return { totalW: targetWidth, totalH, rects };
}


function scheduleLiveReceiptPreview(delay = 140) {
  clearTimeout(liveReceiptPreviewTimer);
  liveReceiptPreviewTimer = setTimeout(updateLiveReceiptPreview, delay);
}

async function updateLiveReceiptPreview() {
  const preview = document.getElementById('receipt-live-preview');
  const editor = document.getElementById('screen-editor');
  if (!preview || !editor || capturedImages.length === 0) return;

  const seq = ++liveReceiptPreviewSeq;
  preview.classList.add('loading');
  try {
    const receiptImage = await buildCompactPrintImage(384, { preview: true });
    if (seq !== liveReceiptPreviewSeq) return;
    preview.src = receiptImage;
  } catch (err) {
    console.warn('[PREVIEW] Gagal membuat preview live:', err);
  } finally {
    if (seq === liveReceiptPreviewSeq) preview.classList.remove('loading');
  }
}

function setFontFamily(fontName, element) {
  const panel = element.parentNode;
  panel.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
  element.classList.add('active');
  
  currentFontFamily = fontName;
  const footerText = document.getElementById('strip-footer-text');
  
  // Font styles matching tokens
  if (fontName === 'mono') {
    footerText.style.fontFamily = "var(--font-mono)";
    footerText.style.fontSize = "10px";
    footerText.style.fontStyle = "normal";
  } else if (fontName === 'serif') {
    footerText.style.fontFamily = "var(--font-display)";
    footerText.style.fontSize = "13px";
    footerText.style.fontStyle = "italic";
  } else if (fontName === 'hand') {
    footerText.style.fontFamily = "'Reenie Beanie', cursive";
    footerText.style.fontSize = "26px";
    footerText.style.fontStyle = "normal";
  }
}

// ── STICKER LIBRARY & DRAG LOGIC ──
const stickerAssets = [
  // Heart (Inline SVG)
  `<svg viewBox="0 0 24 24" fill="#ff4d6d"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  // Star (Inline SVG)
  `<svg viewBox="0 0 24 24" fill="#ffd166"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
  // Sparkle (Y2K Sparkle)
  `<svg viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z"/></svg>`,
  // Sunglasses
  `<svg viewBox="0 0 24 24" fill="#00ffff"><path d="M19 10h-2.1c-.5-1.2-1.7-2-3-2H10c-1.3 0-2.5.8-3 2H5c-1.7 0-3 1.3-3 3v1c0 1.7 1.3 3 3 3h.5c2.2 0 4-1.8 4-4v-.5l1 .5l1-.5V13c0 2.2 1.8 4 4 4h.5c1.7 0 3-1.3 3-3v-1c0-1.7-1.3-3-3-3z"/></svg>`,
  // Flower
  `<svg viewBox="0 0 24 24" fill="#ff85a1"><path d="M12 9c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3zm0-6C9.2 3 7 5.2 7 8c0 .5.1 1 .3 1.5C6.1 9.2 5 10.5 5 12c0 1.5 1.1 2.8 2.3 2.5C7.1 15 7 15.5 7 16c0 2.8 2.2 5 5 5s5-2.2 5-5c0-.5-.1-1-.3-1.5 1.2-.3 2.3-1.6 2.3-2.5 0-1.5-1.1-2.8-2.3-2.5.2-.5.3-1 .3-1.5 0-2.8-2.2-5-5-5z"/></svg>`,
  // Speech Bubble emoji style
  `💭`,
  // Smile emoji
  `⭐`,
  // COOL Sticker text
  `<span style="background:#ff0055; color:white; font-weight:900; font-size:10px; padding:2px 6px; border-radius:4px; font-family:var(--font-mono);">COOL</span>`,
  // RETRO Badge
  `<span style="background:black; color:#ffd166; border:1px solid #ffd166; font-weight:900; font-size:10px; padding:2px 6px; font-family:var(--font-mono);">RETRO</span>`,
  // Heart emoji
  `💖`,
  // Peace sign emoji
  `✌️`,
  // Party popper emoji
  `🎉`
];

function loadStickerLibrary() {
  const container = document.getElementById('sticker-lib-container');
  container.innerHTML = '';
  
  stickerAssets.forEach((stickerContent, index) => {
    const item = document.createElement('div');
    item.className = 'sticker-lib-item';
    item.innerHTML = stickerContent;
    item.onclick = () => addStickerToStrip(stickerContent);
    container.appendChild(item);
  });
}

function addStickerToStrip(content) {
  stickerIdCounter++;
  const stickerId = `placed-sticker-${stickerIdCounter}`;
  
  const stickerEl = document.createElement('div');
  stickerEl.className = 'placed-sticker selected';
  stickerEl.id = stickerId;
  stickerEl.style.width = '64px';
  stickerEl.style.height = '64px';
  stickerEl.style.top = '100px';
  stickerEl.style.left = '108px';
  stickerEl.style.transform = 'rotate(0deg) scale(1)';
  
  stickerEl.innerHTML = `
    ${content}
    <div class="sticker-control sticker-ctrl-delete" onclick="deleteSticker('${stickerId}', event)">×</div>
    <div class="sticker-control sticker-ctrl-rotate">↻</div>
    <div class="sticker-control sticker-ctrl-resize">⤄</div>
  `;
  
  document.getElementById('sticker-layer').appendChild(stickerEl);
  
  const stickerObj = {
    id: stickerId,
    content: content,
    x: 108,
    y: 100,
    width: 64,
    height: 64,
    rotation: 0,
    scale: 1
  };
  placedStickers.push(stickerObj);
  
  selectSticker(stickerObj);
  setupStickerDragEvents(stickerEl, stickerObj);
}

function selectSticker(stickerObj) {
  // Deselect previous
  document.querySelectorAll('.placed-sticker').forEach(s => s.classList.remove('selected'));
  
  activeSelectedSticker = stickerObj;
  if (stickerObj) {
    const el = document.getElementById(stickerObj.id);
    if (el) el.classList.add('selected');
  }
}

// Global click outside to deselect sticker
document.addEventListener('mousedown', function(e) {
  if (!e.target.closest('.placed-sticker') && !e.target.closest('.sticker-lib-item')) {
    selectSticker(null);
  }
});

function deleteSticker(id, event) {
  if (event) event.stopPropagation();
  const el = document.getElementById(id);
  if (el) el.remove();
  placedStickers = placedStickers.filter(s => s.id !== id);
  if (activeSelectedSticker && activeSelectedSticker.id === id) {
    activeSelectedSticker = null;
  }
}

function setupStickerDragEvents(stickerEl, stickerObj) {
  const container = document.getElementById('strip-preview');
  let isDragging = false;
  let isRotating = false;
  let isResizing = false;
  
  let startX, startY;
  let startLeft, startTop;
  let startWidth, startHeight;
  let startRotation;
  let startAngle;
  let startDist;

  // Grab handle elements
  const rotateHandle = stickerEl.querySelector('.sticker-ctrl-rotate');
  const resizeHandle = stickerEl.querySelector('.sticker-ctrl-resize');

  // Drag start
  stickerEl.addEventListener('mousedown', function(e) {
    if (e.target.closest('.sticker-control')) return; // ignore control clicks
    isDragging = true;
    selectSticker(stickerObj);
    
    startX = e.clientX;
    startY = e.clientY;
    startLeft = stickerObj.x;
    startTop = stickerObj.y;
    
    e.preventDefault();
  });

  // Rotate start
  rotateHandle.addEventListener('mousedown', function(e) {
    isRotating = true;
    selectSticker(stickerObj);
    
    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    startRotation = stickerObj.rotation;
    
    e.preventDefault();
    e.stopPropagation();
  });

  // Resize start
  resizeHandle.addEventListener('mousedown', function(e) {
    isResizing = true;
    selectSticker(stickerObj);
    
    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    startX = e.clientX;
    startY = e.clientY;
    startWidth = stickerObj.width;
    startHeight = stickerObj.height;
    
    startDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
    
    e.preventDefault();
    e.stopPropagation();
  });

  // Mouse Move & Up on window
  window.addEventListener('mousemove', function(e) {
    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      // Update coordinates (contain within boundaries approximately)
      stickerObj.x = Math.max(-20, Math.min(container.clientWidth - stickerObj.width + 20, startLeft + dx));
      stickerObj.y = Math.max(-20, Math.min(container.clientHeight - stickerObj.height + 20, startTop + dy));
      
      stickerEl.style.left = `${stickerObj.x}px`;
      stickerEl.style.top = `${stickerObj.y}px`;
    }
    
    else if (isRotating) {
      const rect = stickerEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const angleRad = currentAngle - startAngle + (startRotation * Math.PI / 180);
      let angleDeg = angleRad * (180 / Math.PI);
      
      stickerObj.rotation = angleDeg;
      applyTransform(stickerEl, stickerObj);
    }
    
    else if (isResizing) {
      const rect = stickerEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const currentDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      const ratio = currentDist / startDist;
      
      // Prevent shrinking to 0
      const newWidth = Math.max(20, Math.min(200, startWidth * ratio));
      const newHeight = Math.max(20, Math.min(200, startHeight * ratio));
      
      // Keep object centered during resize
      const dx = (newWidth - stickerObj.width) / 2;
      const dy = (newHeight - stickerObj.height) / 2;
      stickerObj.x -= dx;
      stickerObj.y -= dy;
      
      stickerObj.width = newWidth;
      stickerObj.height = newHeight;
      
      stickerEl.style.left = `${stickerObj.x}px`;
      stickerEl.style.top = `${stickerObj.y}px`;
      stickerEl.style.width = `${newWidth}px`;
      stickerEl.style.height = `${newHeight}px`;
    }
  });

  window.addEventListener('mouseup', function() {
    isDragging = false;
    isRotating = false;
    isResizing = false;
  });

  // Touch Support for mobile previewing
  stickerEl.addEventListener('touchstart', function(e) {
    if (e.target.closest('.sticker-control')) return;
    isDragging = true;
    selectSticker(stickerObj);
    
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startLeft = stickerObj.x;
    startTop = stickerObj.y;
  });

  rotateHandle.addEventListener('touchstart', function(e) {
    isRotating = true;
    selectSticker(stickerObj);
    
    const touch = e.touches[0];
    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    startAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
    startRotation = stickerObj.rotation;
    
    e.stopPropagation();
  });

  resizeHandle.addEventListener('touchstart', function(e) {
    isResizing = true;
    selectSticker(stickerObj);
    
    const touch = e.touches[0];
    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    startX = touch.clientX;
    startY = touch.clientY;
    startWidth = stickerObj.width;
    startHeight = stickerObj.height;
    
    startDist = Math.hypot(touch.clientX - centerX, touch.clientY - centerY);
    
    e.stopPropagation();
  });

  window.addEventListener('touchmove', function(e) {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    
    if (isDragging) {
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      
      stickerObj.x = Math.max(-20, Math.min(container.clientWidth - stickerObj.width + 20, startLeft + dx));
      stickerObj.y = Math.max(-20, Math.min(container.clientHeight - stickerObj.height + 20, startTop + dy));
      
      stickerEl.style.left = `${stickerObj.x}px`;
      stickerEl.style.top = `${stickerObj.y}px`;
    }
    else if (isRotating) {
      const rect = stickerEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const currentAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
      const angleRad = currentAngle - startAngle + (startRotation * Math.PI / 180);
      stickerObj.rotation = angleRad * (180 / Math.PI);
      applyTransform(stickerEl, stickerObj);
    }
    else if (isResizing) {
      const rect = stickerEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const currentDist = Math.hypot(touch.clientX - centerX, touch.clientY - centerY);
      const ratio = currentDist / startDist;
      
      const newWidth = Math.max(20, Math.min(200, startWidth * ratio));
      const newHeight = Math.max(20, Math.min(200, startHeight * ratio));
      
      const dx = (newWidth - stickerObj.width) / 2;
      const dy = (newHeight - stickerObj.height) / 2;
      stickerObj.x -= dx;
      stickerObj.y -= dy;
      
      stickerObj.width = newWidth;
      stickerObj.height = newHeight;
      
      stickerEl.style.left = `${stickerObj.x}px`;
      stickerEl.style.top = `${stickerObj.y}px`;
      stickerEl.style.width = `${newWidth}px`;
      stickerEl.style.height = `${newHeight}px`;
    }
  });

  window.addEventListener('touchend', function() {
    isDragging = false;
    isRotating = false;
    isResizing = false;
  });
}

function applyTransform(element, obj) {
  element.style.transform = `rotate(${obj.rotation}deg)`;
}

// ═══════════════════════════════════════════════════════════════
//  THERMAL PRINT PIPELINE (Urutan benar sesuai best practice)
//
//  [ FOTO RGB ] → [ RESIZE ke px printer ] → [ GRAYSCALE ]
//       → [ BRIGHTNESS↑ CONTRAST↓ ] → [ DITHERING ] → [ BITMAP ]
// ═══════════════════════════════════════════════════════════════

/**
 * STEP 2+3+4+5: Proses lengkap satu canvas foto → canvas B&W dithered
 * sudah di-resize ke targetWidth (px = dots printer)
 */
function processPhotoForThermal(sourceCanvas, targetWidth) {
  // WAJIB: width kelipatan 8 agar ESC/POS byte-alignment tidak geser
  targetWidth = Math.floor(targetWidth / 8) * 8;

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const targetHeight = Math.round(srcH * (targetWidth / srcW));

  // STEP 2: RESIZE ke resolusi printer
  const resized = document.createElement('canvas');
  resized.width  = targetWidth;
  resized.height = targetHeight;
  const rCtx = resized.getContext('2d');
  rCtx.imageSmoothingEnabled = true;
  rCtx.imageSmoothingQuality = 'high';
  rCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  const imgData = rCtx.getImageData(0, 0, targetWidth, targetHeight);
  const data    = imgData.data;
  const total   = targetWidth * targetHeight;

  // STEP 3: GRAYSCALE — luminance
  const gray = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    gray[i] = 0.2126 * data[i*4] + 0.7152 * data[i*4+1] + 0.0722 * data[i*4+2];
  }

  // STEP 4: ADJUSTMENT
  // Lebih terang dan lebih lembut supaya wajah tidak jatuh menjadi blok hitam.
  const CONTRAST   = 0.76;
  const BRIGHTNESS = 54;
  for (let i = 0; i < total; i++) {
    gray[i] = Math.max(0, Math.min(255, (gray[i] - 128) * CONTRAST + 128 + BRIGHTNESS));
  }

  // STEP 5: FLOYD-STEINBERG DITHERING di resolusi printer
  const THRESHOLD = 126;
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const i      = y * targetWidth + x;
      const oldVal = gray[i];
      const newVal = oldVal < THRESHOLD ? 0 : 255;
      const err    = oldVal - newVal;
      gray[i]      = newVal;
      if (x + 1 < targetWidth)
        gray[i + 1]             = Math.max(0, Math.min(255, gray[i + 1]             + err * 7/16));
      if (x - 1 >= 0 && y + 1 < targetHeight)
        gray[i + targetWidth-1] = Math.max(0, Math.min(255, gray[i + targetWidth-1] + err * 3/16));
      if (y + 1 < targetHeight)
        gray[i + targetWidth]   = Math.max(0, Math.min(255, gray[i + targetWidth]   + err * 5/16));
      if (x + 1 < targetWidth && y + 1 < targetHeight)
        gray[i + targetWidth+1] = Math.max(0, Math.min(255, gray[i + targetWidth+1] + err * 1/16));
    }
  }

  for (let i = 0; i < total; i++) {
    const v = gray[i] < 128 ? 0 : 255;
    data[i*4] = data[i*4+1] = data[i*4+2] = v;
    data[i*4+3] = 255;
  }
  rCtx.putImageData(imgData, 0, 0);
  return resized;
}

/**
 * STEP 6: Konversi canvas B&W → bitmap bytes ESC/POS
 * 1 pixel hitam = 1 bit, dipack 8 pixel per byte
 */
function canvasToBitmapBytes(bwCanvas) {
  const w   = bwCanvas.width;
  const h   = bwCanvas.height;
  const ctx = bwCanvas.getContext('2d');
  const pixels      = ctx.getImageData(0, 0, w, h).data;
  const bytesPerRow = Math.ceil(w / 8);
  const rasterData  = [];

  for (let row = 0; row < h; row++) {
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIdx * 8 + bit;
        if (x < w && pixels[(row * w + x) * 4] < 128) {
          byte |= (0x80 >> bit); // pixel hitam = cetak dot
        }
      }
      rasterData.push(byte);
    }
  }
  return { data: rasterData, widthBytes: bytesPerRow, widthDots: w, height: h };
}

/**
 * Pipeline utama: ambil semua foto, susun strip, proses, kirim ke printer
 * Dipanggil oleh printViaBluetooth() dan triggerThermalPrint()
 */
async function buildThermalBitmap(targetWidthDots) {
  // Susun semua foto jadi satu canvas strip (tanpa frame, full-width)
  const photoCount = selectedPhotoCount;
  const photoW     = targetWidthDots;
  const photoH     = Math.round(photoW * (3/4)); // 4:3
  const gap        = Math.round(targetWidthDots * 0.015); // ~1.5% lebar
  const footerH    = Math.round(targetWidthDots * 0.08);  // ~8% lebar
  const totalH     = photoCount * photoH + (photoCount - 1) * gap + footerH;

  const strip    = document.createElement('canvas');
  strip.width    = targetWidthDots;
  strip.height   = totalH;
  const stripCtx = strip.getContext('2d');

  // Background putih
  stripCtx.fillStyle = '#ffffff';
  stripCtx.fillRect(0, 0, targetWidthDots, totalH);

  // Gambar tiap foto
  for (let i = 0; i < photoCount; i++) {
    const photoCanvas = document.createElement('canvas');
    photoCanvas.width  = 640; // ukuran kerja sebelum resize
    photoCanvas.height = 480;
    const pCtx = photoCanvas.getContext('2d');

    const img = new Image();
    img.src = capturedImages[i];
    await new Promise((res, rej) => {
      img.onload  = res;
      img.onerror = rej;
    });

    // Mirror foto (seperti di preview)
    pCtx.save();
    pCtx.translate(640, 0);
    pCtx.scale(-1, 1);
    pCtx.drawImage(img, 0, 0, 640, 480);
    pCtx.restore();

    // STEP 2–5: proses foto ini ke B&W dithered di resolusi target
    const bwPhoto = processPhotoForThermal(photoCanvas, photoW);

    // Tempel ke strip
    const y = i * (photoH + gap);
    stripCtx.drawImage(bwPhoto, 0, y, photoW, photoH);
  }

  // Footer teks
  const capText = document.getElementById('text-caption-input')?.value || 'Pelanggan Setia';
  stripCtx.fillStyle  = '#000000';
  stripCtx.textAlign  = 'center';
  stripCtx.font       = `bold ${Math.round(footerH * 0.5)}px monospace`;
  stripCtx.fillText(capText, targetWidthDots / 2, totalH - Math.round(footerH * 0.2));

  // STEP 6: konversi ke bitmap bytes
  return canvasToBitmapBytes(strip);
}

// Legacy wrapper — dipakai oleh renderAndGoToFinal preview (bukan print)
function applyFloydSteinbergDithering(canvas) {
  const processed = processPhotoForThermal(canvas, canvas.width);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(processed, 0, 0);
}

function convertCanvasToMonochrome(canvas, contrast = 1.15) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const adjusted = Math.max(0, Math.min(255, (lum - 128) * contrast + 128));
    data[i] = data[i + 1] = data[i + 2] = adjusted;
  }

  ctx.putImageData(imgData, 0, 0);
}

function drawImageCover(ctx, img, x, y, w, h, offsetX = 0, offsetY = 0) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > targetRatio) {
    sw = img.height * targetRatio;
    const extraX = Math.max(0, img.width - sw);
    sx = extraX / 2 - offsetX * extraX / 2;
  } else {
    sh = img.width / targetRatio;
    const extraY = Math.max(0, img.height - sh);
    sy = extraY / 2 - offsetY * extraY / 2;
  }

  sx = Math.max(0, Math.min(img.width - sw, sx));
  sy = Math.max(0, Math.min(img.height - sh, sy));

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawPhotoBackgroundPattern(ctx, w, h, mode) {
  if (mode === 'burst') {
    const cx = w * 0.5;
    const cy = h * 0.48;
    const radius = Math.sqrt(w * w + h * h);
    ctx.fillStyle = '#f4f4f2';
    ctx.fillRect(0, 0, w, h);

    const rays = 32;
    for (let i = 0; i < rays; i++) {
      const a1 = (Math.PI * 2 * i) / rays;
      const a2 = (Math.PI * 2 * (i + 1)) / rays;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius);
      ctx.lineTo(cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#f4f4f2' : '#2f2f2f';
      ctx.fill();
    }

    const noise = ctx.getImageData(0, 0, w, h);
    const data = noise.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(noise, 0, 0);

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = 0; i < 90; i++) {
      const size = Math.random() > 0.92 ? 2 : 1;
      ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 28; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = 18 + Math.random() * 80;
      const angle = -0.55 + Math.random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }
    return;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
}

async function ensureSelfieSegmentation() {
  if (selfieSegmentationReady) return selfieSegmentationReady;
  selfieSegmentationReady = new Promise((resolve) => {
    if (!window.SelfieSegmentation) {
      updatePhotoBackgroundStatus('AI browser belum siap, pakai foto asli dulu.');
      resolve(null);
      return;
    }

    try {
      const segmenter = new SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
      });
      segmenter.setOptions({ modelSelection: 1, selfieMode: false });
      selfieSegmentation = segmenter;
      updatePhotoBackgroundStatus('Background removal siap. Hasilnya sederhana ya.');
      resolve(segmenter);
    } catch (err) {
      console.warn('[BG] Selfie segmentation gagal:', err);
      updatePhotoBackgroundStatus('Background removal gagal load, pakai foto asli dulu.');
      resolve(null);
    }
  });
  return selfieSegmentationReady;
}

async function makeBackgroundReplacedPhoto(img, mode, slotIndex) {
  if (mode === 'original') return img;
  const sourceId = img.src || img.currentSrc || `${img.width}x${img.height}`;
  const cacheKey = `${mode}:${slotIndex}:${sourceId.slice(0, 80)}:${sourceId.length}`;
  if (backgroundRemovalCache.has(cacheKey)) return backgroundRemovalCache.get(cacheKey);

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = img.naturalWidth || img.width;
  sourceCanvas.height = img.naturalHeight || img.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  sourceCtx.drawImage(img, 0, 0, sourceCanvas.width, sourceCanvas.height);

  const out = document.createElement('canvas');
  out.width = sourceCanvas.width;
  out.height = sourceCanvas.height;
  const outCtx = out.getContext('2d');
  drawPhotoBackgroundPattern(outCtx, out.width, out.height, mode);

  const segmenter = await ensureSelfieSegmentation();
  if (!segmenter) {
    outCtx.drawImage(sourceCanvas, 0, 0);
    backgroundRemovalCache.set(cacheKey, out);
    return out;
  }

  const mask = await new Promise((resolve) => {
    let resolved = false;
    segmenter.onResults((results) => {
      if (resolved) return;
      resolved = true;
      resolve(results.segmentationMask || null);
    });
    segmenter.send({ image: sourceCanvas }).catch((err) => {
      console.warn('[BG] Segmentasi gagal:', err);
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });
  });

  if (!mask) {
    outCtx.drawImage(sourceCanvas, 0, 0);
    backgroundRemovalCache.set(cacheKey, out);
    return out;
  }

  const personCanvas = document.createElement('canvas');
  personCanvas.width = out.width;
  personCanvas.height = out.height;
  const personCtx = personCanvas.getContext('2d');
  personCtx.drawImage(sourceCanvas, 0, 0);
  personCtx.globalCompositeOperation = 'destination-in';
  personCtx.filter = 'blur(1px)';
  personCtx.drawImage(mask, 0, 0, out.width, out.height);
  personCtx.filter = 'none';
  personCtx.globalCompositeOperation = 'source-over';

  outCtx.drawImage(personCanvas, 0, 0);
  backgroundRemovalCache.set(cacheKey, out);
  return out;
}

function convertDataUrlToCleanBw(dataUrl, contrast = 1.08, brightness = 10) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        const adjusted = Math.max(0, Math.min(255, (lum - 128) * contrast + 128 + brightness));
        data[i] = data[i + 1] = data[i + 2] = adjusted;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ── CANVAS SYNTHESIS & FINAL RENDER ──
async function renderAndGoToFinal(forceDither = false) {
  if (!forceDither) {
    const receiptImage = await buildCompactPrintImage(384);
    document.getElementById('final-render-img').src = receiptImage;
    document.getElementById('print-image-target').src = receiptImage;
    await generateSimulatedQRCode();
    transitionScreen('screen-editor', 'screen-result');
    return null;
  }

  selectSticker(null);

  const canvas = document.getElementById('hidden-strip-canvas');
  const ctx = canvas.getContext('2d');

  const W = 1200;
  const photoCount = selectedPhotoCount;

  // For thermal printing: zero margin so image fills full paper width
  // For preview: normal margins
  const marginX   = forceDither ? 0  : 60;
  const borderTop = forceDither ? 20 : 80;
  const borderBot = forceDither ? 20 : 80;
  const itemGap   = forceDither ? 20 : 50;
  const footerH   = forceDither ? 90 : 150;

  const photoW = W - marginX * 2;
  const photoH = Math.round(photoW * (3 / 4));

  const H = borderTop
    + photoCount * photoH
    + (photoCount - 1) * itemGap
    + footerH
    + borderBot;

  canvas.width  = W;
  canvas.height = H;

  // Frame: always WHITE for thermal, normal color for preview
  if (forceDither) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  } else {
    drawFrameBackground(ctx, W, H);
  }

  // Build photo positions
  const photoPositions = [];
  for (let i = 0; i < photoCount; i++) {
    photoPositions.push({
      x: marginX,
      y: borderTop + i * (photoH + itemGap),
      w: photoW,
      h: photoH
    });
  }

  // Draw photos
  for (let i = 0; i < photoCount; i++) {
    const pos = photoPositions[i];
    const imgObj = new Image();
    imgObj.src = capturedImages[i];

    await new Promise((resolve) => {
      imgObj.onload = () => {
        ctx.save();
        ctx.filter = forceDither ? 'none' : getCanvasFilterString();
        drawImageCover(ctx, imgObj, pos.x, pos.y, pos.w, pos.h);
        ctx.restore();

        if (currentFilter === 'dither' || forceDither) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width  = pos.w;
          tempCanvas.height = pos.h;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(canvas, pos.x, pos.y, pos.w, pos.h, 0, 0, pos.w, pos.h);
          applyFloydSteinbergDithering(tempCanvas);
          ctx.drawImage(tempCanvas, pos.x, pos.y);
        }
        resolve();
      };
      imgObj.onerror = () => {
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(pos.x, pos.y, pos.w, pos.h);
        resolve();
      };
    });
  }

  // Footer text — black on white for thermal
  if (forceDither) {
    const capText = document.getElementById('text-caption-input')?.value || 'Pelanggan Setia';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.font = `bold 36px monospace`;
    ctx.fillText(capText, W / 2, H - borderBot / 2 - 10);
  } else {
    drawFooterText(ctx, W, H);
  }

  if (!forceDither) {
    convertCanvasToMonochrome(canvas);
  }

  const dataURL = canvas.toDataURL('image/png');
  document.getElementById('final-render-img').src = dataURL;
  document.getElementById('print-image-target').src = dataURL;

  generateSimulatedQRCode();

  if (!forceDither) {
    transitionScreen('screen-editor', 'screen-result');
  }

  return canvas;
}

function drawFrameBackground(ctx, W, H) {
  if (currentFrameTheme === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  } else if (currentFrameTheme === 'ink') {
    ctx.fillStyle = '#f4f4f2';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    for (let x = 0.5; x < W; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0.5; y < H; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  } else if (currentFrameTheme === 'black') {
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.11)';
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(Math.random() * W);
      const y = Math.floor(Math.random() * H);
      ctx.fillRect(x, y, Math.random() > 0.92 ? 2 : 1, Math.random() > 0.92 ? 2 : 1);
    }
  } else if (currentFrameTheme === 'gray') {
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, W, H);
  } else if (currentFrameTheme === 'cream') {
    ctx.fillStyle = '#fdf6e2';
    ctx.fillRect(0, 0, W, H);
  } else if (currentFrameTheme === 'pink') {
    ctx.fillStyle = '#ffd6ff';
    ctx.fillRect(0, 0, W, H);
  } else if (currentFrameTheme === 'blue') {
    ctx.fillStyle = '#e8f1f5';
    ctx.fillRect(0, 0, W, H);
  } else if (currentFrameTheme === 'neon') {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#2b0057');
    grad.addColorStop(0.5, '#000000');
    grad.addColorStop(1, '#002b57');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, W-10, H-10);
  }
}

function drawFooterText(ctx, W, H) {
  const capText = document.getElementById('text-caption-input')?.value || 'Pelanggan Setia';
  
  // Setup color
  if (currentFrameTheme === 'white' || currentFrameTheme === 'gray' || currentFrameTheme === 'ink' || currentFrameTheme === 'black') {
    ctx.fillStyle = '#111111';
  } else if (currentFrameTheme === 'cream') {
    ctx.fillStyle = '#5c4033';
  } else if (currentFrameTheme === 'pink') {
    ctx.fillStyle = '#3d0066';
  } else if (currentFrameTheme === 'blue') {
    ctx.fillStyle = '#1d3557';
  } else if (currentFrameTheme === 'neon') {
    ctx.fillStyle = '#00ffff';
  }
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const footerY = H - 95;
  ctx.fillStyle = '#000000';
  
  if (currentFontFamily === 'mono') {
    ctx.font = `900 64px monospace`;
    ctx.fillText(capText.toUpperCase(), W/2, footerY);
  } else if (currentFontFamily === 'serif') {
    ctx.font = `900 64px serif`;
    ctx.fillText(capText.toUpperCase(), W/2, footerY);
  } else if (currentFontFamily === 'hand') {
    ctx.font = `900 64px monospace`;
    ctx.fillText(capText.toUpperCase(), W/2, footerY);
  }
}

function getCanvasFilterString() {
  if (currentFilter === 'retro') return 'sepia(0.35) contrast(1.1) brightness(0.95) saturate(1.1)';
  if (currentFilter === 'cyber') return 'hue-rotate(60deg) saturate(1.8) contrast(1.2)';
  if (currentFilter === 'bw') return 'grayscale(1) contrast(1.3)';
  if (currentFilter === 'warm') return 'sepia(0.15) saturate(1.3) hue-rotate(-10deg)';
  if (currentFilter === 'cold') return 'saturate(0.8) hue-rotate(15deg) contrast(1.05)';
  return 'none'; // normal and dither (dither is pixel processed afterward)
}

async function generateSimulatedQRCode() {
  const container = document.getElementById('share-qr-container');
  if (!container) return;
  const shareUrl = await ensureDigitalShareUrl();
  const canvas = document.createElement('canvas');
  canvas.width = 156;
  canvas.height = 156;
  const ctx = canvas.getContext('2d');
  drawQrCode(ctx, shareUrl, 3, 3, 150);
  container.innerHTML = '';
  container.appendChild(canvas);
}

// ── DOWNLOAD & PRINT ACTIONS ──
function downloadFinalImage() {
  const dataURL = document.getElementById('final-render-img').src;
  const link = document.createElement('a');
  link.download = `photobooth-${activeCode || 'session'}-${Date.now()}.png`;
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function adjustPrintSettings() {
  const paperSize = document.getElementById('print-width-select').value;
  const printImg = document.getElementById('print-image-target');
  if (paperSize === '58mm') {
    printImg.style.width = '100%';
    printImg.style.maxWidth = '58mm';
  } else {
    printImg.style.width = '100%';
    printImg.style.maxWidth = '80mm';
  }
}

async function triggerThermalPrint() {
  const btn = document.querySelector('[onclick="triggerThermalPrint()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }

  const paperSize       = document.getElementById('print-width-select')?.value || '80mm';
  const targetWidthDots = paperSize === '58mm' ? 384 : 576;

  // Pipeline baru: resize → grayscale → adjustment → dithering
  // Generate preview image for system print dialog
  const bitmap      = await buildThermalBitmap(targetWidthDots);

  // Buat canvas final untuk ditampilkan ke dialog print
  const previewCanvas        = document.createElement('canvas');
  previewCanvas.width        = bitmap.widthDots;
  previewCanvas.height       = bitmap.height;
  const pCtx                 = previewCanvas.getContext('2d');
  const imgData              = pCtx.createImageData(bitmap.widthDots, bitmap.height);

  // Decode bitmap bytes kembali ke pixels untuk preview
  for (let row = 0; row < bitmap.height; row++) {
    for (let byteIdx = 0; byteIdx < bitmap.widthBytes; byteIdx++) {
      const byte = bitmap.data[row * bitmap.widthBytes + byteIdx];
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIdx * 8 + bit;
        if (x < bitmap.widthDots) {
          const v   = (byte & (0x80 >> bit)) ? 0 : 255;
          const idx = (row * bitmap.widthDots + x) * 4;
          imgData.data[idx] = imgData.data[idx+1] = imgData.data[idx+2] = v;
          imgData.data[idx+3] = 255;
        }
      }
    }
  }
  pCtx.putImageData(imgData, 0, 0);

  const dataUrl = previewCanvas.toDataURL('image/png');
  document.getElementById('print-image-target').src = dataUrl;
  adjustPrintSettings();

  setTimeout(() => {
    window.print();
    if (btn) { btn.disabled = false; btn.textContent = '🖨 Cetak dari iPad'; }
  }, 400);
}

async function sendPrintJobToCashier() {
  const btn = document.getElementById('btn-print-system');
  const finalImage = document.getElementById('final-render-img')?.src;
  const quantity = getPrintQuantity();

  if (!finalImage) {
    alert('Hasil foto belum siap.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Menyiapkan file cetak...';
  }
  showPrintAnimation('Menyiapkan antrian cetak...');
  startPrintAnimationProgress(0.04, 0.78, 6000);

  try {
    const printImage = await buildCompactPrintImage(384);
    if (btn) btn.textContent = `⏳ Mengirim ${quantity} cetakan...`;
    updatePrintAnimation(`Mengirim ${quantity} cetakan ke printer kasir...`);

    if (isServerMode) {
      const res = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeCode || '',
          image: printImage,
          paperSize: '58mm',
          quantity
        })
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Gagal mengirim job cetak.');
    } else {
      syncChannel.postMessage({
        action: 'request_print',
        sender: 'booth',
        data: {
          code: activeCode || '',
          image: printImage,
          paperSize: '58mm',
          quantity
        }
      });
    }

    if (btn) btn.textContent = '✅ Terkirim ke Kasir';
    updatePrintAnimation('Menunggu printer kasir...');
  } catch (err) {
    console.error('[PRINT JOB]', err);
    hidePrintAnimation(0);
    alert(`Gagal mengirim ke kasir:\n${err.message}`);
    if (btn) btn.textContent = '🖨 Kirim ke Printer Kasir';
  } finally {
    setTimeout(() => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🖨 Kirim ke Printer Kasir';
      }
    }, 3000);
  }
}

async function ensureDigitalShareUrl() {
  if (digitalShareUrl) return digitalShareUrl;

  if (isServerMode && capturedImages.length) {
    try {
      const res = await fetch('/api/digital-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeCode || '',
          images: capturedImages.slice(0, selectedPhotoCount)
        })
      });
      const result = await res.json();
      if (res.ok && result.success && result.path) {
        digitalShareUrl = `${window.location.origin}${result.path}`;
        return digitalShareUrl;
      }
    } catch (err) {
      console.warn('[QR] Gagal membuat link digital:', err);
    }
  }

  digitalShareUrl = window.location.href;
  return digitalShareUrl;
}

function buildQrMatrix(text) {
  const dataCaps = [0, 19, 34, 55, 80, 108];
  const eccLens = [0, 7, 10, 15, 20, 26];
  const byteCaps = [0, 17, 32, 53, 78, 106];
  const bytes = Array.from(text, ch => ch.charCodeAt(0) & 0xFF);
  let version = byteCaps.findIndex((cap, i) => i > 0 && bytes.length <= cap);
  if (version < 1) version = 5;

  const dataCodewords = dataCaps[version];
  const eccLen = eccLens[version];
  const capacityBits = dataCodewords * 8;
  const bits = [];
  const appendBits = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  appendBits(0x4, 4); // byte mode
  appendBits(Math.min(bytes.length, byteCaps[version]), 8);
  bytes.slice(0, byteCaps[version]).forEach(b => appendBits(b, 8));
  appendBits(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let pad = 0; data.length < dataCodewords; pad++) {
    data.push(pad % 2 === 0 ? 0xEC : 0x11);
  }

  const gfExp = new Array(512);
  const gfLog = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = x;
    gfLog[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < gfExp.length; i++) gfExp[i] = gfExp[i - 255];
  const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : gfExp[gfLog[a] + gfLog[b]];

  const divisor = new Array(eccLen).fill(0);
  divisor[eccLen - 1] = 1;
  for (let root = 0; root < eccLen; root++) {
    for (let i = 0; i < eccLen; i++) {
      divisor[i] = gfMul(divisor[i], gfExp[root]);
      if (i + 1 < eccLen) divisor[i] ^= divisor[i + 1];
    }
  }

  const ecc = new Array(eccLen).fill(0);
  data.forEach((b) => {
    const factor = b ^ ecc.shift();
    ecc.push(0);
    for (let i = 0; i < eccLen; i++) ecc[i] ^= gfMul(divisor[i], factor);
  });

  const codewords = data.concat(ecc);
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunc = Array.from({ length: size }, () => Array(size).fill(false));
  const setFunc = (row, col, value) => {
    if (row < 0 || col < 0 || row >= size || col >= size) return;
    modules[row][col] = value;
    isFunc[row][col] = true;
  };

  const drawFinder = (row, col) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunc(row + dy, col + dx, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(3, size - 4);
  drawFinder(size - 4, 3);

  for (let i = 0; i < size; i++) {
    if (!isFunc[6][i]) setFunc(6, i, i % 2 === 0);
    if (!isFunc[i][6]) setFunc(i, 6, i % 2 === 0);
  }

  if (version >= 2) {
    const pos = [6, size - 7];
    pos.forEach(row => pos.forEach(col => {
      if (isFunc[row][col]) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFunc(row + dy, col + dx, dist !== 1);
        }
      }
    }));
  }

  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) setFunc(size - 1 - i, 8, false);
  for (let i = 8; i < 15; i++) setFunc(8, size - 15 + i, false);
  setFunc(version * 4 + 9, 8, true);

  const dataBits = [];
  codewords.forEach(b => appendBitsTo(dataBits, b, 8));

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        if (isFunc[row][col]) continue;
        let bit = bitIndex < dataBits.length ? dataBits[bitIndex++] : 0;
        if ((row + col) % 2 === 0) bit ^= 1;
        modules[row][col] = !!bit;
      }
    }
    upward = !upward;
  }

  drawFormatBits(modules, isFunc, size, 0);
  return modules;
}

function appendBitsTo(out, value, length) {
  for (let i = length - 1; i >= 0; i--) out.push((value >>> i) & 1);
}

function drawFormatBits(modules, isFunc, size, mask) {
  const eclBits = 1; // low error correction
  const data = (eclBits << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if (((rem >>> i) & 1) !== 0) rem ^= 0x537 << (i - 10);
  }
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) !== 0;
  const set = (row, col, value) => {
    modules[row][col] = value;
    isFunc[row][col] = true;
  };

  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
}

function drawQrCode(ctx, text, x, y, requestedSize) {
  const matrix = buildQrMatrix(text);
  const quiet = 4;
  const modules = matrix.length + quiet * 2;
  const scale = Math.max(2, Math.floor(requestedSize / modules));
  const actualSize = modules * scale;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, actualSize, actualSize);
  ctx.fillStyle = '#000000';
  matrix.forEach((row, rowIndex) => {
    row.forEach((on, colIndex) => {
      if (on) {
        ctx.fillRect(x + (colIndex + quiet) * scale, y + (rowIndex + quiet) * scale, scale, scale);
      }
    });
  });

  return actualSize;
}

function sharpenCanvas(sourceCanvas, amount = 0.42) {
  const ctx = sourceCanvas.getContext('2d');
  const { width, height } = sourceCanvas;
  if (width < 3 || height < 3) return sourceCanvas;

  const imgData = ctx.getImageData(0, 0, width, height);
  const src = imgData.data;
  const out = new Uint8ClampedArray(src);
  const center = 1 + amount * 4;
  const clamp = (value) => Math.max(0, Math.min(255, value));

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const top = i - width * 4;
      const bottom = i + width * 4;
      const left = i - 4;
      const right = i + 4;
      for (let c = 0; c < 3; c++) {
        out[i + c] = clamp(
          src[i + c] * center -
          (src[top + c] + src[bottom + c] + src[left + c] + src[right + c]) * amount
        );
      }
    }
  }

  imgData.data.set(out);
  ctx.putImageData(imgData, 0, 0);
  return sourceCanvas;
}

function buildCompactPrintImage(targetWidth = 384, options = {}) {
  return new Promise((resolve, reject) => {
    const photoCount = Math.min(selectedPhotoCount, capturedImages.length);
    const loadImage = (src) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });

    Promise.all(capturedImages.slice(0, photoCount).map(loadImage))
      .then(async (images) => {
        const shareUrl = options.preview
          ? `https://kopimigi.local/d/preview-${selectedPhotoCount}-${currentReceiptTheme}`
          : await ensureDigitalShareUrl();
        const margin = currentFrameTheme === 'ink' ? 6 : 2;
        const gutter = 4;
        const gridW = targetWidth - margin * 2;
        const caption = (document.getElementById('text-caption-input')?.value || 'Pelanggan Setia').toUpperCase();
        const paperGray = '#f4f4f2';
        const bg = currentFrameTheme === 'ink' ? paperGray : currentFrameTheme === 'black' ? '#f2f2ee' : paperGray;
        const fg = '#000000';
        const yellow = '#000000';
        const isGrid = currentPhotoArrangement === 'grid';
        const defaultHeights = photoCount === 1 ? 1022 : photoCount === 2 ? (isGrid ? 922 : 1392) : (isGrid ? 1110 : 1450);
        const mailHeights = photoCount === 1 ? 985 : photoCount === 2 ? (isGrid ? 922 : 1352) : (isGrid ? 1100 : 1450);
        // simple: foto grid kebawah + footer by KOPI MIGI + barcode
        const photoH_simple = Math.round(gridW * 0.75);
        const simpleHeights = 28 + photoCount * (photoH_simple + 6) + 90;
        const totalH = currentReceiptTheme === 'mail' ? mailHeights : currentReceiptTheme === 'simple' ? simpleHeights : defaultHeights;
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, targetWidth, totalH);
        if (currentFrameTheme === 'ink') {
          ctx.save();
          ctx.strokeStyle = 'rgba(0,0,0,0.22)';
          ctx.lineWidth = 1;
          for (let x = 0.5; x < targetWidth; x += 18) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, totalH);
            ctx.stroke();
          }
          for (let y = 0.5; y < totalH; y += 18) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(targetWidth, y);
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = fg;
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2;
        ctx.textBaseline = 'top';

        const centerText = (text, y, font, maxWidth = gridW) => {
          ctx.fillStyle = fg;
          ctx.textAlign = 'center';
          ctx.font = font;
          ctx.fillText(text, targetWidth / 2, y, maxWidth);
          ctx.fillText(text, targetWidth / 2 + 0.35, y, maxWidth);
        };

        const leftText = (text, x, y, font, maxWidth = gridW) => {
          ctx.fillStyle = fg;
          ctx.textAlign = 'left';
          ctx.font = font;
          ctx.fillText(text, x, y, maxWidth);
          ctx.fillText(text, x + 0.35, y, maxWidth);
        };

        const rule = (y) => {
          ctx.fillStyle = yellow;
          ctx.fillRect(margin, y, gridW, 2);
        };

        const drawCrumpledPaperTexture = () => {
          if (currentFrameTheme !== 'black') return;
          let seed = 42 + photoCount * 11 + currentReceiptTheme.length;
          const rand = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
          };
          ctx.save();
          for (let i = 0; i < 1450; i++) {
            const x = Math.floor(rand() * targetWidth);
            const y = Math.floor(rand() * totalH);
            const r = rand() > 0.9 ? 2 : 1;
            ctx.globalAlpha = 0.42 + rand() * 0.38;
            ctx.fillStyle = fg;
            ctx.fillRect(x, y, r, r);
          }

          for (let i = 0; i < 34; i++) {
            const x = Math.floor(rand() * targetWidth);
            const y = Math.floor(rand() * totalH);
            const rx = 2 + rand() * 7;
            const ry = 1 + rand() * 3;
            ctx.globalAlpha = 0.22 + rand() * 0.28;
            ctx.beginPath();
            ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }

          for (let i = 0; i < 26; i++) {
            const x = rand() * targetWidth;
            const y = rand() * totalH;
            const len = 18 + rand() * 74;
            const angle = -0.35 + rand() * 0.7;
            ctx.globalAlpha = 0.25 + rand() * 0.25;
            ctx.lineWidth = rand() > 0.76 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();
          }
          ctx.restore();
        };

        drawCrumpledPaperTexture();

        const dashedRule = (y) => {
          ctx.fillStyle = yellow;
          for (let x = margin; x < targetWidth - margin; x += 12) {
            ctx.fillRect(x, y, 7, 1);
          }
        };

        const barcode = (y, x = margin + 38, h = 26) => {
          ctx.fillStyle = fg;
          let bx = x;
          const pattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 3, 1, 1, 3, 2, 2, 1, 4, 1, 1, 3, 2, 2, 1, 4, 1, 2, 3, 1];
          pattern.forEach((w, i) => {
            if (i % 2 === 0) ctx.fillRect(bx, y, w, h);
            bx += w + 2;
          });
        };

        const miniBarcode = (x, y, w = 124, h = 28) => {
          ctx.fillStyle = fg;
          let bx = x;
          const bars = [3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 2, 4, 1, 1, 2, 3, 1, 2, 4, 1, 1, 3, 2, 2, 1];
          bars.forEach((bar, index) => {
            const bw = Math.max(1, Math.floor(bar * 0.85));
            if (index % 2 === 0) ctx.fillRect(bx, y, bw, h);
            bx += bw + 2;
          });
          ctx.strokeStyle = fg;
          ctx.lineWidth = 1;
          ctx.strokeRect(x - 4, y - 4, w, h + 8);
        };

        const roundedRectPath = (context, x, y, w, h, radius) => {
          const r = Math.min(radius, w / 2, h / 2);
          context.beginPath();
          context.moveTo(x + r, y);
          context.lineTo(x + w - r, y);
          context.quadraticCurveTo(x + w, y, x + w, y + r);
          context.lineTo(x + w, y + h - r);
          context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          context.lineTo(x + r, y + h);
          context.quadraticCurveTo(x, y + h, x, y + h - r);
          context.lineTo(x, y + r);
          context.quadraticCurveTo(x, y, x + r, y);
          context.closePath();
        };

        const circlePath = (context, x, y, w, h) => {
          const r = Math.min(w, h) / 2;
          context.beginPath();
          context.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
          context.closePath();
        };

        const scallopPath = (context, x, y, w, h) => {
          const cx = x + w / 2;
          const cy = y + h / 2;
          const base = Math.min(w, h) / 2;
          const steps = 144;
          context.beginPath();
          for (let i = 0; i <= steps; i++) {
            const angle = (Math.PI * 2 * i) / steps;
            const wave = Math.sin(angle * 24) * base * 0.045;
            const r = base * 0.94 + wave;
            const px = cx + Math.cos(angle) * r;
            const py = cy + Math.sin(angle) * r;
            if (i === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
          }
          context.closePath();
        };

        const photoFramePath = (context, x, y, w, h, radius) => {
          if (photoCount === 1 && currentSingleFrameShape === 'circle') {
            circlePath(context, x, y, w, h);
            return;
          }
          if (photoCount === 1 && currentSingleFrameShape === 'scallop') {
            scallopPath(context, x, y, w, h);
            return;
          }
          roundedRectPath(context, x, y, w, h, radius);
        };

        const drawQr = (y) => {
          const qrTarget = 214;
          const actualSize = drawQrCode(ctx, shareUrl, Math.round((targetWidth - qrTarget) / 2), y, qrTarget);
          centerText('SCAN FOR ORIGINAL FILE', y + actualSize + 11, '900 12px monospace');
          return actualSize;
        };

        const drawCutGuide = () => {
          const y = totalH - THERMAL_CUT_GUIDE_BOTTOM_PADDING;
          ctx.save();
          ctx.strokeStyle = fg;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 6]);
          ctx.beginPath();
          ctx.moveTo(margin, y);
          ctx.lineTo(targetWidth - margin, y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        };

        const drawPhoto = async (img, x, y, w, h, label = '', slotIndex = 1) => {
          const photoCanvas = document.createElement('canvas');
          photoCanvas.width = Math.max(1, Math.round(w));
          photoCanvas.height = Math.max(1, Math.round(h));
          const photoCtx = photoCanvas.getContext('2d');
          photoCtx.fillStyle = '#ffffff';
          photoCtx.fillRect(0, 0, photoCanvas.width, photoCanvas.height);
          photoCtx.filter = 'grayscale(1) contrast(1.16) brightness(1.1)';
          const offset = getPhotoFrameOffset(slotIndex);
          const bgImage = await makeBackgroundReplacedPhoto(img, currentPhotoBackground, slotIndex);
          drawImageCover(photoCtx, bgImage, 0, 0, photoCanvas.width, photoCanvas.height, offset.x, offset.y);
          photoCtx.filter = 'none';
          sharpenCanvas(photoCanvas, 0.55);
          const radius = Math.max(8, Math.min(14, Math.round(Math.min(w, h) * 0.08)));
          ctx.save();
          photoFramePath(ctx, x, y, w, h, radius);
          ctx.clip();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, w, h);
          ctx.drawImage(photoCanvas, x, y, w, h);
          ctx.restore();
          if (photoCount !== 4) {
            ctx.strokeStyle = fg;
            ctx.lineWidth = 2;
            photoFramePath(ctx, x, y, w, h, radius);
            ctx.stroke();
          }
          if (label) {
            const labelW = label.length > 5 ? 70 : 58;
            ctx.fillStyle = bg;
            ctx.fillRect(x + 6, y + 6, labelW, 18);
            leftText(label, x + 10, y + 9, '900 10px monospace', labelW - 8);
          }
        };

        const drawPurchaseReceipt = (title, itemText, totalText, bottomY) => {
          centerText('KOPIMIGI', 14, '900 36px monospace');
          centerText('CREATE STORY', 56, '700 15px monospace');
          rule(86);

          leftText(`DATE    : ${new Date().toLocaleDateString('id-ID')}`, margin, 98, '700 13px monospace');
          leftText(`SESSION : ${activeCode || '0000'}`, margin, 118, '700 13px monospace');
          leftText(`PEMBELI : ${caption}`, margin, 138, '900 13px monospace', gridW);
          dashedRule(158);

          leftText('QTY  ITEM', margin, 174, '900 13px monospace');
          ctx.textAlign = 'right';
          ctx.font = '900 13px monospace';
          ctx.fillText('PRICE', targetWidth - margin, 174);
          leftText(`1    ${itemText}`, margin, 195, '700 13px monospace', gridW - 78);
          ctx.textAlign = 'right';
          ctx.font = '700 13px monospace';
          ctx.fillText(totalText, targetWidth - margin, 195);
          leftText(`1    ${title}`, margin, 216, '700 13px monospace', gridW - 78);
          ctx.textAlign = 'right';
          ctx.font = '700 13px monospace';
          ctx.fillText('FREE', targetWidth - margin, 215);
          dashedRule(238);

          leftText('TOTAL', margin, 254, '900 20px monospace');
          ctx.textAlign = 'right';
          ctx.font = '900 26px monospace';
          ctx.fillText(totalText, targetWidth - margin, 247);
          centerText('THANK YOU FOR THE SMILE', 292, '900 13px monospace');
          centerText(new Date().toLocaleString('id-ID'), 314, '700 12px monospace');
          rule(bottomY);
        };

        const drawStoreReceipt = (title, bottomY) => {
          centerText('RECEIPT PHOTOBOOTH', 16, '900 26px monospace');
          centerText('KOPIMIGI STORE', 50, '700 14px monospace');
          rule(73);
          leftText(`BUYER   : ${caption}`, margin, 90, '900 13px monospace', gridW);
          leftText(`DATE    : ${new Date().toLocaleDateString('id-ID')}`, margin, 110, '700 13px monospace');
          leftText(`SESSION : ${activeCode || '0000'}`, margin, 130, '700 13px monospace');
          dashedRule(151);
          leftText('QTY  DESCRIPTION', margin, 168, '900 13px monospace');
          ctx.textAlign = 'right';
          ctx.font = '900 13px monospace';
          ctx.fillText('AMOUNT', targetWidth - margin, 168);
          leftText(`1    ${title}`, margin, 190, '700 13px monospace', gridW - 78);
          ctx.textAlign = 'right';
          ctx.font = '700 13px monospace';
          ctx.fillText('15K', targetWidth - margin, 190);
          leftText('1    DIGITAL ORIGINAL', margin, 212, '700 13px monospace', gridW - 78);
          ctx.textAlign = 'right';
          ctx.font = '700 13px monospace';
          ctx.fillText('QR', targetWidth - margin, 211);
          dashedRule(236);
          leftText('TOTAL', margin, 252, '900 20px monospace');
          ctx.textAlign = 'right';
          ctx.font = '900 26px monospace';
          ctx.fillText('15K', targetWidth - margin, 246);
          centerText('THANK YOU - PLEASE COME AGAIN', 292, '900 12px monospace');
          rule(bottomY);
        };

        const drawMailHeader = (title, bottomY) => {
          ctx.fillStyle = fg;
          ctx.fillRect(margin, 14, gridW, 48);
          ctx.fillStyle = bg;
          ctx.textAlign = 'center';
          ctx.font = '900 33px monospace';
          ctx.fillText('MIGIEXPRESS', targetWidth / 2, 20, gridW);
          ctx.fillText('MIGIEXPRESS', targetWidth / 2 + 0.4, 20, gridW);

          ctx.fillStyle = fg;
          centerText('PHOTO DELIVERY RECEIPT', 71, '900 15px monospace');
          rule(98);

          leftText('RESI', margin, 114, '900 14px monospace');
          leftText(`MGX-${activeCode || '0000'}-${String(Date.now()).slice(-4)}`, margin + 50, 114, '900 15px monospace', gridW - 178);
          miniBarcode(targetWidth - margin - 122, 109, 118, 26);

          dashedRule(153);
          leftText(`TO      : ${caption}`, margin, 168, '900 15px monospace', gridW);
          leftText(`SERVICE : PHOTOBOOTH EXPRESS`, margin, 193, '900 14px monospace', gridW);
          leftText(`PACKAGE : ${title}`, margin, 216, '900 14px monospace', gridW);
          leftText(`DATE    : ${new Date().toLocaleDateString('id-ID')}`, margin, 239, '700 14px monospace', gridW);
          dashedRule(266);
          rule(bottomY);
        };

        const drawCountPhotos = async (startY, sizes) => {
          if (photoCount === 1) {
            await drawPhoto(images[0], margin, startY, gridW, sizes.singleH, '', 1);
            return startY + sizes.singleH;
          }

          if (photoCount === 2) {
            if (currentPhotoArrangement === 'grid') {
              const photoW = Math.floor((gridW - gutter) / 2);
              const h = sizes.twoGridH || sizes.gridH || sizes.twoH;
              await drawPhoto(images[0], margin, startY, photoW, h, '', 1);
              await drawPhoto(images[1], margin + photoW + gutter, startY, photoW, h, '', 2);
              return startY + h;
            }
            await drawPhoto(images[0], margin, startY, gridW, sizes.twoH, '', 1);
            await drawPhoto(images[1], margin, startY + sizes.twoH + gutter, gridW, sizes.twoH, '', 2);
            return startY + sizes.twoH * 2 + gutter;
          }

          if (photoCount === 4) {
            if (currentPhotoArrangement === 'grid') {
              const photoW = Math.floor((gridW - gutter) / 2);
              for (let index = 0; index < images.length; index++) {
                const img = images[index];
                const col = index % 2;
                const row = Math.floor(index / 2);
                await drawPhoto(img, margin + col * (photoW + gutter), startY + row * (sizes.gridH + gutter), photoW, sizes.gridH, '', index + 1);
              }
              return startY + sizes.gridH * 2 + gutter;
            }
            const photoW = Math.floor((gridW - gutter) / 2);
            await drawPhoto(images[0], margin, startY, gridW, 292, '', 1);
            dashedRule(startY + 309);
            centerText('RECEIPT FRAME', startY + 309, '900 15px monospace');
            await drawPhoto(images[1], margin, startY + 322, photoW, 176, '', 2);
            await drawPhoto(images[2], margin + photoW + gutter, startY + 322, photoW, 176, '', 3);
            await drawPhoto(images[3], margin, startY + 528, gridW, 292, '', 4);
            return startY + 820;
          }

          const photoW = Math.floor((gridW - gutter) / 2);
          for (let index = 0; index < images.length; index++) {
            const img = images[index];
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = margin + col * (photoW + gutter);
            const y = startY + row * (sizes.gridH + gutter);
            await drawPhoto(img, x, y, photoW, sizes.gridH, '', index + 1);
          }
          return startY + sizes.gridH * 2 + gutter;
        };

        const frameTitle = photoCount === 1 ? 'SINGLE FRAME' : photoCount === 2 ? 'DOUBLE FRAME' : 'FOUR FRAME GRID';

        if (currentReceiptTheme === 'simple') {
          // ── SIMPLE GRID: foto berurutan kebawah, footer brand + random barcode ──
          const pH = Math.round(gridW * 0.75);
          let y = 16;
          for (let i = 0; i < photoCount; i++) {
            await drawPhoto(images[i], margin, y, gridW, pH, '', i + 1);
            y += pH + 6;
          }
          // Separator
          rule(y + 8);
          // Brand footer
          centerText('by KOPI MIGI', y + 18, '900 18px monospace');
          centerText('PHOTOBOOTH', y + 42, '700 11px monospace');
          // Random barcode — nilai seed dari timestamp sesi
          const barcodeY = y + 60;
          const seed = parseInt(activeCode?.replace(/\D/g, '') || '0') || Date.now() % 9999;
          ctx.fillStyle = fg;
          let bx = margin + 10;
          const barcodeW = gridW - 20;
          // Generate pola bar random tapi deterministik dari seed
          let s = seed;
          const rand11 = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s % 4) + 1; };
          let totalDrawn = 0;
          while (totalDrawn < barcodeW - 6) {
            const barW = rand11();
            const gap  = rand11() - 1;
            ctx.fillRect(bx, barcodeY, barW, 22);
            bx += barW + gap + 1;
            totalDrawn += barW + gap + 1;
          }
          // Nomor di bawah barcode
          centerText(String(seed).padStart(8, '0'), barcodeY + 26, '700 9px monospace');
        } else if (currentReceiptTheme === 'purchase') {
          drawStoreReceipt(frameTitle, 322);
          const photoEnd = await drawCountPhotos(340, { singleH: gridW, twoH: gridW, twoGridH: 292, gridH: 237 });
          await drawQr(photoEnd + 22);
        } else if (currentReceiptTheme === 'mail') {
          drawMailHeader(frameTitle, 282);
          const photoEnd = await drawCountPhotos(300, { singleH: gridW, twoH: gridW, twoGridH: 292, gridH: 237 });
          dashedRule(photoEnd + 16);
          centerText('DELIVERED WITH YOUR BEST SMILE', photoEnd + 34, '900 14px monospace');
          await drawQr(photoCount === 4 ? photoEnd + 68 : photoEnd + 66);
        } else if (photoCount === 1) {
          drawPurchaseReceipt('SINGLE FRAME', 'PHOTO SESSION', '15K', 345);
          await drawPhoto(images[0], margin, 363, gridW, gridW, '', 1);
          await drawQr(765);
        } else if (photoCount === 2) {
          drawPurchaseReceipt('DOUBLE FRAME', 'PHOTO SESSION', '15K', 345);
          const photoEnd = await drawCountPhotos(363, { twoH: gridW, twoGridH: 292, gridH: 237 });
          await drawQr(photoEnd + 28);
        } else {
          drawPurchaseReceipt('FOUR FRAME', 'PHOTO SESSION', '15K', 345);
          const photoEnd = await drawCountPhotos(363, { gridH: 237 });
          await drawQr(photoEnd + 28);
        }

        drawCutGuide();
        resolve(canvas.toDataURL('image/png'));
      })
      .catch(reject);
  });
}

// ── BLUETOOTH THERMAL PRINTER (ESC/POS) ──

// Common Bluetooth printer service + characteristic UUIDs (ESC/POS standard)
const BLE_PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic ESC/POS (Xprinter, HOIN, etc.)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Common Nordic UART-like profile
  '0000ff00-0000-1000-8000-00805f9b34fb', // HOIN & Milestone
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Paperang / Phomemo style
];

const BLE_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

let bleDevice         = null;
let bleCharacteristic = null;

// ── OPERATOR MENU (popup kanan atas) ──
function toggleOperatorMenu() {
  const menu = document.getElementById('operator-menu');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  menu.style.display = isOpen ? 'none' : 'block';
  // Tutup saat klik di luar
  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener('click', closeOperatorMenuOutside, { once: true });
    }, 10);
  }
}

function closeOperatorMenuOutside(e) {
  const menu = document.getElementById('operator-menu');
  const btn  = document.getElementById('operator-menu-btn');
  if (menu && !menu.contains(e.target) && e.target !== btn) {
    menu.style.display = 'none';
  }
}

function updateBleStatus(status, color) {
  const badges     = document.querySelectorAll('.ble-status-badge');
  const connectBtn = document.getElementById('btn-connect-ble');
  const printBtn   = document.getElementById('btn-print-ble');
  const nameEl     = document.getElementById('ble-device-name');

  badges.forEach((badge) => {
    badge.textContent        = status;
    badge.style.color        = color;
    badge.style.background   = color + '22';
  });

  if (status === 'TERSAMBUNG') {
    if (connectBtn) connectBtn.textContent = `🔄 Ganti Printer`;
    if (printBtn)   { printBtn.disabled = false; printBtn.textContent = '🖨 Cetak Bluetooth Tablet'; }
    if (nameEl && bleDevice) nameEl.textContent = bleDevice.name || '';
  } else if (status === 'MENGHUBUNGKAN...') {
    if (connectBtn) { connectBtn.textContent = '⏳ Menghubungkan...'; connectBtn.disabled = true; }
  } else {
    if (connectBtn) { connectBtn.textContent = '🔌 Sambungkan Printer'; connectBtn.disabled = false; }
    if (printBtn)   printBtn.textContent = '🖨 Cetak Bluetooth Tablet';
    if (nameEl)     nameEl.textContent = '';
  }
}

function updateBoothPrinterUI(isReady) {
  if (isReady) {
    updateBleStatus('KASIR SIAP', '#22c55e');
  } else if (!bleCharacteristic) {
    updateBleStatus('TERPUTUS', '#ef4444');
  }
}

async function connectBluetoothPrinter() {
  if (!navigator.bluetooth) {
    alert('Web Bluetooth tidak didukung.\nGunakan Google Chrome dan pastikan bukan mode Incognito.');
    return;
  }
  updateBleStatus('MENGHUBUNGKAN...', '#f59e0b');
  try {
    bleDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_PRINTER_SERVICE_UUIDS
    });
    bleDevice.addEventListener('gattserverdisconnected', () => {
      bleCharacteristic = null;
      updateBleStatus('TERPUTUS', '#ef4444');
    });

    const server = await bleDevice.gatt.connect();

    let service = null;
    for (const uuid of BLE_PRINTER_SERVICE_UUIDS) {
      try { service = await server.getPrimaryService(uuid); break; } catch {}
    }
    if (!service) {
      const all = await server.getPrimaryServices();
      service = all[0];
    }
    if (!service) throw new Error('Tidak ada GATT service ditemukan.');

    let characteristic = null;
    for (const uuid of BLE_CHAR_UUIDS) {
      try { characteristic = await service.getCharacteristic(uuid); break; } catch {}
    }
    if (!characteristic) {
      const allChars = await service.getCharacteristics();
      characteristic = allChars.find(c => c.properties.write || c.properties.writeWithoutResponse);
    }
    if (!characteristic) throw new Error('Tidak ada characteristic write ditemukan.');

    bleCharacteristic = characteristic;
    updateBleStatus('TERSAMBUNG', '#22c55e');
    console.log(`[BLE] Printer siap: ${bleDevice.name || 'Unknown'}`);

  } catch (err) {
    updateBleStatus('TERPUTUS', '#ef4444');
    if (!err.message?.includes('cancelled') && !err.message?.includes('User cancelled')) {
      alert(`Koneksi gagal: ${err.message}`);
    }
  }
}

// Build complete ESC/POS byte sequence for printing the strip image
function buildEscPosCommands(bitmapResult) {
  return canvasToStripeEscPos(bitmapResult);
}

function processImageDataUrlForThermal(imgSrc, targetWidth = 384) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      targetWidth = Math.floor(targetWidth / 8) * 8;
      const targetHeight = Math.round(img.height * (targetWidth / img.width));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imgData.data;
      const total = targetWidth * targetHeight;
      const gray = new Float32Array(total);
      const bayer4 = [
         0,  8,  2, 10,
        12,  4, 14,  6,
         3, 11,  1,  9,
        15,  7, 13,  5
      ];

      for (let i = 0; i < total; i++) {
        const lum = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
        if (lum < 24) {
          gray[i] = 0;
        } else if (lum > 244) {
          gray[i] = 255;
        } else {
          gray[i] = Math.max(0, Math.min(255, (lum - 128) * 0.82 + 128 + 36));
        }
      }

      for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
          const i = y * targetWidth + x;
          const threshold = 114 + bayer4[(y & 3) * 4 + (x & 3)] * 4;
          const v = gray[i] < threshold ? 0 : 255;
          data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
          data[i * 4 + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = imgSrc;
  });
}

function canvasToStripeEscPos(canvas) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const bytes = [
    0x1B, 0x40,
    0x1B, 0x33, 0x18,
    0x1B, 0x4D, 0x01,
    0x1B, 0x61, 0x00
  ];
  const stripeHeight = 24;
  const nL = width & 0xFF;
  const nH = (width >> 8) & 0xFF;

  for (let y = 0; y < height; y += stripeHeight) {
    bytes.push(0x1B, 0x2A, 0x21, nL, nH);
    for (let x = 0; x < width; x++) {
      for (let byteIndex = 0; byteIndex < 3; byteIndex++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const yy = y + byteIndex * 8 + bit;
          if (yy < height && pixels[(yy * width + x) * 4] < 128) byte |= (0x80 >> bit);
        }
        bytes.push(byte);
      }
    }
    bytes.push(0x0A);
  }

  bytes.push(0x1B, 0x32);
  bytes.push(0x1B, 0x4A, THERMAL_POST_PRINT_FEED_DOTS);
  bytes.push(0x1D, 0x56, 0x42, 0x00);
  return new Uint8Array(bytes);
}

// Write bytes to BLE in chunks
async function writeBleChunked(characteristic, data, chunkSize = 128, delayMs = 25, onProgress = null) {
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.slice(offset, offset + chunkSize);
    try {
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
    } catch (e) {
      console.error(`[BLE] Chunk error at ${offset}:`, e);
      throw e;
    }
    if (onProgress) onProgress(Math.min(1, (offset + chunk.length) / data.length));
    await new Promise(r => setTimeout(r, delayMs));
  }
}

// ── PRINT ──
function showPrintAnimation(message = 'Mencetak...') {
  const overlay = document.getElementById('print-animation-overlay');
  const receipt = document.getElementById('print-animation-receipt');
  const text = document.getElementById('print-animation-text');
  const finalImage = document.getElementById('final-render-img')?.src;
  if (!overlay || !receipt || !text) return;
  receipt.src = finalImage || '';
  text.textContent = message;
  overlay.style.display = 'flex';
  updatePrintAnimationProgress(0);
}

function startPrintAnimationProgress(from = 0, to = 0.86, duration = 6500) {
  clearInterval(printAnimationTimer);
  const startedAt = Date.now();
  updatePrintAnimationProgress(from);
  printAnimationTimer = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const t = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - t, 2);
    updatePrintAnimationProgress(from + (to - from) * eased);
    if (t >= 1) clearInterval(printAnimationTimer);
  }, 120);
}

function stopPrintAnimationProgress() {
  clearInterval(printAnimationTimer);
  printAnimationTimer = null;
}

function updatePrintAnimation(message) {
  const text = document.getElementById('print-animation-text');
  if (text) text.textContent = message;
}

function updatePrintAnimationProgress(progress) {
  const receipt = document.getElementById('print-animation-receipt');
  if (!receipt) return;
  const p = Math.max(0, Math.min(1, progress));
  const translateY = -190 + p * 260;
  const scaleY = 0.42 + p * 0.58;
  receipt.style.transform = `translateY(${translateY}px) scaleY(${scaleY})`;
}

function hidePrintAnimation(delay = 700) {
  const overlay = document.getElementById('print-animation-overlay');
  if (!overlay) return;
  setTimeout(() => {
    stopPrintAnimationProgress();
    updatePrintAnimationProgress(0);
    overlay.style.display = 'none';
  }, delay);
}

function scheduleSessionAutoFinish(message = 'Cetak selesai. Sesi selesai dalam 10 detik...') {
  if (autoFinishTimer) return;

  const btn = document.getElementById('btn-print-ble');
  const resultSubtitle = document.querySelector('#screen-result .card-subtitle');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '✅ Sesi selesai dalam 10 detik';
  }
  if (resultSubtitle) resultSubtitle.textContent = message;
  updatePrintAnimation(message);
  stopPrintAnimationProgress();
  updatePrintAnimationProgress(PRINT_ANIMATION_FINAL_PROGRESS);

  autoFinishTimer = setTimeout(() => {
    autoFinishTimer = null;
    hidePrintAnimation(0);
    completeSessionAndExit();
  }, 10000);
}

function getPrintQuantity() {
  return Math.max(1, Math.min(MAX_PRINT_QUANTITY, Number(currentPrintQuantity) || 1));
}

async function printViaBluetooth() {
  const btn = document.getElementById('btn-print-ble');
  const quantity = getPrintQuantity();
  if (!bleCharacteristic) {
    // Coba broadcast ke kasir sebagai fallback
    if (window._syncChannel) {
      showPrintAnimation('Mengirim antrian ke kasir...');
      startPrintAnimationProgress(0.04, 0.78, 5200);
      btn.disabled    = true;
      btn.textContent = `⏳ Mengirim ${quantity} cetakan...`;
      const printImage = await buildCompactPrintImage(384);
      window._syncChannel.postMessage({
        action: 'request_print',
        sender: 'booth',
        data: {
          code: activeCode || '',
          image: printImage,
          paperSize: '58mm',
          quantity
        }
      });
      btn.textContent = '✅ Terkirim ke Kasir!';
      updatePrintAnimation('Menunggu printer kasir...');
      setTimeout(() => { btn.disabled = false; btn.textContent = '🖨 Cetak Bluetooth Tablet'; }, 3000);
    } else {
      alert('Printer belum terhubung.\nBuka menu ⚙️ di pojok kanan atas untuk menyambungkan printer.');
    }
    return;
  }

  btn.disabled    = true;
  btn.textContent = '⏳ Memproses...';
  showPrintAnimation('Menyiapkan cetakan...');
  stopPrintAnimationProgress();
  updatePrintAnimationProgress(0.04);

  try {
    const compactPrintImage = await buildCompactPrintImage(384);
    updatePrintAnimationProgress(0.09);
    const thermalCanvas = await processImageDataUrlForThermal(compactPrintImage, 384);
    updatePrintAnimationProgress(0.14);
    const escPosBytes = canvasToStripeEscPos(thermalCanvas);

    for (let copy = 1; copy <= quantity; copy++) {
      btn.textContent = quantity > 1 ? `⏳ Mencetak ${copy}/${quantity}...` : '⏳ Mencetak...';
      updatePrintAnimation(quantity > 1 ? `Struk ${copy}/${quantity} sedang keluar...` : 'Struk sedang keluar...');
      await writeBleChunked(bleCharacteristic, escPosBytes, 128, 25, (progress) => {
        updatePrintAnimationProgress(0.14 + ((copy - 1 + progress) / quantity) * 0.86);
      });
      if (copy < quantity) await new Promise(r => setTimeout(r, 450));
    }

    btn.textContent = '✅ Tercetak!';
    updatePrintAnimation('Cetakan selesai');
    updatePrintAnimationProgress(PRINT_ANIMATION_FINAL_PROGRESS);
    updateBleStatus('TERSAMBUNG', '#22c55e');
    scheduleSessionAutoFinish('Cetak selesai. Sesi selesai dalam 10 detik...');

  } catch (err) {
    console.error('[BLE] Print error:', err);
    btn.disabled    = false;
    btn.textContent = '🖨 Cetak Bluetooth Tablet';
    hidePrintAnimation(0);
    alert(`Gagal mencetak:\n${err.message}`);
  }
}


function completeSessionAndExit() {
  if (autoFinishTimer) {
    clearTimeout(autoFinishTimer);
    autoFinishTimer = null;
  }

  // Mark session as used
  if (activeCode) {
    if (isServerMode) {
      sendServerAction('finish', activeCode);
    } else {
      loadLocalSessions();
      const s = sessions.find(x => x.code === activeCode);
      if (s) {
        s.status = 'used';
        localStorage.setItem('pb_sessions', JSON.stringify(sessions));
        syncChannel.postMessage({ action: 'finish_session', data: { code: activeCode }, sender: 'booth' });
      }
    }
  }
  
  activeCode = '';
  digitalShareUrl = '';
  document.getElementById('booth-input-code').value = '';
  document.getElementById('generated-box-booth')?.remove(); // if any
  const resultSubtitle = document.querySelector('#screen-result .card-subtitle');
  if (resultSubtitle) resultSubtitle.textContent = 'Simpan cetakan digital atau cetak melalui dialog print iPad';
  const printBtn = document.getElementById('btn-print-ble');
  if (printBtn) {
    printBtn.disabled = false;
    printBtn.textContent = '🖨 Cetak Bluetooth Tablet';
  }
  currentPrintQuantity = 1;
  const note = document.getElementById('print-qty-note');
  if (note) note.textContent = 'Jumlah cetak mengikuti order kasir.';
  resetLoginMessages();
  
  // Transition back to login
  transitionScreen('screen-result', 'screen-login');
  
  // Force reset fields
  setTimeout(() => {
    document.getElementById('booth-input-code').focus();
  }, 500);
}

function initGridBackground() {
  const canvas = document.getElementById('dots-background');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const pointer = { x: 0, y: 0, active: false };
  const points = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let animationFrame = 0;
  let time = 0;
  let cols = 0;
  let rows = 0;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function buildGridPoints() {
    points.length = 0;
    const spacing = width < 520 ? 42 : 52;
    cols = Math.ceil(width / spacing) + 3;
    rows = Math.ceil(height / spacing) + 3;
    const offsetX = (width - (cols - 1) * spacing) / 2;
    const offsetY = (height - (rows - 1) * spacing) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        points.push({
          baseX: offsetX + col * spacing,
          baseY: offsetY + row * spacing,
          x: offsetX + col * spacing,
          y: offsetY + row * spacing,
          col,
          row,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  function resizeGrid() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildGridPoints();
  }

  function updatePoint(point) {
    const waveX = Math.sin(time * 0.0014 + point.row * 0.55 + point.phase) * 5.5;
    const waveY = Math.cos(time * 0.0012 + point.col * 0.5 + point.phase) * 5.5;
    let x = point.baseX + waveX;
    let y = point.baseY + waveY;
    let glow = 0;

    if (pointer.active) {
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const dist = Math.hypot(dx, dy);
      const radius = width < 520 ? 150 : 210;
      if (dist < radius && dist > 0) {
        const pull = (1 - dist / radius);
        x += (dx / dist) * pull * 18;
        y += (dy / dist) * pull * 18;
        glow = pull;
      }
    }

    point.x = x;
    point.y = y;
    point.glow = glow;
  }

  function drawGrid() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (!prefersReducedMotion) {
      time += 16;
    }

    points.forEach(updatePoint);
    const pointAt = (col, row) => points[row * cols + col];

    ctx.lineWidth = 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const point = pointAt(col, row);
        if (!point) continue;
        const alpha = 0.12 + point.glow * 0.42;
        ctx.strokeStyle = `rgba(48, 68, 143, ${alpha})`;
        if (col < cols - 1) {
          const right = pointAt(col + 1, row);
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(right.x, right.y);
          ctx.stroke();
        }
        if (row < rows - 1) {
          const down = pointAt(col, row + 1);
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(down.x, down.y);
          ctx.stroke();
        }
      }
    }

    points.forEach((point) => {
      const pulse = 0.5 + Math.sin(time * 0.002 + point.phase) * 0.5;
      const radius = 1.4 + pulse * 0.8 + point.glow * 1.8;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(48, 68, 143, ${0.34 + point.glow * 0.46})`;
      ctx.fill();
    });

    if (pointer.active) {
      const gradient = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, width < 520 ? 150 : 210);
      gradient.addColorStop(0, 'rgba(48, 68, 143, 0.08)');
      gradient.addColorStop(1, 'rgba(48, 68, 143, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, width < 520 ? 150 : 210, 0, Math.PI * 2);
      ctx.fill();
    }

    animationFrame = requestAnimationFrame(drawGrid);
  }

  window.addEventListener('resize', resizeGrid);
  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  }, { passive: true });
  window.addEventListener('pointerleave', () => {
    pointer.active = false;
  });

  resizeGrid();
  cancelAnimationFrame(animationFrame);
  drawGrid();
}

// ── INITIALIZATION ──
document.addEventListener('DOMContentLoaded', () => {
  initGridBackground();

  // Simpan BroadcastChannel agar bisa diakses printViaBluetooth
  window._syncChannel = new BroadcastChannel('photobooth-sync');

  // Dengarkan update dari kasir
  window._syncChannel.onmessage = (e) => {
    const { action, data, sender } = e.data;
    if (sender !== 'cashier') return;

    if (action === 'printer_ready') {
      updateBoothPrinterUI(data.ready);
    }
    else if (action === 'print_done') {
      console.log(`[BOOTH] Cetak selesai untuk sesi ${data.code}`);
      if (!data?.code || data.code === activeCode) {
        scheduleSessionAutoFinish('Cetak selesai di kasir. Sesi selesai dalam 10 detik...');
      }
    }
    else if (action === 'code_claimed_ok') {
      console.log(`[BOOTH] Kode ${data.code} dikonfirmasi kasir`);
    }
    else if (action === 'update_sessions') {
      // Kasir kirim daftar sesi terbaru
      if (data) window._latestSessions = data;
    }
  };

  // Minta status printer saat booth dibuka
  window._syncChannel.postMessage({
    action: 'request_sync',
    sender: 'booth',
    data: {}
  });

  requestInitialSync();

  // Set default photo count button as active
  const defaultBtn = document.getElementById('default-count-btn');
  if (defaultBtn) defaultBtn.classList.add('active');

  // Set default strip class
  const strip = document.getElementById('strip-preview');
  if (strip) {
    strip.classList.add('layout-4cut', 'receipt-concept-4');
    updateReceiptPreviewConcept(4);
  }
  syncReceiptThemeControls();
  initReceiptPreviewSwipe();

  // Bind enter key on login input
  document.getElementById('booth-input-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyCode();
  });

  const fullscreenBtn = document.getElementById('btn-fullscreen-booth');
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleBoothFullscreen);
});
