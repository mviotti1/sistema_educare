import { leerRecurrentes, crearRecurrente } from '../../../lib/sheets';
import { generarInstancias, rangoTemplate } from '../../../lib/recurrentes';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      res.json(await leerRecurrentes());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const result = await crearRecurrente(req.body);
      res.status(201).json(result);

      const template = { ...req.body, id: result.id };
      const { desde, hasta } = rangoTemplate(template);
      generarInstancias(template, desde, hasta)
        .catch(err => console.error('[recurrentes] auto-generar error:', err.message));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
