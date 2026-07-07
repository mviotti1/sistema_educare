import { leerMaterias, crearMateria } from '../../../lib/sheets';

function isDup(materias, { nombre, tipo_educacion, nivel }, excludeId = null) {
  return materias.some(m =>
    (excludeId === null || String(m.id) !== String(excludeId)) &&
    m.nombre.trim().toLowerCase()         === nombre.trim().toLowerCase() &&
    m.tipo_educacion.trim().toLowerCase() === tipo_educacion.trim().toLowerCase() &&
    (m.nivel || '').trim().toLowerCase()  === (nivel || '').trim().toLowerCase()
  );
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      res.json(await leerMaterias());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { nombre, tipo_educacion, nivel } = req.body;
      const esUniv = (tipo_educacion || '').toUpperCase() === 'UNIVERSITARIO';
      if (!nombre || !tipo_educacion || (!esUniv && !nivel))
        return res.status(400).json({ error: 'Todos los campos son requeridos' });

      const materias = await leerMaterias();
      if (isDup(materias, { nombre, tipo_educacion, nivel: nivel || '' }))
        return res.status(409).json({ error: 'Ya existe una materia con ese nombre, tipo y nivel' });

      res.status(201).json(await crearMateria(req.body));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
