/**
 * StreamDrop Content Script
 * 1. Injects 'Download with StreamDrop' button directly into YouTube video pages.
 * 2. Listens for user-customized keyboard shortcuts directly on the page.
 */

// Load custom shortcuts from chrome.storage.sync (with defaults)
let customShortcuts = {
  video: 'Alt+Shift+D',
  audio: 'Alt+Shift+A'
};

function loadShortcuts() {
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['shortcutVideo', 'shortcutAudio'], (res) => {
      if (res && res.shortcutVideo) customShortcuts.video = res.shortcutVideo;
      if (res && res.shortcutAudio) customShortcuts.audio = res.shortcutAudio;
    });
  }
}
loadShortcuts();

// Real-time synchronization if user changes shortcuts in popup settings
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.shortcutVideo && changes.shortcutVideo.newValue) {
        customShortcuts.video = changes.shortcutVideo.newValue;
      }
      if (changes.shortcutAudio && changes.shortcutAudio.newValue) {
        customShortcuts.audio = changes.shortcutAudio.newValue;
      }
    }
  });
}

// Floating Toast Notification directly on the page
function showPageToast(message, isError = false) {
  let toast = document.getElementById('streamdrop-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'streamdrop-toast';
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #121113;
      border: 1px solid ${error ? '#ef4444' : '#f43f5e'};
      box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 15px rgba(225,29,72,0.35);
      color: #f8fafc;
      padding: 12px 18px;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.25s ease;
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <span style="font-size: 16px;">${isError ? '⚠️' : '⚡'}</span>
    <span>${message}</span>
  `;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 350);
    }
  }, 3500);
}

// Compare pressed key event with configured shortcut string
function matchShortcut(event, shortcutString) {
  if (!shortcutString) return false;
  const parts = shortcutString.split('+');
  const needsCtrl = parts.includes('Ctrl');
  const needsAlt = parts.includes('Alt');
  const needsShift = parts.includes('Shift');
  const needsMeta = parts.includes('Command') || parts.includes('Meta');

  const mainKey = parts[parts.length - 1].toUpperCase();
  const eventKey = event.key.length === 1 ? event.key.toUpperCase() : event.key;

  if (event.ctrlKey !== needsCtrl) return false;
  if (event.altKey !== needsAlt) return false;
  if (event.shiftKey !== needsShift) return false;
  if (event.metaKey !== needsMeta) return false;

  return eventKey === mainKey;
}

// Listen for keyboard shortcuts across the page
window.addEventListener('keydown', (e) => {
  // Ignore if user is currently typing in an input, textarea, or comment box
  const targetTag = (e.target.tagName || '').toLowerCase();
  if (targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable) {
    return;
  }

  if (matchShortcut(e, customShortcuts.video)) {
    e.preventDefault();
    e.stopPropagation();
    triggerDownload('video');
  } else if (matchShortcut(e, customShortcuts.audio)) {
    e.preventDefault();
    e.stopPropagation();
    triggerDownload('audio');
  }
}, true);

function triggerDownload(type) {
  showPageToast(`StreamDrop: Downloading ${type === 'audio' ? 'MP3 Audio' : 'HD Video'}...`);

  // Forward to background service worker for processing
  chrome.runtime.sendMessage({
    action: 'trigger-download',
    type,
    url: window.location.href,
    title: document.title
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('StreamDrop background communication:', chrome.runtime.lastError.message);
    }
  });
}

// YouTube Native Button Injection
function injectYouTubeButton() {
  if (document.getElementById('streamdrop-yt-btn')) return;

  const targetBar = document.querySelector('#top-level-buttons-computed') || document.querySelector('#actions-inner #actions');
  if (!targetBar) return;

  const btn = document.createElement('button');
  btn.id = 'streamdrop-yt-btn';
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #e11d48, #f43f5e);
    color: #ffffff;
    border: none;
    border-radius: 18px;
    padding: 0 16px;
    height: 36px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-left: 8px;
    box-shadow: 0 2px 8px rgba(225, 29, 72, 0.35);
    transition: transform 0.2s, opacity 0.2s;
    font-family: inherit;
    z-index: 9999;
  `;

  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
    <span>StreamDrop</span>
  `;

  btn.onmouseover = () => { btn.style.transform = 'scale(1.04)'; };
  btn.onmouseout = () => { btn.style.transform = 'scale(1)'; };

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const currentUrl = window.location.href;

    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['clientUrl'], (res) => {
        const clientBase = (res && res.clientUrl) ? res.clientUrl.replace(/\/+$/, '') : 'http://localhost:5173';
        window.open(`${clientBase}/?url=${encodeURIComponent(currentUrl)}`, '_blank');
      });
    } else {
      window.open(`http://localhost:5173/?url=${encodeURIComponent(currentUrl)}`, '_blank');
    }
  };

  targetBar.appendChild(btn);
}

// Observe URL changes (YouTube SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(injectYouTubeButton, 1500);
  }
  injectYouTubeButton();
}).observe(document.body, { subtree: true, childList: true });

setTimeout(injectYouTubeButton, 2000);
