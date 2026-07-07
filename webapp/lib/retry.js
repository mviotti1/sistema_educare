const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_CODES  = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EPIPE']);

function isRetryable(err) {
  const status = Number(err.code || err.status || err.response?.status);
  if (RETRYABLE_STATUS.has(status)) return true;
  if (RETRYABLE_CODES.has(err.code))  return true;
  return false;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 600 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;
      const retryAfterSec = Number(err.response?.headers?.['retry-after'] || 0);
      const delay = retryAfterSec > 0
        ? retryAfterSec * 1000
        : baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[retry] intento ${attempt}/${maxAttempts} falló (${err.code || err.status || err.message}), reintentando en ${delay}ms`);
      await sleep(delay);
    }
  }
}
