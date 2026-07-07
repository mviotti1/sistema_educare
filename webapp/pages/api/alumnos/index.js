import { leerAlumnos, crearAlumno } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const alumnos = await leerAlumnos();
      res.json(alumnos);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { nombre, apellido } = req.body;
      if (!nombre || !apellido) return res.status(400).json({ error: 'Nombre y apellido son requeridos' });
      const result = await crearAlumno(req.body);
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
