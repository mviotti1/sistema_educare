import { limpiarIdCalendarTodas } from '../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    await limpiarIdCalendarTodas();
    res.json({ ok: true });
  } catch (err) {
    console.error('[limpiar-id-calendar] error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
