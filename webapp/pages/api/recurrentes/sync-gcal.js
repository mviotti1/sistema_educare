import { leerRecurrentes, guardarIdCalendarRecurrente } from '../../../lib/sheets';
import { eliminarEvento } from '../../../lib/gcal';

// Limpia los eventos recurrentes huérfanos que quedaron en el calendario principal
// (educare050@gmail.com) de la arquitectura anterior. Correr una sola vez.
// Después de correrlo, todos los templates tendrán id_calendar vacío y este endpoint
// se convierte en no-op.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const templates = await leerRecurrentes();
    const stats = { cleaned: 0, skipped: 0, errors: 0 };

    for (const t of templates) {
      if (!t.id_calendar) { stats.skipped++; continue; }
      try {
        await eliminarEvento(t.id_calendar).catch(() => {});
        await guardarIdCalendarRecurrente(t.id, '');
        stats.cleaned++;
      } catch (err) {
        console.error(`[recurrentes/sync-gcal] template ${t.id}:`, err.message);
        stats.errors++;
      }
    }

    console.log('[recurrentes/sync-gcal] limpieza completada:', stats);
    res.json({ ...stats, created: 0, updated: stats.cleaned });
  } catch (err) {
    console.error('[recurrentes/sync-gcal] error general:', err.message);
    res.status(500).json({ error: err.message });
  }
}
