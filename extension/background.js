/**
 * StreamDrop Background Service Worker
 * Handles:
 * 1. Messages from content script (custom page shortcuts)
 * 2. Browser-level commands (chrome.commands)
 * 3. Automatic background downloading directly to Chrome download bar
 */

const DEFAULT_API = 'http://localhost:5000/api';

async function getApiUrl() {
  return new Promise((resolve) => {
    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['apiUrl'], (res) => {
        resolve(res && res.apiUrl ? res.apiUrl : DEFAULT_API);
      });
    } else {
      resolve(DEFAULT_API);
    }
  });
}

// Show native desktop notification
function showNotification(title, message) {
  if (chrome.notifications && chrome.notifications.create) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title || 'StreamDrop',
      message: message || '',
      priority: 2
    });
  }
}

// Injects a temporary floating toast directly on the active web page
function injectPageToast(tabId, message, isError = false) {
  if (!chrome.scripting || !tabId) return;
  chrome.scripting.executeScript({
    target: { tabId },
    func: (msg, error) => {
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
        <span style="font-size: 16px;">${error ? '⚠️' : '⚡'}</span>
        <span>${msg}</span>
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
    },
    args: [message, isError]
  }).catch(() => {});
}

// Core download handler
async function handleDownload(url, type, title, tabId) {
  if (!url || !url.startsWith('http')) {
    showNotification('StreamDrop', 'Please open a video tab (YouTube, TikTok, X, etc.)');
    return;
  }

  const apiUrl = await getApiUrl();
  const isAudio = type === 'audio';
  const formatId = isAudio ? 'mp3-320k' : 'best';

  if (tabId) injectPageToast(tabId, `StreamDrop: Downloading ${isAudio ? 'MP3 Audio' : 'HD Video'}...`);
  showNotification('StreamDrop', `Queueing ${isAudio ? 'MP3 (320kbps)' : 'Maximum HD Video'}...`);

  try {
    // 1. Prepare download on the server
    const prepRes = await fetch(`${apiUrl}/download/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        formatId,
        type,
        title: title || 'download'
      })
    });

    if (!prepRes.ok) {
      const errData = await prepRes.json().catch(() => ({}));
      throw new Error(errData.message || 'Could not queue download');
    }

    const { jobId } = await prepRes.json();

    // 2. Poll for job completion
    const checkStatus = async () => {
      try {
        const statusRes = await fetch(`${apiUrl}/download/status/${jobId}`);
        if (!statusRes.ok) return;
        const job = await statusRes.json();

        if (job.status === 'completed') {
          const downloadUrl = `${apiUrl}/download/file/${jobId}`;
          const cleanName = job.fileName || `streamdrop_${Date.now()}.${isAudio ? 'mp3' : 'mp4'}`;

          // Trigger browser file download directly
          if (chrome.downloads && chrome.downloads.download) {
            chrome.downloads.download({
              url: downloadUrl,
              filename: cleanName,
              saveAs: false
            });
          } else {
            chrome.tabs.create({ url: downloadUrl });
          }

          if (tabId) injectPageToast(tabId, `✅ Download Ready: ${cleanName}`);
          showNotification('StreamDrop: Download Complete', `Saved: ${cleanName}`);
        } else if (job.status === 'failed') {
          if (tabId) injectPageToast(tabId, `❌ Download failed: ${job.error || 'Server error'}`, true);
          showNotification('StreamDrop Error', job.error || 'Download failed');
        } else {
          // Check progress again in 1.5s
          setTimeout(checkStatus, 1500);
        }
      } catch (err) {
        console.error('Status check error:', err);
      }
    };

    setTimeout(checkStatus, 1500);
  } catch (err) {
    if (tabId) injectPageToast(tabId, `StreamDrop Error: ${err.message}`, true);
    showNotification('StreamDrop Error', err.message);
  }
}

// 1. Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'trigger-download') {
    handleDownload(request.url, request.type, request.title, sender.tab ? sender.tab.id : null);
    sendResponse({ status: 'started' });
  }
});

// 2. Listen for Chrome-level global commands
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const type = command === 'quick-download-audio' ? 'audio' : 'video';
  handleDownload(tab.url, type, tab.title, tab.id);
});
