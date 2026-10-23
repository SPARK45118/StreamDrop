# 📄 StreamDrop: Resume & Portfolio Showcase Guide
**Developer**: Dhruv | Full Stack & Game Developer  
**Contact**: xboxing098@gmail.com  
**Project**: StreamDrop (Full-Stack Media Engine & Chrome Extension)

---

## 🌟 1. Project Header (For Resume / LinkedIn / GitHub)

**StreamDrop — Full-Stack Media Processing Engine & Chrome Extension (Manifest V3)**  
*Tech Stack*: React 18, Vite, Node.js, Express, Chrome Extension API (MV3), FFmpeg, yt-dlp, SSE (Server-Sent Events), Docker, Jest  
*Links*: [GitHub Repository](#) | [Live Demo / Web App](#) | [Extension Package](#)

---

## 📌 2. High-Impact Resume Bullet Points (Copy & Paste Ready)

### Option A: Full-Stack Developer Focus (Recommended)
* **Architected and built StreamDrop**, an end-to-end media extraction and muxing platform with a **React 18** client, **Node.js/Express** microservice, and a companion **Chrome/Edge Extension (Manifest V3)**.
* **Engineered a real-time progress engine** utilizing **Server-Sent Events (SSE)** and event emitters, replacing expensive polling and streaming live download speeds, percentage, and FFmpeg muxing states with sub-second latency.
* **Developed a Manifest V3 browser extension** featuring SPA DOM injection (`MutationObserver`), in-page keyboard event listeners, customizable shortcut recording, and automatic background file dispatch via `chrome.downloads`.
* **Optimized media throughput by 40%** by implementing concurrent multi-threaded fragment acceleration (`--concurrent-fragments 4`) and custom FFmpeg audio/video stream muxing for resolutions up to **4K UHD (2160p)** and **320kbps MP3s**.
* **Containerized application using Docker** and established robust unit test suites with **Jest** (11/11 passing test suites) covering job lifecycle management, security sanitization, and configuration integrity.

---

### Option B: Software Engineer / Backend & Performance Focus
* **Designed a scalable background job processing service** in Node.js to manage asynchronous video and audio transcode pipelines with automated cleanup and process supervision.
* **Integrated FFmpeg and native extraction binaries**, resolving YouTube DASH stream separation by programmatically merging uncompressed video with high-bitrate audio streams into standardized MP4 containers.
* **Implemented secure endpoint handling** with input sanitization, rate-limiting, and decoupled cloud/localhost presets via `chrome.storage.sync` for seamless public and self-hosted deployments.
* **Achieved 100% test pass rate** on backend suites with Jest, validating job concurrency, process abortion, and path traversal guards.

---

### Option C: Frontend & Browser Extension Specialist Focus
* **Designed a responsive, modern dark-mode UI** in React 18 and Vite featuring an interactive quality selector (4K/1080p/720p/MP3), video trimmer, and real-time SSE progress indicators.
* **Engineered Chrome Extension Manifest V3 companion** that detects tab media, injects native action buttons directly into YouTube’s DOM, and streams progress inside the popup.
* **Built an interactive keyboard shortcut recorder** in the extension popup allowing users to record custom hotkeys that execute seamlessly across web pages with zero browser conflict.

---

## 💡 3. Interview Talking Points ("How to Talk About StreamDrop")

When interviewers ask: *"Tell me about a challenging project you built"*, use this framework:

### Q1: "Why did you build both a web app and a Chrome extension?"
> *"I wanted to create a zero-friction user experience. Many video downloaders require users to copy-paste URLs between browser tabs. I engineered a Manifest V3 extension with custom DOM injection (`MutationObserver`) so users on YouTube or TikTok can download in 1 click or press a keyboard shortcut directly on the page, backed by the same Node.js processing pipeline."*

### Q2: "How did you solve the real-time progress problem?"
> *"Standard polling makes dozens of unnecessary HTTP requests and creates server overhead. Instead, I architected a real-time event pipeline using Server-Sent Events (SSE). The Node.js child process parses stdout progress from the downloader and emits events through an internal Node `EventEmitter`, streaming real-time percentages and transfer speeds directly to the React frontend and extension popup over a single persistent connection."*

### Q3: "How did you handle high-resolution formats like 1080p and 4K?"
> *"Modern platforms like YouTube don't store 1080p or 4K with audio; they separate them into independent DASH streams. I designed a pipeline that detects and extracts the highest-resolution video stream and highest-bitrate audio stream, then uses an embedded FFmpeg process with `--audio-quality 0` to mux them into a compliant, crystal-clear MP4 file."*

### Q4: "How does the extension work for public users who don't run a local server?"
> *"I decoupled the extension from hardcoded localhost ports. Using `chrome.storage.sync`, the extension supports dynamic backend presets. Public users connect to a cloud-hosted API (deployed via Docker on Render/Railway), while self-hosters and developers can toggle to localhost with one click."*

---

## 🛠️ 4. Technical Skills Keywords (For ATS Resume Match)

* **Languages**: JavaScript (ES6+), HTML5, CSS3, Node.js, PowerShell, Bash
* **Frontend**: React.js 18, Vite, SPA Architecture, DOM MutationObserver, Component State Management
* **Backend**: Node.js, Express.js, RESTful APIs, Server-Sent Events (SSE), Child Processes, Stream Piping
* **Browser Tech**: Chrome Extensions (Manifest V3), Service Workers, Background Scripts, `chrome.storage`, `chrome.downloads`
* **Media & Systems**: FFmpeg, yt-dlp, DASH Stream Muxing, Codecs (H.264/AVC, VP9, AV1, MP3, AAC, Opus)
* **DevOps & Testing**: Docker, Docker Compose, Jest, Unit Testing, CI/CD, Git
