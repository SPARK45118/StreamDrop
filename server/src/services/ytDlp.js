const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const sanitize = require('sanitize-filename');
const config = require('../config/config');
const { JOB_STATUS, ERROR_CODES } = require('../../../shared/constants/constants.json');
const jobsService = require('./jobs');

// Function to get the yt-dlp executable path
function getYtDlpBin() {
  const localExe = path.resolve(__dirname, '../../bin/yt-dlp.exe');
  if (fs.existsSync(localExe)) return `"${localExe}"`;
  const localBin = path.resolve(__dirname, '../../bin/yt-dlp');
  if (fs.existsSync(localBin)) return `"${localBin}"`;
  return 'yt-dlp';
}

function getYtDlpSpawnCmd() {
  const localExe = path.resolve(__dirname, '../../bin/yt-dlp.exe');
  if (fs.existsSync(localExe)) return localExe;
  const localBin = path.resolve(__dirname, '../../bin/yt-dlp');
  if (fs.existsSync(localBin)) return localBin;
  return 'yt-dlp';
}

function ensureBinInPath() {
  const binPath = path.resolve(__dirname, '../../bin');
  if (fs.existsSync(binPath) && !process.env.PATH.includes(binPath)) {
    process.env.PATH = `${binPath}${path.delimiter}${process.env.PATH}`;
  }
}
ensureBinInPath();

// Path to cookies file (written from YOUTUBE_COOKIES env var at server startup)
const cookiesPath = path.resolve(__dirname, '../../cookies.txt');
const cookiesFlag = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';

/**
 * Fetch media metadata using yt-dlp -J.
 */
function getMetadata(url) {
  return new Promise((resolve, reject) => {
    // Check url validity
    if (!url) {
      return reject({ code: ERROR_CODES.INVALID_URL, message: 'URL is required' });
    }

    ensureBinInPath();
    const bin = getYtDlpBin();

    // Run yt-dlp --dump-json --no-playlist
    // Using Node.js runtime solves JS challenges and returns all resolutions up to 4K/1080p
    const cmd = `${bin} --js-runtimes node --dump-json --no-playlist "${url.replace(/"/g, '\\"')}"`;
    
    // Increase maxBuffer to 15MB to handle very large metadata JSONs
    exec(cmd, { maxBuffer: 15 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp metadata error:', stderr || error.message);
        
        let errorCode = ERROR_CODES.METADATA_FAILED;
        let errorMessage = 'Failed to extract metadata from the provided URL';
        
        if (stderr && (stderr.includes('Unsupported URL') || stderr.includes('not a valid URL'))) {
          errorCode = ERROR_CODES.UNSUPPORTED_SITE;
          errorMessage = 'The provided website or URL is not supported by the downloader';
        } else if (stderr && stderr.includes('Sign in to confirm your age')) {
          errorMessage = 'This video is age-restricted and requires authentication';
        }
        
        return reject({ code: errorCode, message: errorMessage, details: stderr });
      }

      try {
        const data = JSON.parse(stdout);
        const parsed = parseMetadata(data, url);
        resolve(parsed);
      } catch (e) {
        console.error('Failed to parse metadata JSON:', e);
        reject({ code: ERROR_CODES.SERVER_ERROR, message: 'Failed to process metadata response' });
      }
    });
  });
}

/**
 * Parse yt-dlp raw JSON into standardized frontend structures.
 */
function parseMetadata(data, url) {
  const duration = data.duration || 0;
  const rawFormats = data.formats || [];
  
  const videoFormats = [];
  const audioFormats = [];

  rawFormats.forEach(f => {
    // Ignore storyboards and thumbnail packages
    if (f.ext === 'mhtml' || f.vcodec === 'images' || (f.protocol && f.protocol.includes('mhtml'))) {
      return;
    }

    const isVideo = f.vcodec && f.vcodec !== 'none';
    const isAudio = f.acodec && f.acodec !== 'none';
    
    // Estimate size if missing
    let size = f.filesize || f.filesize_approx || null;
    if (!size && f.tbr && duration) {
      // tbr is in kbps. size = tbr * 1000 * duration / 8
      size = Math.round((f.tbr * 1000 * duration) / 8);
    }

    const note = f.format_note || f.format || '';
    
    if (isVideo) {
      // Video format resolution label
      let resolutionLabel = f.height ? `${f.height}p` : 'Video';
      if (f.height >= 2160) resolutionLabel = `4K Ultra HD (${f.height}p)`;
      else if (f.height >= 1440) resolutionLabel = `2K QHD (${f.height}p)`;
      else if (f.height >= 1080) resolutionLabel = `1080p Full HD`;
      else if (f.height >= 720) resolutionLabel = `720p HD`;
      else if (f.height >= 480) resolutionLabel = `480p SD`;

      const fps = f.fps ? `${f.fps}fps` : '';
      const codec = f.vcodec ? f.vcodec.split('.')[0].toUpperCase() : '';
      
      videoFormats.push({
        formatId: f.format_id,
        resolution: resolutionLabel,
        height: f.height || 0,
        fps: f.fps || null,
        ext: f.ext,
        vcodec: f.vcodec,
        acodec: f.acodec,
        size,
        hasAudio: isAudio,
        note: `${resolutionLabel}${fps ? ` ${fps}` : ''} • MP4${codec ? ` (${codec})` : ''}`.trim()
      });
    } else if (isAudio) {
      // Audio-only format
      const bitrate = f.abr ? `${Math.round(f.abr)}kbps` : (f.tbr ? `${Math.round(f.tbr)}kbps` : 'Audio');
      
      audioFormats.push({
        formatId: f.format_id,
        ext: f.ext,
        acodec: f.acodec,
        bitrate,
        size,
        note: `${f.ext.toUpperCase()} (${bitrate}) ${note}`.trim()
      });
    }
  });

  // Sort video formats: height (descending), fps (descending), size (descending)
  videoFormats.sort((a, b) => {
    if (b.height !== a.height) return b.height - a.height;
    if (b.fps !== a.fps) return (b.fps || 0) - (a.fps || 0);
    return (b.size || 0) - (a.size || 0);
  });

  // Add virtual Best Quality (Auto 4K/1080p) option at index 0
  videoFormats.unshift({
    formatId: 'best',
    resolution: 'Maximum Quality (Auto)',
    height: 99999,
    fps: 60,
    ext: 'mp4',
    vcodec: 'auto',
    acodec: 'auto',
    size: null,
    hasAudio: true,
    note: 'Best Video + Best Audio Muxed (Up to 4K / 1080p)'
  });

  // Sort audio formats: size / bitrate (descending)
  audioFormats.sort((a, b) => (b.size || 0) - (a.size || 0));

  // Add virtual audio options for MP3 conversion (since ffmpeg is installed)
  audioFormats.unshift(
    {
      formatId: 'mp3-320k',
      ext: 'mp3',
      acodec: 'mp3',
      bitrate: '320kbps',
      size: duration ? Math.round((320 * 1000 * duration) / 8) : null,
      note: 'MP3 (Audiophile 320kbps) - Crystal Clear'
    },
    {
      formatId: 'mp3-192k',
      ext: 'mp3',
      acodec: 'mp3',
      bitrate: '192kbps',
      size: duration ? Math.round((192 * 1000 * duration) / 8) : null,
      note: 'MP3 (High Quality 192kbps)'
    }
  );

  // Get best available thumbnail
  let thumbnail = data.thumbnail || '';
  if (data.thumbnails && data.thumbnails.length > 0) {
    // Find thumbnail with highest height/width or just the last one
    const sortedThumbnails = [...data.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
    thumbnail = sortedThumbnails[0].url || thumbnail;
  }

  return {
    title: data.title || 'Unknown Title',
    description: data.description || '',
    thumbnail,
    duration,
    uploader: data.uploader || 'Unknown Creator',
    url,
    formats: {
      video: videoFormats,
      audio: audioFormats
    }
  };
}

/**
 * Start download job. Spawns yt-dlp.
 */
function startDownload(jobId, url, formatId, type, timeRange = null) {
  // Ensure temp dir exists
  if (!fs.existsSync(config.DOWNLOAD_DIR)) {
    fs.mkdirSync(config.DOWNLOAD_DIR, { recursive: true });
  }

  const job = jobsService.getJob(jobId);
  if (!job) return;

  const outputTemplate = path.join(config.DOWNLOAD_DIR, `${jobId}.%(ext)s`);
  const args = [];

  // Use Node.js runtime to solve JS challenges
  args.push('--js-runtimes', 'node');
  args.push('--no-playlist');

  // Multi-threaded chunk acceleration (4 parallel worker fragments)
  args.push('--concurrent-fragments', '4');

  // Optional video/audio clipping range (e.g. *01:30-03:45)
  if (timeRange && (timeRange.start || timeRange.end)) {
    const startStr = timeRange.start ? String(timeRange.start).trim() : '0';
    const endStr = timeRange.end ? String(timeRange.end).trim() : 'inf';
    const timePattern = /^[0-9]+(:[0-9]{2}){0,2}(\.[0-9]+)?$/;
    const validStart = (startStr === '0' || timePattern.test(startStr)) ? startStr : '0';
    const validEnd = (endStr === 'inf' || timePattern.test(endStr)) ? endStr : 'inf';

    if (validStart !== '0' || validEnd !== 'inf') {
      args.push('--download-sections', `*${validStart}-${validEnd}`);
      console.log(`[Job ${jobId}] Applying clip time range: *${validStart}-${validEnd}`);
    }
  }

  // Construct arguments with highest quality selectors
  if (type === 'audio') {
    if (formatId.startsWith('mp3-')) {
      const bitrate = formatId.split('-')[1]; // '320k' or '192k'
      args.push(
        '-f', 'bestaudio/best',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', bitrate,
        '-o', outputTemplate,
        url
      );
    } else {
      args.push(
        '-f', formatId,
        '-o', outputTemplate,
        url
      );
    }
  } else {
    // Video type:
    // If 'best' or 'auto', download the absolute highest resolution stream + best audio
    if (formatId === 'best' || !formatId) {
      args.push(
        '-f', 'bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '--audio-quality', '0',
        '-o', outputTemplate,
        url
      );
    } else {
      // Specific format ID (e.g. 1080p, 4K, 720p)
      // Automatically merge with best available audio stream if video-only
      args.push(
        '-f', `${formatId}+bestaudio/best`,
        '--merge-output-format', 'mp4',
        '--audio-quality', '0',
        '-o', outputTemplate,
        url
      );
    }
  }

  // Spawn yt-dlp process
  ensureBinInPath();
  const spawnCmd = getYtDlpSpawnCmd();
  console.log(`Spawning ${spawnCmd} with args: ${args.join(' ')}`);
  const child = spawn(spawnCmd, args);

  // Update job process reference
  const rawJob = jobsService.jobs.get(jobId);
  if (rawJob) {
    rawJob.process = child;
    rawJob.status = JOB_STATUS.DOWNLOADING;
  }

  // Parse progress output
  // Example stdout line: [download]  12.5% of  10.00MiB at  1.50MiB/s ETA 00:05
  // Example merging line: [Merger] Merging formats into "..."
  const progressRegex = /\[download\]\s+([0-9.]+)%\s+of\s+(?:~)?([0-9.a-zA-Z]+)\s+at\s+([0-9.a-zA-Z/]+)\s+ETA\s+([0-9:]+)/;
  
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      // Check for merger
      if (line.includes('[Merger]') || line.includes('[ffmpeg]')) {
        jobsService.updateJob(jobId, {
          status: JOB_STATUS.MERGING,
          progress: 99,
          speed: '0 B/s',
          eta: '--:--'
        });
        continue;
      }

      // Check for standard download progress
      const match = line.match(progressRegex);
      if (match) {
        const progress = parseFloat(match[1]);
        const totalSize = match[2];
        const speed = match[3];
        const eta = match[4];

        jobsService.updateJob(jobId, {
          status: JOB_STATUS.DOWNLOADING,
          progress,
          totalSize,
          speed,
          eta
        });
      }
    }
  });

  child.stderr.on('data', (data) => {
    const line = data.toString();
    console.warn(`yt-dlp stderr [${jobId}]:`, line);
    // Some warnings are non-fatal, but we can log them
  });

  child.on('close', (code) => {
    console.log(`yt-dlp process for job ${jobId} exited with code ${code}`);
    
    const currentJob = jobsService.jobs.get(jobId);
    if (!currentJob) return;

    if (currentJob.status === JOB_STATUS.CANCELLED) {
      console.log(`Job ${jobId} was already cancelled.`);
      return;
    }

    if (code === 0) {
      // Find the completed file in the temp directory (starts with jobId)
      try {
        const files = fs.readdirSync(config.DOWNLOAD_DIR);
        const matchFile = files.find(f => f.startsWith(jobId));

        if (matchFile) {
          const finalFilePath = path.join(config.DOWNLOAD_DIR, matchFile);
          
          // Generate a user-friendly name using the video title and extension
          const ext = path.extname(matchFile);
          const cleanTitle = sanitize(currentJob.fileName) || 'download';
          const downloadName = `${cleanTitle}${ext}`;

          jobsService.updateJob(jobId, {
            status: JOB_STATUS.COMPLETED,
            progress: 100,
            speed: '0 B/s',
            eta: '00:00',
            filePath: finalFilePath,
            fileName: downloadName,
            process: null
          });
          console.log(`Job ${jobId} completed successfully. Saved to ${finalFilePath}`);
        } else {
          throw new Error('Downloaded file not found in temp directory');
        }
      } catch (e) {
        console.error(`Error completing job ${jobId}:`, e);
        jobsService.updateJob(jobId, {
          status: JOB_STATUS.FAILED,
          error: 'Downloaded file could not be finalized.',
          process: null
        });
      }
    } else {
      jobsService.updateJob(jobId, {
        status: JOB_STATUS.FAILED,
        error: `yt-dlp exited with error code ${code}. Check the logs or try another quality option.`,
        process: null
      });
    }
  });
}

module.exports = {
  getMetadata,
  startDownload
};
