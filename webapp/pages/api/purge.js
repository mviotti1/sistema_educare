import { leerClases, eliminarClasesBatch } from '../../lib/sheets';
import { esCancelado } from '../../lib/gcal';

const LIMITE = 2000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const clases = await leerClases();
    const total  = clases.length;

    if (total <= LIMITE) {
      console.log(`[purge] ${total} filas — dentro del límite, nada que purgar`);
      return res.json({ purgadas: 0, total });
    }

    const exceso = total - LIMITE;

    // Candidatas: sólo canceladas, ordenadas por fecha ascendente (más antigua primero).
    // Clases sin fecha van al final para no adelantarse a datos legítimos.
    const candidatas = clases
      .filter(c => esCancelado(c.id_estado))
      .sort((a, b) => {
        if (!a.fecha && !b.fecha) return 0;
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return a.fecha.localeCompare(b.fecha);
      });

    if (!candidatas.length) {
      console.log(`[purge] ${total} filas pero no hay canceladas para purgar`);
      return res.json({ purgadas: 0, total, warning: 'Sin canceladas purgables' });
    }

    const aPurgar = candidatas.slice(0, exceso);
    const ids     = aPurgar.map(c => c.id_clase);

    console.log(`[purge] total=${total} exceso=${exceso} purgando=${aPurgar.length} canceladas del Sheet (eventos Calendar se preservan)`);

    await eliminarClasesBatch(ids);

    console.log(`[purge] completado — purgadas del Sheet: ${aPurgar.length}`);
    res.json({ purgadas: aPurgar.length, total });

  } catch (err) {
    console.error('[purge] error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
