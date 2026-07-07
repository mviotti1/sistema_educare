// Contrato del bot (n8n book_class). Centraliza la escritura con lock + re-check (fix #1).
// Acepta la forma ISO8601 + duración que ya emite el nodo crear_clase.
// NO sincroniza Google Calendar: los eventos de reservas del bot los crea el cron sync-calendar,
// igual que hoy (mantener el comportamiento previo).
import { crearReservaBotConLock } from '../../../lib/reservas';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  try {
    const { id_clase } = await crearReservaBotConLock(req.body);
    console.log('[api:reservas/agendar] reserva creada id_clase:', id_clase);
    return res.status(201).json({ id_clase });
  } catch (err) {
    if (err.status === 409) {
      console.warn('[api:reservas/agendar] 409 slot ocupado:', err.motivo);
      return res.status(409).json({ error: 'slot_ocupado', motivo: err.motivo });
    }
    console.error('[api:reservas/agendar] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
