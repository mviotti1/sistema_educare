import { leerDisponibilidad, crearBloque } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const bloques = await leerDisponibilidad();
      const { id_profesor } = req.query;
      const result = id_profesor
        ? bloques.filter(b => String(b.id_profesor) === String(id_profesor))
        : bloques;
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const result = await crearBloque(req.body);
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
