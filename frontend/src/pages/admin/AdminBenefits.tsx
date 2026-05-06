import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/http';

type TierRow = {
  id: string;
  label: string;
  jp: number;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type ModalMode = 'create' | 'edit';

const emptyForm = {
  label: '',
  jp: '' as string | number,
  isPublished: true,
};

export function AdminBenefits() {
  const [rows, setRows] = useState<TierRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadBusy, setLoadBusy] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await api<TierRow[]>('/jikkopoints/admin/benefit-tiers');
    setRows(list);
  }, []);

  useEffect(() => {
    let c = false;
    setLoadBusy(true);
    setErr(null);
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (!c) setLoadBusy(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [load]);

  function openCreate() {
    setModalMode('create');
    setEditingId(null);
    setForm({ label: '', jp: '', isPublished: true });
    setErr(null);
    setModalOpen(true);
  }

  function openEdit(row: TierRow) {
    setModalMode('edit');
    setEditingId(row.id);
    setForm({
      label: row.label,
      jp: row.jp,
      isPublished: row.isPublished,
    });
    setErr(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saveBusy) return;
    setModalOpen(false);
    setEditingId(null);
  }

  async function submitModal() {
    const label = form.label.trim();
    const jpNum = typeof form.jp === 'string' ? parseInt(form.jp, 10) : form.jp;
    if (!label) {
      setErr('Indica el nombre del beneficio.');
      return;
    }
    if (!Number.isFinite(jpNum) || jpNum < 1) {
      setErr('La cantidad de jikkopuntos debe ser un número mayor o igual a 1.');
      return;
    }
    setSaveBusy(true);
    setErr(null);
    try {
      if (modalMode === 'create') {
        await api<TierRow>('/jikkopoints/admin/benefit-tiers', {
          method: 'POST',
          body: JSON.stringify({
            label,
            jp: jpNum,
            isPublished: form.isPublished,
          }),
        });
      } else if (editingId) {
        await api<TierRow>(`/jikkopoints/admin/benefit-tiers/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            label,
            jp: jpNum,
            isPublished: form.isPublished,
          }),
        });
      }
      await load();
      setModalOpen(false);
      setEditingId(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaveBusy(false);
    }
  }

  async function removeTier(row: TierRow) {
    if (
      !window.confirm(
        `¿Eliminar el beneficio «${row.label}»? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeleteBusyId(row.id);
    setErr(null);
    try {
      await api<{ ok: boolean }>(`/jikkopoints/admin/benefit-tiers/${row.id}`, {
        method: 'DELETE',
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleteBusyId(null);
    }
  }

  return (
    <div className="fm-admin-page">
      <header className="fm-head fm-head--row">
        <div className="fm-head-icon-wrap" aria-hidden>
          <svg className="fm-head-icon" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="8" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
            <path d="M12 8V22M3 12h18" stroke="currentColor" strokeWidth="1.75" />
            <path
              d="M12 8h-2a2 2 0 0 1 0-4c1.5 0 2 2 2 2s.5-2 2-2a2 2 0 0 1 0 4h-2z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="fm-head-text">
          <h1 className="fm-title">Mis beneficios — administración</h1>
          <p className="fm-subtitle">
            Crea y publica recompensas canjeables con jikkopuntos. Solo los beneficios publicados
            aparecen a los colaboradores. El umbral mínimo del módulo es el JP más bajo entre los
            publicados.
          </p>
        </div>
        <button type="button" className="fm-btn-primary" onClick={openCreate}>
          + Nuevo beneficio
        </button>
      </header>

      {err && !modalOpen ? <p className="error benef-admin-banner-err">{err}</p> : null}

      <section className="fm-panel">
        {loadBusy ? (
          <p className="fm-panel--loading muted">Cargando catálogo…</p>
        ) : !rows?.length ? (
          <p className="fm-subtitle" style={{ margin: 0 }}>
            Aún no hay beneficios. Usa <strong>Nuevo beneficio</strong> o ejecuta{' '}
            <code className="benef-admin-code">npx prisma db seed</code> en el backend para cargar el
            catálogo inicial. Los colaboradores ven la lista en{' '}
            <Link to="/beneficios">Mis beneficios</Link>.
          </p>
        ) : (
          <ul className="benef-admin-list">
            {rows.map((r) => (
              <li key={r.id} className="benef-admin-card">
                <div className="benef-admin-card-main">
                  <p className="benef-admin-card-title">{r.label}</p>
                  <p className="benef-admin-card-jp">{r.jp.toLocaleString('es-CO')} JP</p>
                  <span
                    className={`benef-admin-pill${r.isPublished ? ' is-live' : ' is-draft'}`}
                  >
                    {r.isPublished ? 'Publicado' : 'Borrador'}
                  </span>
                </div>
                <div className="benef-admin-card-actions">
                  <button
                    type="button"
                    className="fm-btn-secondary"
                    onClick={() => openEdit(r)}
                    disabled={deleteBusyId === r.id}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="fm-btn-danger"
                    onClick={() => void removeTier(r)}
                    disabled={deleteBusyId === r.id}
                  >
                    {deleteBusyId === r.id ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="fm-subtitle muted small" style={{ margin: 0 }}>
        Informe de saldos: <Link to="/admin/jikkopuntos">Jikkopuntos (informe)</Link>.
      </p>

      {modalOpen ? (
        <div className="jp-modal-root" role="presentation">
          <button type="button" className="jp-modal-backdrop" aria-label="Cerrar" onClick={closeModal} />
          <div className="jp-modal benef-admin-modal" role="dialog" aria-modal="true" aria-labelledby="benef-admin-modal-title">
            <header className="jp-modal-head">
              <h3 id="benef-admin-modal-title">
                {modalMode === 'create' ? 'Nuevo beneficio' : 'Editar beneficio'}
              </h3>
              <button type="button" className="jp-modal-close" disabled={saveBusy} onClick={closeModal} aria-label="Cerrar">
                ×
              </button>
            </header>
            <div className="jp-modal-body">
              {err && modalOpen ? <p className="error">{err}</p> : null}
              <label className="jp-modal-field">
                <span>Nombre del beneficio</span>
                <input
                  type="text"
                  className="jp-admin-redeem-input"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Ej. Kit de bienvenida"
                  autoComplete="off"
                />
              </label>
              <label className="jp-modal-field">
                <span>Cantidad de jikkopuntos</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="jp-admin-redeem-input"
                  value={form.jp === '' ? '' : form.jp}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({ ...f, jp: v === '' ? '' : parseInt(v, 10) || 0 }));
                  }}
                  placeholder="1000"
                />
              </label>
              <label className="benef-admin-check">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                />
                <span>Publicado (visible para colaboradores en «Mis beneficios»)</span>
              </label>
              <div className="jp-modal-actions">
                <button type="button" className="jp-btn jp-btn--ghost" disabled={saveBusy} onClick={closeModal}>
                  Cancelar
                </button>
                <button type="button" className="jp-btn jp-btn--primary" disabled={saveBusy} onClick={() => void submitModal()}>
                  {saveBusy ? 'Guardando…' : modalMode === 'create' ? 'Crear beneficio' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
