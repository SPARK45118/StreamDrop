# StreamDrop Chrome / Edge Browser Extension (Manifest V3)

StreamDrop's official browser extension brings 1-click video and audio downloading directly to your browser on **YouTube, TikTok, X/Twitter, SoundCloud, Vimeo, and Instagram**.

---

### Features

1. **Native YouTube Action Button**:
   * Automatically injects a sleek **StreamDrop** button directly under YouTube videos (next to Like / Share).
   * Clicking it opens StreamDrop and automatically analyzes and queues the video instantly.
2. **One-Click Extension Popup**:
   * Detects the media URL of your current browser tab.
   * **Quick Video (HD)**: Triggers an instant MP4 download.
   * **Quick MP3 (Audio)**: Triggers an instant high-bitrate MP3 download.
   * Displays live download & muxing progress directly inside the extension popup via Server-Sent Events (SSE).
3. **Multi-Server & Public Cloud Support**:
   * Built-in ⚙️ **Settings Drawer** allows connecting to either your local server (`http://localhost:5000`) or any public cloud backend (Render, Railway, VPS).
   * Settings automatically sync across your devices via `chrome.storage.sync`.
4. **Open in Web App**:
   * Deep-links directly to StreamDrop web with `?url=...`.

---

### 📦 Public Release Package

* Ready-to-publish archive: [`streamdrop-chrome-extension-v1.0.0.zip`](../streamdrop-chrome-extension-v1.0.0.zip)
* For step-by-step Chrome Web Store submission, see [CHROME_STORE_GUIDE.md](CHROME_STORE_GUIDE.md).

---

### How to Install in Chrome, Edge, or Brave (30 Seconds)

1. Open your browser and navigate to:
   * **Chrome**: `chrome://extensions/`
   * **Edge**: `edge://extensions/`
   * **Brave**: `brave://extensions/`
2. Enable **Developer mode** (toggle switch in top-right corner).
3. Click the **Load unpacked** button (top-left).
4. Select the `extension/` folder inside this repository:
   ```
   c:\Users\pubgg\OneDrive\Documents\Projects\CloudClip-main\extension
   ```
5. Done! The StreamDrop icon will appear in your browser toolbar, and the download button will automatically appear on YouTube video pages.
