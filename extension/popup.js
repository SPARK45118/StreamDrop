/**
 * StreamDrop Browser Extension Popup Script
 * Handles tab detection, backend connection, dynamic quality extraction,
 * SSE live progress streaming, and endpoint configuration.
 */

const PRESETS = {
  local: {
    api: 'http://localhost:5000/api',
    client: 'http://localhost:5173'
  },
  cloud: {
    api: 'https://cloudclip-vop8.onrender.com/api',
    client: 'https://cloudclip-vop8.onrender.com'
  }
};

let currentTabUrl = '';
let activeJobId = null;
let activeEventSource = null;
let currentType = 'video';
let cachedMetadata = null;

let config = {
  apiUrl: PRESETS.local.api,
  clientUrl: PRESETS.local.client
};

function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const serverStatus = document.getElementById('server-status');
  const offlineBanner = document.getElementById('offline-banner');
  const btnOpenSettingsHint = document.getElementById('btn-open-settings-hint');
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const settingsDrawer = document.getElementById('settings-drawer');
  const inputApiUrl = document.getElementById('input-api-url');
  const inputClientUrl = document.getElementById('input-client-url');
  const presetCloud = document.getElementById('preset-cloud');
  const presetLocal = document.getElementById('preset-local');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const activeServerLabel = document.getElementById('active-server-label');

  const mediaLoading = document.getElementById('media-loading');
  const mediaDetails = document.getElementById('media-details');
  const pageTitle = document.getElementById('page-title');
  const pageUrl = document.getElementById('page-url');

  const tabVideo = document.getElementById('tab-video');
  const tabAudio = document.getElementById('tab-audio');
  const qualitySelect = document.getElementById('quality-select');
  const qualityLoader = document.getElementById('quality-loader');
  const btnStartDownload = document.getElementById('btn-start-download');
  const btnDownloadText = document.getElementById('btn-download-text');
  const btnOpenWeb = document.getElementById('btn-open-web');

  const progressBox = document.getElementById('progress-box');
  const progressStatus = document.getElementById('progress-status');
  const progressPercent = document.getElementById('progress-percent');
  const progressFill = document.getElementById('progress-fill');
  const btnSaveFile = document.getElementById('btn-save-file');

  const inputShortcutVideo = document.getElementById('input-shortcut-video');
  const inputShortcutAudio = document.getElementById('input-shortcut-audio');
  const btnOpenBrowserShortcuts = document.getElementById('btn-open-browser-shortcuts');
  const shortcutsHint = document.querySelector('.shortcuts-hint');

  let shortcuts = {
    video: 'Alt+Shift+D',
    audio: 'Alt+Shift+A'
  };

  // Setup interactive key recorder for shortcut inputs
  function setupShortcutRecorder(inputEl, type) {
    if (!inputEl) return;
    let isRecording = false;

    inputEl.addEventListener('focus', () => {
      isRecording = true;
      inputEl.value = 'Press custom keys...';
    });

    inputEl.addEventListener('blur', () => {
      isRecording = false;
      if (inputEl.value === 'Press custom keys...') {
        inputEl.value = shortcuts[type] || (type === 'video' ? 'Alt+Shift+D' : 'Alt+Shift+A');
      }
    });

    inputEl.addEventListener('keydown', (e) => {
      if (!isRecording) return;
      e.preventDefault();
      e.stopPropagation();

      // Ignore bare modifier key releases
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Command');

      const keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      parts.push(keyName);

      const combo = parts.join('+');
      inputEl.value = combo;
      shortcuts[type] = combo;
      isRecording = false;
      inputEl.blur();
    });
  }

  setupShortcutRecorder(inputShortcutVideo, 'video');
  setupShortcutRecorder(inputShortcutAudio, 'audio');

  // Open Chrome Native Shortcuts page
  if (btnOpenBrowserShortcuts) {
    btnOpenBrowserShortcuts.addEventListener('click', () => {
      if (chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      }
    });
  }

  // Load configured endpoints and shortcuts from chrome.storage.sync
  await loadSettings();

  // Settings Drawer Toggle
  function toggleDrawer(show) {
    const isVisible = settingsDrawer.style.display !== 'none';
    const nextState = typeof show === 'boolean' ? show : !isVisible;
    settingsDrawer.style.display = nextState ? 'flex' : 'none';
  }

  btnToggleSettings.addEventListener('click', () => toggleDrawer());
  if (btnOpenSettingsHint) {
    btnOpenSettingsHint.addEventListener('click', () => toggleDrawer(true));
  }

  // Presets
  presetCloud.addEventListener('click', () => {
    inputApiUrl.value = PRESETS.cloud.api;
    inputClientUrl.value = PRESETS.cloud.client;
  });

  presetLocal.addEventListener('click', () => {
    inputApiUrl.value = PRESETS.local.api;
    inputClientUrl.value = PRESETS.local.client;
  });

  // Save Settings
  btnSaveSettings.addEventListener('click', () => {
    let newApi = (inputApiUrl.value || '').trim().replace(/\/+$/, '');
    let newClient = (inputClientUrl.value || '').trim().replace(/\/+$/, '');
    const newVideoShortcut = (inputShortcutVideo ? inputShortcutVideo.value : shortcuts.video) || 'Alt+Shift+D';
    const newAudioShortcut = (inputShortcutAudio ? inputShortcutAudio.value : shortcuts.audio) || 'Alt+Shift+A';

    if (!newApi) newApi = PRESETS.local.api;
    if (!newClient) newClient = PRESETS.local.client;

    config.apiUrl = newApi;
    config.clientUrl = newClient;
    shortcuts.video = newVideoShortcut;
    shortcuts.audio = newAudioShortcut;

    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({
        apiUrl: newApi,
        clientUrl: newClient,
        shortcutVideo: newVideoShortcut,
        shortcutAudio: newAudioShortcut
      }, () => {
        btnSaveSettings.textContent = 'Saved!';
        setTimeout(() => {
          btnSaveSettings.textContent = 'Save Settings';
          toggleDrawer(false);
        }, 800);
        updateServerLabel();
        updateShortcutsFooter();
        checkServerHealth();
        if (currentTabUrl) fetchAvailableQualities(currentTabUrl);
      });
    } else {
      updateServerLabel();
      updateShortcutsFooter();
      checkServerHealth();
      toggleDrawer(false);
      if (currentTabUrl) fetchAvailableQualities(currentTabUrl);
    }
  });

  async function loadSettings() {
    return new Promise((resolve) => {
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['apiUrl', 'clientUrl', 'shortcutVideo', 'shortcutAudio'], (result) => {
          if (result && result.apiUrl) config.apiUrl = result.apiUrl;
          if (result && result.clientUrl) config.clientUrl = result.clientUrl;
          if (result && result.shortcutVideo) shortcuts.video = result.shortcutVideo;
          if (result && result.shortcutAudio) shortcuts.audio = result.shortcutAudio;
          applyLoadedSettings();
          resolve();
        });
      } else {
        applyLoadedSettings();
        resolve();
      }
    });
  }

  function applyLoadedSettings() {
    inputApiUrl.value = config.apiUrl;
    inputClientUrl.value = config.clientUrl;
    if (inputShortcutVideo) inputShortcutVideo.value = shortcuts.video;
    if (inputShortcutAudio) inputShortcutAudio.value = shortcuts.audio;
    updateServerLabel();
    updateShortcutsFooter();
    checkServerHealth();
  }

  function updateShortcutsFooter() {
    if (shortcutsHint) {
      shortcutsHint.innerHTML = `⚡ Shortcuts: <kbd>${shortcuts.video}</kbd> Video • <kbd>${shortcuts.audio}</kbd> Audio`;
    }
  }

  function updateServerLabel() {
    if (activeServerLabel) {
      const isLocal = config.apiUrl.includes('localhost') || config.apiUrl.includes('127.0.0.1');
      activeServerLabel.textContent = isLocal ? 'Connected: Localhost (Port 5000)' : `Server: ${config.apiUrl.replace(/^https?:\/\//, '')}`;
    }
  }

  // Check server health
  async function checkServerHealth() {
    serverStatus.textContent = 'Checking...';
    serverStatus.className = 'status-indicator';
    if (offlineBanner) offlineBanner.style.display = 'none';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${config.apiUrl}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: '' }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      serverStatus.textContent = 'Online';
      serverStatus.className = 'status-indicator online';
      if (offlineBanner) offlineBanner.style.display = 'none';
    } catch (e) {
      serverStatus.textContent = 'Offline';
      serverStatus.className = 'status-indicator offline';
      if (offlineBanner) offlineBanner.style.display = 'flex';
    }
  }

  // Format Type Tabs (Video vs Audio)
  tabVideo.addEventListener('click', () => {
    currentType = 'video';
    tabVideo.classList.add('active');
    tabAudio.classList.remove('active');
    btnDownloadText.textContent = 'Download Selected Video';
    populateQualityOptions('video');
  });

  tabAudio.addEventListener('click', () => {
    currentType = 'audio';
    tabAudio.classList.add('active');
    tabVideo.classList.remove('active');
    btnDownloadText.textContent = 'Download Selected Audio';
    populateQualityOptions('audio');
  });

  // Populate Quality Dropdown
  function populateQualityOptions(type) {
    qualitySelect.innerHTML = '';

    if (type === 'video') {
      if (cachedMetadata && cachedMetadata.formats && cachedMetadata.formats.video && cachedMetadata.formats.video.length > 0) {
        cachedMetadata.formats.video.forEach((f) => {
          const opt = document.createElement('option');
          opt.value = f.formatId;
          const sizeBadge = f.size ? ` • ${formatSize(f.size)}` : '';
          const fpsBadge = f.fps && f.fps > 30 ? ` ${f.fps}fps` : '';
          opt.textContent = `${f.resolution}${fpsBadge}${sizeBadge}`;
          qualitySelect.appendChild(opt);
        });
      } else {
        const opt = document.createElement('option');
        opt.value = 'best';
        opt.textContent = '🌟 Maximum Quality (Auto 4K/1080p)';
        qualitySelect.appendChild(opt);
      }
    } else {
      if (cachedMetadata && cachedMetadata.formats && cachedMetadata.formats.audio && cachedMetadata.formats.audio.length > 0) {
        cachedMetadata.formats.audio.forEach((f) => {
          const opt = document.createElement('option');
          opt.value = f.formatId;
          const sizeBadge = f.size ? ` • ${formatSize(f.size)}` : '';
          opt.textContent = `${f.note || f.bitrate || f.ext}${sizeBadge}`;
          qualitySelect.appendChild(opt);
        });
      } else {
        const opt1 = document.createElement('option');
        opt1.value = 'mp3-320k';
        opt1.textContent = '🎵 MP3 (Audiophile 320kbps)';
        const opt2 = document.createElement('option');
        opt2.value = 'mp3-192k';
        opt2.textContent = '🎵 MP3 (Standard 192kbps)';
        qualitySelect.appendChild(opt1);
        qualitySelect.appendChild(opt2);
      }
    }
  }

  // Fetch Available Qualities for active URL
  async function fetchAvailableQualities(url) {
    if (!url || !url.startsWith('http')) return;
    qualityLoader.style.display = 'inline';
    qualityLoader.textContent = 'Scanning qualities...';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`${config.apiUrl}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Failed to retrieve qualities');
      const data = await res.json();
      cachedMetadata = data;

      if (data.title) pageTitle.textContent = data.title;
      populateQualityOptions(currentType);
      qualityLoader.style.display = 'none';
    } catch (err) {
      console.warn('Metadata fetch failed:', err);
      qualityLoader.style.display = 'none';
      populateQualityOptions(currentType);
    }
  }

  // Get active tab info
  if (chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        const tab = tabs[0];
        currentTabUrl = tab.url || '';
        pageTitle.textContent = tab.title || 'Untitled';
        pageUrl.textContent = currentTabUrl;
        mediaLoading.style.display = 'none';
        mediaDetails.style.display = 'block';

        if (currentTabUrl.startsWith('http')) {
          fetchAvailableQualities(currentTabUrl);
        }
      } else {
        mediaLoading.textContent = 'No active tab found';
      }
    });
  } else {
    currentTabUrl = window.location.href;
    mediaLoading.style.display = 'none';
    mediaDetails.style.display = 'block';
  }

  // Open in StreamDrop Web App
  btnOpenWeb.addEventListener('click', () => {
    if (!currentTabUrl) return;
    const target = `${config.clientUrl}/?url=${encodeURIComponent(currentTabUrl)}`;
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: target });
    } else {
      window.open(target, '_blank');
    }
  });

  // Start Download with Selected Quality
  btnStartDownload.addEventListener('click', () => {
    const selectedFormatId = qualitySelect.value || 'best';
    startDownloadWithQuality(selectedFormatId, currentType);
  });

  async function startDownloadWithQuality(formatId, type) {
    if (!currentTabUrl) return;

    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }

    progressBox.style.display = 'flex';
    progressStatus.textContent = 'Queueing download...';
    progressPercent.textContent = '0%';
    progressFill.style.width = '0%';
    btnSaveFile.style.display = 'none';

    try {
      let title = cachedMetadata ? cachedMetadata.title : 'download';

      // Prepare download
      const prepRes = await fetch(`${config.apiUrl}/download/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentTabUrl,
          formatId,
          type,
          title
        })
      });
      const prepData = await prepRes.json();
      if (!prepRes.ok) throw new Error(prepData.message || 'Could not queue download');

      activeJobId = prepData.jobId;

      // Stream progress via SSE
      activeEventSource = new EventSource(`${config.apiUrl}/download/events/${activeJobId}`);
      activeEventSource.onmessage = (event) => {
        try {
          const job = JSON.parse(event.data);
          const pct = Math.round(job.progress || 0);
          progressPercent.textContent = `${pct}%`;
          progressFill.style.width = `${pct}%`;
          progressStatus.textContent = job.status === 'merging' ? 'Merging streams (ffmpeg)...' : `Downloading (${job.speed || '0 B/s'})`;

          if (job.status === 'completed') {
            activeEventSource.close();
            activeEventSource = null;
            progressStatus.textContent = 'Ready!';
            progressPercent.textContent = '100%';
            btnSaveFile.style.display = 'block';
            btnSaveFile.onclick = () => {
              const fileUrl = `${config.apiUrl}/download/file/${activeJobId}`;
              if (chrome.tabs && chrome.tabs.create) {
                chrome.tabs.create({ url: fileUrl });
              } else {
                window.open(fileUrl, '_blank');
              }
            };
          } else if (job.status === 'failed') {
            activeEventSource.close();
            activeEventSource = null;
            progressStatus.textContent = job.error || 'Download failed.';
          }
        } catch (err) {
          console.error(err);
        }
      };

      activeEventSource.onerror = () => {
        if (activeEventSource) {
          activeEventSource.close();
          activeEventSource = null;
        }
      };
    } catch (e) {
      progressStatus.textContent = e.message || 'Error occurred';
      progressPercent.textContent = '';
      if (offlineBanner && (e.message.includes('Failed to fetch') || e.name === 'TypeError')) {
        offlineBanner.style.display = 'flex';
      }
    }
  }
});
