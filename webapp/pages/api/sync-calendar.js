import { leerClases, leerProfesores, guardarIdCalendar } from '../../lib/sheets';
import { crearEvento, sincronizarEvento } from '../../lib/gcal';

// Lock in-process para evitar runs concurrentes desde múltiples pestañas/clientes.
// Sin esto, dos pestañas abiertas en el mismo navegador con el setInterval de 20 min
// disparan /api/sync-calendar al mismo tiempo, crean DOS eventos por clase en GCal,
// y guardan el id_calendar del segundo — el primer evento queda huérfano para siempre.
let syncRunning = false;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (syncRunning) {
    console.log('[sync-calendar] skip — ya hay un sync en curso');
    return res.status(429).json({ skipped: true, reason: 'sync already running' });
  }
  syncRunning = true;

  try {
    const [clases, profesores] = await Promise.all([leerClases(), leerProfesores()]);
    const profesoresMap = new Map(profesores.map(p => [String(p.id), p]));
    const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };
    const BATCH = 10;

    for (let i = 0; i < clases.length; i += BATCH) {
      const lote    = clases.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        lote.map(clase => reconciliar(clase, stats, profesoresMap))
      );
      results.forEach((r, j) => {
        if (r.status === 'rejected') {
          console.error(`[sync] clase ${lote[j].id_clase}:`, r.reason?.message);
          stats.errors++;
        }
      });
    }

    console.log('[sync-calendar] completado:', stats);
    res.json(stats);
  } catch (err) {
    console.error('[sync-calendar] error general:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    syncRunning = false;
  }
}

async function reconciliar(clase, stats, profesoresMap) {
  const prof = profesoresMap.get(String(clase.id_profesor));
  if (!prof?.id_calendario) { stats.skipped++; return; }
  const calProf = prof.id_calendario;

  if (clase.id_calendar) {
    const result = await sincronizarEvento(clase.id_calendar, clase, calProf);
    if (result === 'updated') {
      stats.updated++;
    } else if (result === 'not_found') {
      const eventId = await crearEvento(clase, 'none', calProf);
      await guardarIdCalendar(clase.id_clase, eventId);
      stats.created++;
    } else {
      stats.skipped++;
    }
  } else {
    const eventId = await crearEvento(clase, 'none', calProf);
    await guardarIdCalendar(clase.id_clase, eventId);
    stats.created++;
  }
}
