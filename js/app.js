import { initBranch, getBranchName } from './branch.js';
import { initSupabase, logPlayEvent, getSupabaseClient } from './supabase.js';

let playlist = [];
let currentTrackIndex = 0;
let isPlaying = false;
let isDragging = false;

const audio = document.getElementById('audio-engine');
const preloader = document.getElementById('audio-preloader');

const btnPlay = document.getElementById('btn-play');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const playerTitle = document.getElementById('player-title');
const currentBadge = document.getElementById('current-badge');
const progressFill = document.getElementById('progress-fill');
const progressBar = document.getElementById('progress-bar');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const visualizer = document.getElementById('visualizer');
const trackListContainer = document.getElementById('track-list-container');
const trackCountText = document.getElementById('track-count-text');
const autoplayHint = document.getElementById('autoplay-hint');

function formatTime(seconds) {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function getCurrentTrack() {
  return playlist[currentTrackIndex] || null;
}

function getTrackDuration(track) {
  if (!track) return 0;
  return track.duration || 0;
}

function getActiveDuration() {
  const track = getCurrentTrack();
  const known = getTrackDuration(track);
  if (known > 0) return known;
  if (audio.duration && isFinite(audio.duration)) return audio.duration;
  return 0;
}

function cacheAudioInSW(url) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CACHE_AUDIO', url });
  }
}

function trackEvent(eventType) {
  const track = getCurrentTrack();
  if (!track) return;
  logPlayEvent({
    branchName: getBranchName(),
    songName: track.title,
    eventType
  });
}

async function loadSongsFromJson() {
  try {
    const res = await fetch('songs.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Could not fetch songs.json');

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Playlist is empty');
    }

    playlist = data.map((item, index) => ({
      id: item.id ?? index + 1,
      title: item.title,
      src: item.src,
      duration: item.duration ?? 0
    }));

    const totalSeconds = playlist.reduce((acc, t) => acc + (t.duration || 0), 0);
    trackCountText.textContent = totalSeconds > 0
      ? `${playlist.length} Tracks • ${formatTime(totalSeconds)}`
      : `${playlist.length} Tracks`;

    renderPlaylist();
    loadTrack(0);
  } catch (err) {
    console.error('Playlist load failed:', err);
    playlist = [];
    playerTitle.textContent = 'Error loading playlist';
    trackCountText.textContent = '0 Tracks';
    trackListContainer.innerHTML =
      '<div class="error-state">Could not load songs.json. Run <code>npm run generate-playlist</code> first.</div>';
  }
}

function renderPlaylist() {
  trackListContainer.innerHTML = playlist
    .map(
      (t, idx) => `
        <div class="track-item ${idx === currentTrackIndex ? 'active' : ''}" data-index="${idx}">
          <div class="t-left">
            <span class="t-num">${t.id}</span>
            <div class="t-name">${t.title}</div>
          </div>
          <div class="t-status">${idx === currentTrackIndex && isPlaying ? '🔊' : '▶'}</div>
        </div>
      `
    )
    .join('');

  trackListContainer.querySelectorAll('.track-item').forEach((el) => {
    el.addEventListener('click', () => selectTrack(Number(el.dataset.index)));
  });
}

function updateMediaSession(track) {
  if (!('mediaSession' in navigator) || !track) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: 'RJ Mobile Offers',
    album: 'Store Audio Broadcaster',
    artwork: [{ src: 'logo.png', sizes: '512x512', type: 'image/png' }]
  });
}

function loadTrack(index) {
  if (!playlist.length) return;

  currentTrackIndex = index;
  const track = playlist[currentTrackIndex];

  playerTitle.textContent = track.title;
  currentBadge.textContent = `Track ${track.id} of ${playlist.length}`;
  audio.src = track.src;

  const duration = getTrackDuration(track);
  timeTotal.textContent = formatTime(duration);
  timeCurrent.textContent = '0:00';
  progressFill.style.width = '0%';

  renderPlaylist();
  updateMediaSession(track);
  cacheAudioInSW(track.src);

  const nextIndex = (currentTrackIndex + 1) % playlist.length;
  preloader.src = playlist[nextIndex].src;
  cacheAudioInSW(playlist[nextIndex].src);
}

function setPlayingState(playing) {
  isPlaying = playing;
  btnPlay.textContent = playing ? '⏸' : '▶';
  visualizer.classList.toggle('playing', playing);
  renderPlaylist();
}

function showAutoplayHint(show) {
  autoplayHint?.classList.toggle('hidden', !show);
}

async function safePlay() {
  try {
    await audio.play();
    setPlayingState(true);
    showAutoplayHint(false);
    return true;
  } catch (err) {
    setPlayingState(false);
    if (err.name === 'NotAllowedError') {
      showAutoplayHint(true);
    }
    return false;
  }
}

function togglePlay() {
  if (!audio.src && playlist.length) loadTrack(currentTrackIndex);

  if (audio.paused) {
    safePlay().then((ok) => {
      if (ok) trackEvent('started');
    });
  } else {
    audio.pause();
    setPlayingState(false);
    trackEvent('paused');
  }
}

function selectTrack(index) {
  loadTrack(index);
  safePlay().then((ok) => {
    if (ok) trackEvent('started');
  });
}

function playNext() {
  if (!playlist.length) return;
  currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
  loadTrack(currentTrackIndex);
  safePlay().then((ok) => {
    if (ok) trackEvent('started');
  });
}

function playPrev() {
  if (!playlist.length) return;
  currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
  loadTrack(currentTrackIndex);
  safePlay().then((ok) => {
    if (ok) trackEvent('started');
  });
}

function updateProgressUI(clientX) {
  const rect = progressBar.getBoundingClientRect();
  let clickX = clientX - rect.left;
  clickX = Math.max(0, Math.min(clickX, rect.width));
  const percent = (clickX / rect.width) * 100;
  progressFill.style.width = `${percent}%`;

  const duration = getActiveDuration();
  if (duration) {
    timeCurrent.textContent = formatTime((clickX / rect.width) * duration);
  }
  return clickX / rect.width;
}

function bindControls() {
  btnPlay.addEventListener('click', togglePlay);
  btnNext.addEventListener('click', playNext);
  btnPrev.addEventListener('click', playPrev);

  progressBar.addEventListener('mousedown', (e) => {
    isDragging = true;
    progressBar.classList.add('dragging');
    updateProgressUI(e.clientX);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) updateProgressUI(e.clientX);
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    progressBar.classList.remove('dragging');
    const duration = getActiveDuration();
    if (duration) {
      audio.currentTime = updateProgressUI(e.clientX) * duration;
    }
  });

  progressBar.addEventListener('touchstart', (e) => {
    isDragging = true;
    progressBar.classList.add('dragging');
    updateProgressUI(e.touches[0].clientX);
  });

  window.addEventListener('touchmove', (e) => {
    if (isDragging) updateProgressUI(e.touches[0].clientX);
  });

  window.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    progressBar.classList.remove('dragging');
    const duration = getActiveDuration();
    if (duration) {
      audio.currentTime = (parseFloat(progressFill.style.width) / 100) * duration;
    }
  });
}

function bindAudioEvents() {
  audio.addEventListener('timeupdate', () => {
    const duration = getActiveDuration();
    if (duration && !isDragging) {
      progressFill.style.width = `${(audio.currentTime / duration) * 100}%`;
      timeCurrent.textContent = formatTime(audio.currentTime);
      timeTotal.textContent = formatTime(duration);
    }
  });

  audio.addEventListener('play', () => {
    setPlayingState(true);
  });

  audio.addEventListener('pause', () => {
    if (!audio.ended) {
      setPlayingState(false);
    }
  });

  audio.addEventListener('ended', () => {
    trackEvent('ended');
    playNext();
  });
}

function bindMediaSession() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play', togglePlay);
  navigator.mediaSession.setActionHandler('pause', togglePlay);
  navigator.mediaSession.setActionHandler('previoustrack', playPrev);
  navigator.mediaSession.setActionHandler('nexttrack', playNext);
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      await navigator.wakeLock.request('screen');
    }
  } catch {
    /* Wake lock unavailable or denied */
  }
}

function bindWakeLock() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });
  requestWakeLock();
}

function bindKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    }
  });
}

function bindTouchScroll() {
  let touchStartY = 0;

  document.addEventListener(
    'touchstart',
    (e) => {
      touchStartY = e.touches[0].clientY;
    },
    { passive: false }
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      const touchDiff = e.touches[0].clientY - touchStartY;

      if (touchDiff > 0 && window.scrollY <= 0) {
        if (!e.target.closest('.track-list')) {
          e.preventDefault();
        } else if (trackListContainer.scrollTop <= 0) {
          e.preventDefault();
        }
      }
    },
    { passive: false }
  );
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    await navigator.serviceWorker.register('sw.js', { scope: './' });
  } catch (err) {
    console.warn('Service worker registration failed:', err);
  }
}

async function init() {
  bindControls();
  bindAudioEvents();
  bindMediaSession();
  bindWakeLock();
  bindKeyboard();
  bindTouchScroll();

  initSupabase();
  await initBranch();
  await loadSongsFromJson();
  await registerServiceWorker();
}

init();