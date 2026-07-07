import { useState, useEffect } from 'react';

const EMPTY = { nombre: '', tipo_educacion: '', nivel: '' };

export default function RegistroMateriasView({ showToast }) {
  const [materias, setMaterias]     = useState([]);
  const [cargando, setCargando]     = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [agregando, setAgregando]   = useState(false);
  const [nuevoForm, setNuevoForm]   = useState(EMPTY);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/materias');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setMaterias(await res.json());
    } catch (err) {
      console.error('[RegistroMateriasView] cargar:', err);
    } finally {
      setCargando(false);
    }
  }

  function startEdit(m) {
    setAgregando(false);
    setEditandoId(m.id);
    setEditForm({ nombre: m.nombre, tipo_educacion: m.tipo_educacion, nivel: m.nivel });
  }

  function cancelEdit() { setEditandoId(null); }

  function startAgregar() {
    setEditandoId(null);
    setNuevoForm(EMPTY);
    setAgregando(true);
  }

  async function handleGuardar(id) {
    const esUniv = editForm.tipo_educacion?.toUpperCase() === 'UNIVERSITARIO';
    if (!editForm.nombre || !editForm.tipo_educacion || (!esUniv && !editForm.nivel))
      return showToast('Todos los campos son requeridos', 'error');
    const res = await fetch(`/api/materias/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) { showToast((await res.json()).error || 'Error al guardar', 'error'); return; }
    setEditandoId(null);
    await cargar();
    showToast('Materia actualizada');
  }

  async function handleEliminar(id) {
    const res = await fetch(`/api/materias/${id}`, { method: 'DELETE' });
    if (!res.ok) { showToast((await res.json()).error || 'Error al eliminar', 'error'); return; }
    await cargar();
    showToast('Materia eliminada');
  }

  async function handleAgregar() {
    const esUniv = nuevoForm.tipo_educacion?.toUpperCase() === 'UNIVERSITARIO';
    if (!nuevoForm.nombre || !nuevoForm.tipo_educacion || (!esUniv && !nuevoForm.nivel))
      return showToast('Todos los campos son requeridos', 'error');
    const res = await fetch('/api/materias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoForm),
    });
    if (!res.ok) { showToast((await res.json()).error || 'Error al crear', 'error'); return; }
    setAgregando(false);
    await cargar();
    showToast('Materia agregada');
  }

  const setE = (k, v) => setEditForm(p => ({ ...p, [k]: v }));
  const setN = (k, v) => setNuevoForm(p => ({ ...p, [k]: v }));

  const actionBtns = (onSave, onCancel) => (
    <div style={{ display: 'flex', gap: 4 }}>
      <button className="btn btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 11 }} onClick={onSave}>Guardar</button>
      <button className="btn btn-ghost"   style={{ height: 26, padding: '0 10px', fontSize: 11 }} onClick={onCancel}>Cancelar</button>
    </div>
  );

  return (
    <div className="view-container">
      <div className="view-topbar">
        <span className="view-title">Registro de materias</span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={startAgregar}>
          + Nueva materia
        </button>
      </div>

      <div className="table-wrap">
        {cargando ? (
          <div className="loading">Cargando materias...</div>
        ) : (
          <table className="clases-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Tipo de educación</th>
                <th>Nivel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agregando && (
                <tr className="editing">
                  <td className="td-id">—</td>
                  <td><input className="tbl-input" value={nuevoForm.nombre}         onChange={e => setN('nombre',         e.target.value)} placeholder="Nombre"            autoFocus /></td>
                  <td><input className="tbl-input" value={nuevoForm.tipo_educacion} onChange={e => setN('tipo_educacion', e.target.value)} placeholder="Tipo de educación" /></td>
                  <td>
                    {nuevoForm.tipo_educacion?.toUpperCase() === 'UNIVERSITARIO'
                      ? <span className="td-muted" style={{ fontSize: 11 }}>—</span>
                      : <input className="tbl-input" value={nuevoForm.nivel} onChange={e => setN('nivel', e.target.value)} placeholder="Nivel" />
                    }
                  </td>
                  <td>{actionBtns(handleAgregar, () => setAgregando(false))}</td>
                </tr>
              )}
              {materias.map(m => (
                editandoId === m.id ? (
                  <tr key={m.id} className="editing">
                    <td className="td-id">{m.id}</td>
                    <td><input className="tbl-input" value={editForm.nombre}         onChange={e => setE('nombre',         e.target.value)} autoFocus /></td>
                    <td><input className="tbl-input" value={editForm.tipo_educacion} onChange={e => setE('tipo_educacion', e.target.value)} /></td>
                    <td>
                      {editForm.tipo_educacion?.toUpperCase() === 'UNIVERSITARIO'
                        ? <span className="td-muted" style={{ fontSize: 11 }}>—</span>
                        : <input className="tbl-input" value={editForm.nivel} onChange={e => setE('nivel', e.target.value)} />
                      }
                    </td>
                    <td>{actionBtns(() => handleGuardar(m.id), cancelEdit)}</td>
                  </tr>
                ) : (
                  <tr key={m.id}>
                    <td className="td-id">{m.id}</td>
                    <td>{m.nombre}</td>
                    <td className="td-muted">{m.tipo_educacion || '—'}</td>
                    <td className="td-muted">{m.nivel          || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="bloque-btn-edit"   onClick={() => startEdit(m)}         title="Editar">✎</button>
                        <button className="bloque-btn-delete" onClick={() => handleEliminar(m.id)} title="Eliminar">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
              {materias.length === 0 && !cargando && !agregando && (
                <tr><td colSpan={5} className="empty-state">Sin materias</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="row-hint">
        <span>{materias.length} materia(s)</span>
      </div>
    </div>
  );
}
