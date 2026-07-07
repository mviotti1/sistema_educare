// Horario de atención del instituto: 8:00 a 21:00 inclusive, slots de 30 min → 27 valores.
export const HORARIOS = Array.from({ length: 27 }, (_, i) => {
  const totalMin = 8 * 60 + i * 30;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

export function calcDuracion(inicio, fin) {
  if (!inicio || !fin) return null;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  const d = (h2 * 60 + m2) - (h1 * 60 + m1);
  return d > 0 ? d : null;
}

export function horaFinDesde(inicio, duracion) {
  if (!inicio || !duracion) return '';
  const [h, m] = inicio.split(':').map(Number);
  const totalMin = h * 60 + m + duracion;
  const nh = Math.floor(totalMin / 60);
  const nm = totalMin % 60;
  if (nh > 21 || (nh === 21 && nm > 0)) return '';
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}
