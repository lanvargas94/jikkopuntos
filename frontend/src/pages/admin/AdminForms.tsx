import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/http';

type FormStatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'CLOSED';

type Row = {
  id: string;
  title: string;
  status: string;
  shareToken: string | null;
  publicSlug: string | null;
  pointsReward: number;
  updatedAt: string;
  publishedAt?: string | null;
  closedAt?: string | null;
  _count: { responses: number; questions: number };
};

function publicFormPath(r: Row) {
  return r.publicSlug ?? r.shareToken ?? '';
}

function statusLabel(s: string) {
  switch (s) {
    case 'DRAFT':
      return 'Borrador';
    case 'PUBLISHED':
      return 'Publicado';
    case 'CLOSED':
      return 'Cerrado';
    default:
      return s;
  }
}

function statusPillClass(s: string) {
  switch (s) {
    case 'PUBLISHED':
      return 'fm-pill fm-pill--ok';
    case 'DRAFT':
      return 'fm-pill fm-pill--draft';
    case 'CLOSED':
      return 'fm-pill fm-pill--muted';
    default:
      return 'fm-pill fm-pill--muted';
  }
}

export function AdminForms() {
  const [filter, setFilter] = useState<FormStatusFilter>('ALL');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q =
      filter === 'ALL' ? '' : `?status=${encodeURIComponent(filter)}`;
    const res = await api<Row[]>(`/forms/definitions${q}`);
    setRows(res);
  }, [filter]);

  useEffect(() => {
    let c = false;
    setErr(null);
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      c = true;
    };
  }, [load]);

  async function publish(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await api<{
        shareToken: string;
        relativePath: string;
        publicSlug?: string | null;
      }>(`/forms/definitions/${id}/publish`, { method: 'POST' });
      const full = `${window.location.origin}${res.relativePath}`;
      await navigator.clipboard.writeText(full);
      alert(`Publicado. Enlace copiado:\n${full}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  async function closeForm(id: string) {
    if (!window.confirm('¿Cerrar el formulario? No aceptará nuevas respuestas.')) {
      return;
    }
    setBusyId(id);
    setErr(null);
    try {
      await api(`/forms/definitions/${id}/close`, { method: 'POST' });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  async function unpublishForm(id: string) {
    if (
      !window.confirm(
        '¿Despublicar? Volverá a borrador, se quitará el enlace público y podrás editarlo de nuevo.',
      )
    ) {
      return;
    }
    setBusyId(id);
    setErr(null);
    try {
      await api(`/forms/definitions/${id}/unpublish`, { method: 'POST' });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateForm(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const copy = await api<{ id: string }>(
        `/forms/definitions/${id}/duplicate`,
        { method: 'POST' },
      );
      await load();
      window.location.assign(`/admin/formularios/${copy.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  if (err && !rows) {
    return (
      <div className="fm-admin-page">
        <div className="fm-panel fm-panel--error">{err}</div>
      </div>
    );
  }
  if (!rows) {
    return (
      <div className="fm-admin-page">
        <div className="fm-panel fm-panel--loading">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="fm-admin-page">
      <header className="fm-admin-head">
        <div>
          <h1 className="fm-title">Formularios</h1>
          <p className="fm-subtitle">
            Crea, publica y gestiona formularios del portal. Los enlaces públicos se generan al
            publicar.
          </p>
        </div>
        <Link to="/admin/formularios/nuevo" className="fm-btn-primary">
          + Nuevo formulario
        </Link>
      </header>

      <section className="fm-panel">
        <div className="fm-toolbar">
          <span className="fm-toolbar-label">Estado</span>
          <div className="fm-tabs" role="tablist" aria-label="Estado del formulario">
            {(
              [
                ['ALL', 'Todos'],
                ['DRAFT', 'Borrador'],
                ['PUBLISHED', 'Publicado'],
                ['CLOSED', 'Cerrado'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`admin-forms-tab-${value.toLowerCase()}`}
                aria-selected={filter === value}
                aria-controls="admin-forms-table-panel"
                className={`fm-tab${filter === value ? ' is-active' : ''}`}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          role="tabpanel"
          id="admin-forms-table-panel"
          aria-labelledby={`admin-forms-tab-${filter.toLowerCase()}`}
        >
          {err && <p className="error fm-panel-err">{err}</p>}

          <div className="fm-table-wrap">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Estado</th>
                <th>Preguntas</th>
                <th>Respuestas</th>
                <th>Puntos</th>
                <th className="fm-th-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="fm-td-title">{r.title}</td>
                  <td>
                    <span className={statusPillClass(r.status)}>{statusLabel(r.status)}</span>
                  </td>
                  <td>{r._count.questions}</td>
                  <td>{r._count.responses}</td>
                  <td>{r.pointsReward}</td>
                  <td className="fm-td-actions">
                    <div className="fm-actions">
                      {r.status === 'DRAFT' && (
                        <>
                          <Link to={`/admin/formularios/${r.id}`} className="fm-link">
                            Editar
                          </Link>
                          <button
                            type="button"
                            className="fm-link"
                            disabled={busyId === r.id}
                            onClick={() => publish(r.id)}
                          >
                            Publicar
                          </button>
                        </>
                      )}
                      {r.status === 'PUBLISHED' && (r.shareToken || r.publicSlug) && (
                        <>
                          <Link
                            to={`/forms/${encodeURIComponent(publicFormPath(r))}`}
                            className="fm-link"
                          >
                            Abrir
                          </Link>
                          <button
                            type="button"
                            className="fm-link"
                            onClick={() =>
                              navigator.clipboard.writeText(
                                `${window.location.origin}/forms/${encodeURIComponent(publicFormPath(r))}`,
                              )
                            }
                          >
                            Copiar enlace
                          </button>
                          <button
                            type="button"
                            className="fm-link"
                            disabled={busyId === r.id}
                            onClick={() => closeForm(r.id)}
                          >
                            Cerrar
                          </button>
                          <button
                            type="button"
                            className="fm-link"
                            disabled={busyId === r.id}
                            onClick={() => unpublishForm(r.id)}
                          >
                            Despublicar
                          </button>
                        </>
                      )}
                      {r.status === 'CLOSED' && (
                        <>
                          <span className="fm-hint" title="El enlace público muestra que está cerrado">
                            Enlace (cerrado)
                          </span>
                          {(r.shareToken || r.publicSlug) && (
                            <button
                              type="button"
                              className="fm-link"
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/forms/${encodeURIComponent(publicFormPath(r))}`,
                                )
                              }
                            >
                              Copiar enlace
                            </button>
                          )}
                          <button
                            type="button"
                            className="fm-link"
                            disabled={busyId === r.id}
                            onClick={() => unpublishForm(r.id)}
                          >
                            Despublicar
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="fm-link"
                        disabled={busyId === r.id}
                        onClick={() => duplicateForm(r.id)}
                      >
                        Duplicar
                      </button>
                      <Link to={`/admin/formularios/${r.id}/respuestas`} className="fm-link">
                        Respuestas
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </div>
  );
}
