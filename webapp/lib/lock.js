// Mutex distribuido sobre el Redis de n8n (mismo educareNet, host n8n_redis, DB 0).
// FAIL-OPEN por decisión de producto: si Redis no está, se ejecuta fn() igual (sin lock) y
// se loguea alerta — se prioriza disponibilidad sobre la garantía anti-doble-reserva.
import Redis from 'ioredis';

let _redis = null;
let _disabled = false;

function getRedis() {
  if (_disabled) return null;
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    _disabled = true;
    console.warn('[lock] REDIS_URL no definido — locks deshabilitados (fail-open)');
    return null;
  }
  _redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    enableOfflineQueue: false,        // comandos fallan rápido si no hay conexión → fail-open
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
  });
  _redis.on('error', (e) => console.warn('[lock] redis error:', e.message));
  return _redis;
}

// Release seguro: solo borra la clave si el token sigue siendo el nuestro (no libera lock ajeno).
const RELEASE_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

function nuevoToken() {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Ejecuta fn() en exclusión mutua bajo `key`. Fail-open ante Redis caído o contención sostenida.
 * @param key   clave del lock (ej: 'lock:booking:2026-06-20')
 * @param fn    función async a ejecutar dentro de la sección crítica
 * @param opts  {ttlMs=15000, waitMs=3000}
 */
export async function withLock(key, fn, { ttlMs = 15000, waitMs = 3000 } = {}) {
  const redis = getRedis();
  if (!redis) return fn(); // sin Redis configurado → fail-open

  const token = nuevoToken();
  const deadline = Date.now() + waitMs;
  let acquired = false;

  try {
    while (Date.now() < deadline) {
      try {
        const ok = await redis.set(key, token, 'PX', ttlMs, 'NX');
        if (ok === 'OK') { acquired = true; break; }
      } catch (e) {
        console.warn(`[lock] ${key} — redis no disponible (${e.message}); fail-open`);
        return fn();
      }
      await sleep(80);
    }
    if (!acquired) {
      console.warn(`[lock] ${key} — no adquirido en ${waitMs}ms (contención); procede degradado`);
      return fn();
    }
    return await fn();
  } finally {
    if (acquired) {
      try { await redis.eval(RELEASE_LUA, 1, key, token); }
      catch (e) { console.warn(`[lock] ${key} — release falló (${e.message}); expira por TTL`); }
    }
  }
}

export function lockBookingKey(fecha) { return `lock:booking:${fecha}`; }
