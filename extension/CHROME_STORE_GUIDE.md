# StreamDrop Chrome Extension: Public Distribution & Chrome Web Store Guide

This guide walks you through distributing the **StreamDrop Chrome Extension** to public users worldwide, both via the official **Chrome Web Store** and via **instant GitHub Releases**.

---

## 📦 Ready-to-Upload Package

The production package has been compiled and tested:
* **Archive file**: `streamdrop-chrome-extension-v1.0.0.zip` (in your project root)
* **Manifest version**: Manifest V3 (Google Chrome & Microsoft Edge standard)
* **Assets included**: `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, and high-res PNG icons (`16x16`, `32x32`, `48x48`, `128x128`).
* **Repackage command**: If you make future edits, run:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\build_extension_zip.ps1
  ```

---

## 🚀 How Public Extension Architecture Works

Because browsers do not allow extensions to run native binaries (`yt-dlp` or `ffmpeg`) directly inside sandboxed browser tabs:
1. **Public Cloud Backend**:
   - Deploy your StreamDrop backend (`server/`) to a cloud host (Render, Railway, Fly.io, or VPS).
   - Set your cloud API URL in the extension settings (or make it the default).
2. **Dynamic Endpoint Settings**:
   - The extension features a built-in **⚙️ Settings Drawer** (`popup.html`).
   - Any public user can click ⚙️ and connect to your public cloud API or their own self-hosted server.
   - Settings automatically persist across computers via `chrome.storage.sync`.
3. **Smart Health Check**:
   - The extension automatically pings the server on open.
   - If online, users get 1-click downloads with real-time SSE progress streaming.
   - If offline, an alert banner explains how to configure the server or start the local backend.

---

## 🌐 Option 1: Publish to Google Chrome Web Store

Publishing to the Chrome Web Store makes StreamDrop installable by anyone with 1 click from `chromewebstore.google.com`.

### Step 1: Open Developer Console
1. Navigate to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with your Google account.
3. Pay the **$5 USD one-time registration fee** (Google's standard developer fee).

### Step 2: Upload Your Zip
1. Click **"New Item"** (top right).
2. Drag and drop `streamdrop-chrome-extension-v1.0.0.zip` into the uploader.

### Step 3: Complete Store Listing Details
* **Name**: `StreamDrop - Video & Media Downloader`
* **Summary**: `One-click video and audio downloader for YouTube, TikTok, X, and more powered by StreamDrop.`
* **Detailed Description**:
  ```markdown
  StreamDrop allows you to easily download and extract videos and audio tracks from YouTube, TikTok, Twitter/X, and supported media platforms.

  Key Features:
  - 1-Click download button directly under YouTube videos.
  - Quick HD MP4 video download.
  - High-bitrate MP3 audio extraction.
  - Real-time download and format muxing progress streaming.
  - Cloud server & self-hosted server support.
  - Developed with high privacy: no tracking, no ads.
  ```
* **Category**: `Photos & Video` or `Productivity`.
* **Language**: `English`.
* **Icons**: Automatically read from `icons/icon128.png`.
* **Screenshots**: Upload 1 or 2 screenshots (1280x800 or 640x400) showing the popup and the injected YouTube button.

### Step 4: Privacy & Permissions Justification
Google requires explaining why each permission is used:
* **activeTab**: Used to detect the media URL of the current active tab when you click the extension popup.
* **storage**: Used to save user preferences such as custom server API endpoints across browser sessions.
* **scripting**: Used to inject the StreamDrop download action button directly into supported video pages.
* **Single Purpose Description**: `Facilitate downloading and extracting video/audio from media links.`

### Step 5: Submit for Review
1. Click **"Submit for Review"**.
2. Google reviews extensions within **24 to 72 hours**. Once approved, it is live for the entire world!

---

## ⚡ Option 2: Instant Public Release (No Waiting / 100% Free)

You can share StreamDrop with public users right now without paying $5 or waiting for Google review:

### Via GitHub Releases:
1. Go to your GitHub repository: `https://github.com/your-username/CloudClip` (or `StreamDrop`).
2. Click **Releases** -> **Create a new release** (e.g. `v1.0.0`).
3. Attach `streamdrop-chrome-extension-v1.0.0.zip`.
4. Provide instructions for your users:
   ```markdown
   ### How to install StreamDrop in Chrome, Edge, or Brave:
   1. Download `streamdrop-chrome-extension-v1.0.0.zip` and extract it.
   2. Open Chrome and go to `chrome://extensions/`.
   3. Enable "Developer mode" (top right toggle).
   4. Click "Load unpacked" (top left) and select the extracted folder.
   5. Done! You will now see StreamDrop in your browser toolbar and on YouTube!
   ```

---

## 🛠️ Deploying the Public Cloud Backend (Render / Railway / Docker)

To allow public users to download media without running a local server:

### Deploying to Render:
1. Go to [Render.com](https://render.com) and create a **Web Service**.
2. Connect your GitHub repository.
3. Choose **Docker** as the runtime (the repository includes a pre-configured multi-stage `Dockerfile` with `yt-dlp` and `ffmpeg` pre-installed).
4. Deploy the service. Render will provide a public URL like `https://streamdrop-api.onrender.com`.
5. Enter this URL in the extension settings:
   - Backend API: `https://streamdrop-api.onrender.com/api`
   - Web App: `https://your-frontend.vercel.app` (or your client domain).

---

## 👨‍💻 Developer & Support
* **Developer**: Dhruv (Full Stack & Game Developer)
* **Email**: `xboxing098@gmail.com`
* **Version**: `1.0.0`
