const API_BASE = import.meta.env.VITE_API_URL || 'https://cloudclip-vop8.onrender.com/api';

/**
 * Handle API responses and throw parsed errors.
 */
async function handleResponse(response) {
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: `HTTP Error ${response.status}: ${response.statusText}` };
    }
    const err = new Error(errorData.message || 'API request failed');
    err.code = errorData.code || 'API_ERROR';
    throw err;
  }
  return response.json();
}

/**
 * Fetch media metadata from URL.
 */
export async function getMetadata(url) {
  const response = await fetch(`${API_BASE}/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return handleResponse(response);
}

/**
 * Start download job with optional timeRange clipping.
 */
export async function prepareDownload(url, formatId, type, title, timeRange = null) {
  const payload = { url, formatId, type, title };
  if (timeRange && (timeRange.start || timeRange.end)) {
    payload.timeRange = timeRange;
  }
  const response = await fetch(`${API_BASE}/download/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
}

/**
 * Check job status (fallback polling).
 */
export async function getJobStatus(jobId) {
  const response = await fetch(`${API_BASE}/download/status/${jobId}`);
  return handleResponse(response);
}

/**
 * Subscribe to real-time job progress stream via Server-Sent Events (SSE).
 * Returns a cleanup unsubscribe function.
 */
export function subscribeToJobProgress(jobId, onProgress, onError) {
  try {
    const eventSource = new EventSource(`${API_BASE}/download/events/${jobId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
        if (['completed', 'failed', 'cancelled'].includes(data.status)) {
          eventSource.close();
        }
      } catch (e) {
        console.error('Failed to parse SSE event data:', e);
      }
    };

    eventSource.onerror = (err) => {
      eventSource.close();
      if (onError) onError(err);
    };

    return () => {
      eventSource.close();
    };
  } catch (e) {
    if (onError) onError(e);
    return () => {};
  }
}

/**
 * Cancel a download job.
 */
export async function cancelDownload(jobId) {
  const response = await fetch(`${API_BASE}/download/cancel/${jobId}`, {
    method: 'POST'
  });
  return handleResponse(response);
}

/**
 * Get the direct download URL for a completed job.
 */
export function getDownloadFileUrl(jobId) {
  return `${API_BASE}/download/file/${jobId}`;
}
