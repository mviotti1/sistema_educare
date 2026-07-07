import { leerMeta } from '../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  console.log('[api:meta] GET');
  try {
    const meta = await leerMeta();
    console.log('[api:meta] GET - OK | alumnos:', meta.alumnos?.length, '| profesores:', meta.profesores?.length);
    res.json(meta);
  } catch (err) {
    console.error('[api:meta] GET error:', err);
    res.status(500).json({ error: err.message });
  }
}
