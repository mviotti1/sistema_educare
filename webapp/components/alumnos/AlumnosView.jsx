import { useState, useEffect } from 'react';
import { useDialog } from '../../lib/useDialog';

const EMPTY = {
  nombre: '', apellido: '', telefono: '', tel_alternativo: '', correo: '',
  tipo_educacion: '', nivel: '', colegio: '',
  tiene_CUD: 'NO', condicion: '',
  tiene_psicopedagoga: 'NO', psico_nombre: '', psico_tel: '',
  tiene_fono: 'NO', fono_nombre: '', fono_tel: '',
  tiene_psicologo: 'NO', psicologo_nombre: '', psicologo_tel: '',
  tiene_teo: 'NO', teo_nombre: '', teo_tel_contacto: '',
};

function isIncomplete(a) {
  if (!a.nombre || !a.apellido || !a.telefono || !a.correo) return true;
  if (!a.tipo_educacion || !a.nivel || !a.colegio) return true;
  if (a.tiene_psicopedagoga === 'SI' && (!a.psico_nombre     || !a.psico_tel))     return true;
  if (a.tiene_fono         === 'SI' && (!a.fono_nombre       || !a.fono_tel))      return true;
  if (a.tiene_psicologo    === 'SI' && (!a.psicologo_nombre  || !a.psicologo_tel)) return true;
  if (a.tiene_teo          === 'SI' && (!a.teo_nombre || !a.teo_tel_contacto))     return true;
  return false;
}

function SiNoToggle({ value, onChange }) {
  return (
    <div className="si-no-toggle">
      <button className={`si-no-btn ${value === 'SI' ? 'active' : ''}`} type="button" onClick={() => onChange('SI')}>SI</button>
      <button className={`si-no-btn ${value === 'NO' ? 'active' : ''}`} type="button" onClick={() => onChange('NO')}>NO</button>
    </div>
  );
}

function ProfSection({ label, toggleKey, nombreKey, telKey, form, setMany }) {
  return (
    <div className="prof-section">
      <div className="prof-section-header">
        <span className="prof-label">{label}</span>
        <SiNoToggle
          value={form[toggleKey]}
          onChange={v => setMany(v === 'NO'
            ? { [toggleKey]: 'NO', [nombreKey]: '', [telKey]: '' }
            : { [toggleKey]: 'SI' }
          )}
        />
      </div>
      {form[toggleKey] === 'SI' && (
        <div className="prof-section-fields">
          <input className="panel-input" placeholder="Nombre" value={form[nombreKey]} onChange={e => setMany({ [nombreKey]: e.target.value })} />
          <input className="panel-input" placeholder="Teléfono" value={form[telKey]} onChange={e => setMany({ [telKey]: e.target.value })} />
        </div>
      )}
    </div>
  );
}

export default function AlumnosView({ showToast }) {
  const { showConfirm, dialogNode } = useDialog();
  const [alumnos, setAlumnos]     = useState([]);
  const [cargando, setCargando]   = useState(false);
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [agregando, setAgregando] = useState(false);
  const [busqueda, setBusqueda]   = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/alumnos');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setAlumnos(await res.json());
    } catch (err) {
      console.error('[AlumnosView] cargar:', err);
    } finally {
      setCargando(false);
    }
  }

  function selectAlumno(a) {
    setAgregando(false);
    setSelected(a);
    setForm({ ...EMPTY, ...a });
  }

  function startAgregar() {
    setSelected(null);
    setAgregando(true);
    setForm({ ...EMPTY });
  }

  function cancelar() { setSelected(null); setAgregando(false); }

  function set(k, v)   { setForm(p => ({ ...p, [k]: v })); }
  function setMany(obj) { setForm(p => ({ ...p, ...obj })); }

  async function guardar() {
    if (!form.nombre || !form.apellido) return showToast('Nombre y apellido son requeridos', 'error');
    if (agregando) {
      const res = await fetch('/api/alumnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { showToast((await res.json()).error || 'Error al crear', 'error'); return; }
      setAgregando(false);
      await cargar();
      showToast('Alumno agregado');
    } else {
      const res = await fetch(`/api/alumnos/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { showToast((await res.json()).error || 'Error al guardar', 'error'); return; }
      setSelected(null);
      await cargar();
      showToast('Alumno actualizado');
    }
  }

  async function eliminar() {
    if (!await showConfirm(`¿Eliminar al alumno ${selected.nombre} ${selected.apellido}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/alumnos/${selected.id}`, { method: 'DELETE' });
    if (!res.ok) { showToast((await res.json()).error || 'Error al eliminar', 'error'); return; }
    setSelected(null);
    await cargar();
    showToast('Alumno eliminado');
  }

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? alumnos.filter(a =>
        a.nombre.toLowerCase().includes(q)   ||
        a.apellido.toLowerCase().includes(q) ||
        (a.telefono || '').toLowerCase().includes(q) ||
        (a.correo   || '').toLowerCase().includes(q)
      )
    : alumnos;

  const panelVisible = !!(selected || agregando);

  return (
    <div className="alumnos-shell">
      <div className="alumnos-topbar">
        <span className="view-title">Alumnos</span>
        <input
          className="filter-input w-lg"
          placeholder="Buscar por nombre, apellido, teléfono o correo..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ marginLeft: 16, width: 280 }}
        />
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={startAgregar}>
          + Nuevo alumno
        </button>
      </div>

      <div className="alumnos-layout">
        <div className="alumnos-table-col">
          <div className="table-wrap">
            {cargando ? (
              <div className="loading">Cargando alumnos...</div>
            ) : (
              <table className="clases-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Apellido</th>
                    <th>Teléfono</th>
                    <th>Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(a => (
                    <tr
                      key={a.id}
                      className={[
                        selected?.id === a.id ? 'row-selected' : '',
                        isIncomplete(a) ? 'row-incomplete' : '',
                      ].join(' ').trim()}
                      onClick={() => selectAlumno(a)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="td-id">{a.id}</td>
                      <td>{a.nombre}</td>
                      <td>{a.apellido}</td>
                      <td className="td-muted">{a.telefono || '—'}</td>
                      <td className="td-muted">{a.correo   || '—'}</td>
                    </tr>
                  ))}
                  {visibles.length === 0 && !cargando && (
                    <tr><td colSpan={5} className="empty-state">{q ? 'Sin resultados' : 'Sin alumnos'}</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <div className="row-hint">
            <span>{visibles.length}{q ? ` de ${alumnos.length}` : ''} alumno(s)</span>
          </div>
        </div>

        {panelVisible && (
          <div className="alumnos-panel">
            <div className="panel-header">
              <span className="panel-title">
                {agregando ? 'Nuevo alumno' : `Alumno #${selected.id}`}
              </span>
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
                {!agregando && (
                  <button className="bloque-btn-delete" onClick={eliminar} title="Eliminar">✕</button>
                )}
                <button className="btn btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 11 }} onClick={cancelar}>
                  Cancelar
                </button>
                <button className="btn btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 11 }} onClick={guardar}>
                  Guardar
                </button>
              </div>
            </div>

            <div className="panel-scroll">
              <div className="panel-section">
                <div className="panel-section-title">Datos personales</div>
                <div className="panel-row-2">
                  <div className="panel-field">
                    <label>Nombre *</label>
                    <input className="panel-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre" autoFocus={agregando} />
                  </div>
                  <div className="panel-field">
                    <label>Apellido *</label>
                    <input className="panel-input" value={form.apellido} onChange={e => set('apellido', e.target.value)} placeholder="Apellido" />
                  </div>
                </div>
                <div className="panel-row-2">
                  <div className="panel-field">
                    <label>Teléfono</label>
                    <input className="panel-input" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="Teléfono" />
                  </div>
                  <div className="panel-field">
                    <label>Teléfono alternativo</label>
                    <input className="panel-input" value={form.tel_alternativo} onChange={e => set('tel_alternativo', e.target.value)} placeholder="Teléfono alternativo" />
                  </div>
                </div>
                <div className="panel-field">
                  <label>Correo</label>
                  <input className="panel-input" value={form.correo} onChange={e => set('correo', e.target.value)} placeholder="Correo electrónico" />
                </div>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">Info educativa</div>
                <div className="panel-row-2">
                  <div className="panel-field">
                    <label>Tipo de educación</label>
                    <input className="panel-input" value={form.tipo_educacion} onChange={e => set('tipo_educacion', e.target.value)} placeholder="Tipo" />
                  </div>
                  <div className="panel-field">
                    <label>Nivel educativo</label>
                    <input className="panel-input" value={form.nivel} onChange={e => set('nivel', e.target.value)} placeholder="Nivel" />
                  </div>
                </div>
                <div className="panel-field">
                  <label>Colegio</label>
                  <input className="panel-input" value={form.colegio} onChange={e => set('colegio', e.target.value)} placeholder="Nombre del colegio" />
                </div>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">Condición</div>
                <div className="panel-row-toggle">
                  <span className="prof-label">CUD</span>
                  <SiNoToggle value={form.tiene_CUD} onChange={v => set('tiene_CUD', v)} />
                </div>
                <div className="panel-field" style={{ marginTop: 8 }}>
                  <label>Condición</label>
                  <input className="panel-input" value={form.condicion} onChange={e => set('condicion', e.target.value)} placeholder="Condición del alumno" />
                </div>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">Profesionales</div>
                <ProfSection label="Psicopedagoga" toggleKey="tiene_psicopedagoga" nombreKey="psico_nombre"     telKey="psico_tel"     form={form} setMany={setMany} />
                <ProfSection label="Fonoaudiólogo" toggleKey="tiene_fono"          nombreKey="fono_nombre"      telKey="fono_tel"      form={form} setMany={setMany} />
                <ProfSection label="Psicólogo"     toggleKey="tiene_psicologo"     nombreKey="psicologo_nombre" telKey="psicologo_tel" form={form} setMany={setMany} />
                <div className="prof-section">
                  <div className="prof-section-header">
                    <span className="prof-label">TEO</span>
                    <SiNoToggle
                      value={form.tiene_teo}
                      onChange={v => setMany(v === 'NO'
                        ? { tiene_teo: 'NO', teo_nombre: '', teo_tel_contacto: '' }
                        : { tiene_teo: 'SI' }
                      )}
                    />
                  </div>
                  {form.tiene_teo === 'SI' && (
                    <div className="prof-section-fields">
                      <input className="panel-input" placeholder="Nombre" value={form.teo_nombre} onChange={e => set('teo_nombre', e.target.value)} />
                      <input className="panel-input" placeholder="Teléfono contacto" value={form.teo_tel_contacto} onChange={e => set('teo_tel_contacto', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {dialogNode}
    </div>
  );
}
