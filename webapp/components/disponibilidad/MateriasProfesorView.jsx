import { useState, useEffect } from 'react';
import SearchSelect from '../SearchSelect';

export default function MateriasProfesorView({ showToast, meta }) {
  const [idProfesor, setIdProfesor] = useState('');
  const [asignadas, setAsignadas]   = useState([]);
  const [cargando, setCargando]     = useState(false);
  const [agregando, setAgregando]   = useState(false);
  const [selMateria, setSelMateria] = useState('');

  useEffect(() => {
    if (idProfesor) cargar();
    else setAsignadas([]);
  }, [idProfesor]);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/materia-profesor?id_profesor=${idProfesor}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setAsignadas(data.map(r => r.id_materia));
    } catch (err) {
      console.error('[MateriasProfesorView] cargar:', err);
    } finally {
      setCargando(false);
    }
  }

  async function handleAgregar() {
    if (!selMateria) return showToast('Seleccioná una materia', 'error');
    const res = await fetch('/api/materia-profesor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_materia: selMateria, id_profesor: idProfesor }),
    });
    if (!res.ok) { showToast((await res.json()).error || 'Error al asignar', 'error'); return; }
    setAgregando(false);
    setSelMateria('');
    await cargar();
    showToast('Materia asignada');
  }

  async function handleQuitar(id_materia) {
    const res = await fetch(
      `/api/materia-profesor?id_materia=${id_materia}&id_profesor=${idProfesor}`,
      { method: 'DELETE' }
    );
    if (!res.ok) { showToast((await res.json()).error || 'Error al quitar', 'error'); return; }
    await cargar();
    showToast('Materia quitada');
  }

  const todaMateria = meta.materias || [];
  const disponibles = todaMateria.filter(m => !asignadas.includes(String(m.id)));
  const asignadasInfo = asignadas
    .map(id => todaMateria.find(m => String(m.id) === id))
    .filter(Boolean);

  return (
    <div className="view-container">
      <div className="view-topbar">
        <span className="view-title">Materias por profesor</span>
      </div>

      <div className="disp-selector">
        <SearchSelect
          className="form-select"
          style={{ minWidth: 240 }}
          value={idProfesor}
          onChange={e => { setIdProfesor(e.target.value); setAgregando(false); setSelMateria(''); }}
          options={(meta.profesores || []).map(p => ({ value: String(p.id), label: p.nombre }))}
          placeholder="— Seleccionar profesor —"
        />
      </div>

      {!idProfesor && (
        <div className="mp-placeholder">Seleccioná un profesor para ver sus materias</div>
      )}

      {idProfesor && (
        cargando ? (
          <div className="loading">Cargando...</div>
        ) : (
          <div className="mp-panel">
            {/* Header fijo con contador y botón agregar */}
            <div className="mp-panel-header">
              <div className="mp-panel-title">
                Materias asignadas
                <span className="mp-count-badge">{asignadasInfo.length}</span>
              </div>
              {!agregando && disponibles.length > 0 && (
                <button className="btn btn-primary mp-add-btn" onClick={() => setAgregando(true)}>
                  + Agregar materia
                </button>
              )}
            </div>

            {/* Formulario de agregar — aparece justo debajo del header */}
            {agregando && (
              <div className="mp-add-form">
                <SearchSelect
                  className="form-select"
                  style={{ flex: 1, minWidth: 180 }}
                  value={selMateria}
                  onChange={e => setSelMateria(e.target.value)}
                  options={disponibles.map(m => ({ value: String(m.id), label: m.label || m.nombre }))}
                  placeholder="— Seleccionar materia —"
                />
                <button className="btn btn-primary" style={{ height: 30, flexShrink: 0 }} onClick={handleAgregar}>
                  Agregar
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ height: 30, flexShrink: 0 }}
                  onClick={() => { setAgregando(false); setSelMateria(''); }}
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Chips — área scrolleable independiente */}
            <div className="mp-chips-scroll">
              {asignadasInfo.length === 0 ? (
                <div className="mp-empty">Sin materias asignadas</div>
              ) : (
                <div className="mp-chips">
                  {asignadasInfo.map(m => (
                    <div key={m.id} className="mp-chip">
                      <span className="mp-chip-name">{m.label || m.nombre}</span>
                      <button
                        className="mp-chip-remove"
                        onClick={() => handleQuitar(String(m.id))}
                        title="Quitar materia"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
