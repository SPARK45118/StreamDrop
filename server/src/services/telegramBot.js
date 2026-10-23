const https = require('https');
const fs = require('fs');
const path = require('path');
const ytDlpService = require('./ytDlp');
const jobsService = require('./jobs');
const { v4: uuidv4 } = require('uuid');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let offset = 0;
let isPolling = false;

function telegramRequest(method, data) {
  return new Promise((resolve, reject) => {
    if (!TOKEN) return reject(new Error('No token provided'));

    const payload = JSON.stringify(data);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ ok: false, error: body });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sendMessage(chatId, text, replyMarkup = null) {
  const data = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown'
  };
  if (replyMarkup) data.reply_markup = replyMarkup;
  return telegramRequest('sendMessage', data);
}

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text === '/start') {
    return sendMessage(
      chatId,
      '👋 *Welcome to StreamDrop Bot!*\n\nSend me any link from *YouTube, TikTok, SoundCloud, X, or Vimeo* and I will download it for you directly.'
    );
  }

  // Detect URL
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) {
    return sendMessage(chatId, '❌ Please send a valid media link (e.g. YouTube, SoundCloud, TikTok).');
  }

  const url = urlMatch[0];
  await sendMessage(chatId, `🔎 *Analyzing media with StreamDrop...*\n_${url}_`);

  try {
    const meta = await ytDlpService.getMetadata(url);
    const title = meta.title || 'video';

    await sendMessage(
      chatId,
      `🎬 *${title}*\n⏱️ Duration: ${Math.floor(meta.duration / 60)}m ${meta.duration % 60}s\n👤 Creator: ${meta.uploader}\n\n⬇️ *Starting download...*`
    );

    // Prepare download
    const jobId = uuidv4();
    jobsService.createJob(jobId, url, title);
    ytDlpService.startDownload(jobId, url, 'best', 'video');

    // Subscribe to progress
    const onProgress = async (job) => {
      if (job.status === 'completed' && job.filePath) {
        jobsService.jobEvents.removeListener(`progress:${jobId}`, onProgress);
        await sendMessage(chatId, `✅ *Download complete!* Uploading file to Telegram...`);

        // Check file size (Telegram bot limit is 50MB for standard uploads)
        try {
          const stats = fs.statSync(job.filePath);
          if (stats.size > 50 * 1024 * 1024) {
            await sendMessage(
              chatId,
              `⚠️ File size (${(stats.size / 1024 / 1024).toFixed(1)}MB) exceeds Telegram's 50MB bot upload limit.\nPlease download it via your browser at your StreamDrop local web app.`
            );
          } else {
            await sendMessage(chatId, `📁 File saved locally on server at: \`${path.basename(job.filePath)}\``);
          }
        } catch (e) {
          console.error(e);
        }
      } else if (job.status === 'failed') {
        jobsService.jobEvents.removeListener(`progress:${jobId}`, onProgress);
        await sendMessage(chatId, `❌ Download failed: ${job.error || 'Server error'}`);
      }
    };

    jobsService.jobEvents.on(`progress:${jobId}`, onProgress);
  } catch (err) {
    sendMessage(chatId, `❌ Failed to extract metadata: ${err.message || 'Unknown error'}`);
  }
}

async function pollUpdates() {
  if (!isPolling || !TOKEN) return;

  try {
    const res = await telegramRequest('getUpdates', { offset, timeout: 20 });
    if (res && res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        offset = update.update_id + 1;
        handleUpdate(update).catch(console.error);
      }
    }
  } catch (e) {
    // Network retry delay
  }

  if (isPolling) {
    setTimeout(pollUpdates, 2000);
  }
}

function initTelegramBot() {
  if (!TOKEN) {
    console.log('Telegram Bot: No TELEGRAM_BOT_TOKEN set in .env (skipping Telegram bot mode)');
    return;
  }

  console.log('🤖 Telegram Bot: Initializing polling mode...');
  isPolling = true;
  pollUpdates();
}

module.exports = {
  initTelegramBot
};
