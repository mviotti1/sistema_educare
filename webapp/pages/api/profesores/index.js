import { leerProfesores, crearProfesor } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const profesores = await leerProfesores();
      res.json(profesores);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { nombre, apellido, telefono, correo } = req.body;
      if (!nombre || !apellido || !telefono || !correo)
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
      const result = await crearProfesor(req.body);
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
