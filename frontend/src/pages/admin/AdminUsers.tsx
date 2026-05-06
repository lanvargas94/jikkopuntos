import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api/http';

type CollaboratorRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  idIssueDate: string;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  role: { code: string };
  profile: { jobTitle: string | null; area: string | null } | null;
};

type ListResponse = {
  items: CollaboratorRow[];
  total: number;
  skip: number;
  take: number;
};

function buildQuery(params: Record<string, string | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      u.set(k, v);
    }
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

function formatIngreso(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function initials(first: string, last: string) {
  const a = (first[0] ?? '').toUpperCase();
  const b = (last[0] ?? '').toUpperCase();
  return `${a}${b}` || '?';
}

function roleLabel(code: string) {
  if (code === 'COLLABORATOR') return 'Colaborador';
  if (code === 'ADMIN') return 'Administrador';
  return code;
}

function pageWindow(page: number, pageMax: number): number[] {
  if (pageMax < 0) return [0];
  const span = 5;
  let start = Math.max(0, page - Math.floor(span / 2));
  let end = Math.min(pageMax, start + span - 1);
  start = Math.max(0, end - span + 1);
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

export function AdminUsers() {
  const [list, setList] = useState<CollaboratorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listBusy, setListBusy] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);

  const [kpiTotal, setKpiTotal] = useState<number | null>(null);
  const [kpiActive, setKpiActive] = useState<number | null>(null);
  const [kpiInactive, setKpiInactive] = useState<number | null>(null);
  const [kpiBusy, setKpiBusy] = useState(true);

  const [draftQ, setDraftQ] = useState('');
  const [draftArea, setDraftArea] = useState('');
  const [draftActive, setDraftActive] = useState<'all' | 'true' | 'false'>('all');
  const [applied, setApplied] = useState<{
    q: string;
    area: string;
    active: 'all' | 'true' | 'false';
  }>({ q: '', area: '', active: 'all' });
  const [skip, setSkip] = useState(0);
  const take = 25;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [autoPassword, setAutoPassword] = useState(true);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idIssueDate, setIdIssueDate] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [area, setArea] = useState('');
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [lastGeneratedPassword, setLastGeneratedPassword] = useState<string | null>(
    null,
  );
  const [createBusy, setCreateBusy] = useState(false);

  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const loadKpis = useCallback(async () => {
    setKpiBusy(true);
    try {
      const [all, act, inact] = await Promise.all([
        api<ListResponse>('/users/collaborators?skip=0&take=1'),
        api<ListResponse>('/users/collaborators?skip=0&take=1&isActive=true'),
        api<ListResponse>('/users/collaborators?skip=0&take=1&isActive=false'),
      ]);
      setKpiTotal(all.total);
      setKpiActive(act.total);
      setKpiInactive(inact.total);
    } catch {
      setKpiTotal(null);
      setKpiActive(null);
      setKpiInactive(null);
    } finally {
      setKpiBusy(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    setListErr(null);
    setListBusy(true);
    try {
      const qs = buildQuery({
        q: applied.q || undefined,
        area: applied.area || undefined,
        isActive: applied.active === 'all' ? undefined : applied.active,
        skip: String(skip),
        take: String(take),
      });
      const res = await api<ListResponse>(`/users/collaborators${qs}`);
      setList(res.items);
      setTotal(res.total);
    } catch (e) {
      setListErr(e instanceof Error ? e.message : 'Error');
      setList([]);
      setTotal(0);
    } finally {
      setListBusy(false);
    }
  }, [applied, skip, take]);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!createOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCreateOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createOpen]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    setCreateMsg(null);
    setLastGeneratedPassword(null);
    setCreateBusy(true);
    try {
      const body: Record<string, unknown> = {
        email,
        firstName,
        lastName,
        idNumber,
        idIssueDate,
      };
      if (jobTitle.trim()) {
        body.jobTitle = jobTitle.trim();
      }
      if (area.trim()) {
        body.area = area.trim();
      }
      if (!autoPassword) {
        body.temporaryPassword = temporaryPassword;
      }
      const created = await api<CollaboratorRow & { temporaryPasswordPlain?: string }>(
        '/users/collaborators',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );
      if (created.temporaryPasswordPlain) {
        setLastGeneratedPassword(created.temporaryPasswordPlain);
        setCreateMsg(
          'Colaborador creado. Copia la contraseña temporal generada; no se volverá a mostrar.',
        );
      } else {
        setCreateMsg(
          'Colaborador creado con la contraseña temporal indicada. Debe iniciar sesión y cambiar la clave.',
        );
      }
      setEmail('');
      setTemporaryPassword('');
      setFirstName('');
      setLastName('');
      setIdNumber('');
      setIdIssueDate('');
      setJobTitle('');
      setArea('');
      await loadList();
      await loadKpis();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setCreateBusy(false);
    }
  }

  async function toggleActive(row: CollaboratorRow) {
    setRowBusyId(row.id);
    setListErr(null);
    try {
      await api(`/users/collaborators/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await loadList();
      await loadKpis();
    } catch (e) {
      setListErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setRowBusyId(null);
    }
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setApplied({
      q: draftQ.trim(),
      area: draftArea.trim(),
      active: draftActive,
    });
    setSkip(0);
  }

  function setStatusTab(next: 'all' | 'true' | 'false') {
    setDraftActive(next);
    setApplied({
      q: draftQ.trim(),
      area: draftArea.trim(),
      active: next,
    });
    setSkip(0);
  }

  const pageMax = Math.max(0, Math.ceil(total / take) - 1);
  const page = Math.min(Math.floor(skip / take), pageMax);
  const pages = pageWindow(page, pageMax);
  const rangeFrom = total === 0 ? 0 : skip + 1;
  const rangeTo = skip + list.length;

  function goPage(p: number) {
    setSkip(Math.max(0, Math.min(p, pageMax)) * take);
  }

  return (
    <div className="fm-page au-page">
      <header className="au-header">
        <div className="au-header-text">
          <h1 className="au-title">Gestión de colaboradores</h1>
          <p className="au-subtitle">
            Administra el acceso y la información de todo el equipo Jikkosoft.
          </p>
        </div>
        <button type="button" className="au-btn-create" onClick={() => setCreateOpen(true)}>
          <span className="au-btn-create-icon" aria-hidden>
            +
          </span>
          Crear colaborador
        </button>
      </header>

      <div className="au-kpi-row">
        <div className="au-kpi-card">
          <div className="au-kpi-icon-wrap au-kpi-icon--total">
            <svg className="au-kpi-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="au-kpi-label">Total colaboradores</p>
            <p className="au-kpi-value">{kpiBusy ? '—' : (kpiTotal ?? '—')}</p>
          </div>
        </div>
        <div className="au-kpi-card">
          <div className="au-kpi-icon-wrap au-kpi-icon--active">
            <svg className="au-kpi-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
              <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="au-kpi-label">Activos</p>
            <p className="au-kpi-value">{kpiBusy ? '—' : (kpiActive ?? '—')}</p>
          </div>
        </div>
        <div className="au-kpi-card">
          <div className="au-kpi-icon-wrap au-kpi-icon--inactive">
            <svg className="au-kpi-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
              <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="au-kpi-label">Inactivos</p>
            <p className="au-kpi-value">{kpiBusy ? '—' : (kpiInactive ?? '—')}</p>
          </div>
        </div>
      </div>

      <section className="au-panel" aria-labelledby="au-table-title">
        <div className="au-toolbar">
          <form className="au-search" onSubmit={onSearchSubmit}>
            <svg className="au-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.75" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            <input
              className="au-search-input"
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="Buscar por nombre, email o documento…"
              aria-label="Buscar colaboradores"
            />
          </form>
          <div className="au-toolbar-right">
            <div className="fm-tabs" role="tablist" aria-label="Filtrar por estado">
              <button
                type="button"
                role="tab"
                id="au-users-tab-all"
                aria-selected={draftActive === 'all'}
                aria-controls="au-users-table-panel"
                className={`fm-tab${draftActive === 'all' ? ' is-active' : ''}`}
                onClick={() => setStatusTab('all')}
              >
                Todos
              </button>
              <button
                type="button"
                role="tab"
                id="au-users-tab-active"
                aria-selected={draftActive === 'true'}
                aria-controls="au-users-table-panel"
                className={`fm-tab${draftActive === 'true' ? ' is-active' : ''}`}
                onClick={() => setStatusTab('true')}
              >
                Activos
              </button>
              <button
                type="button"
                role="tab"
                id="au-users-tab-inactive"
                aria-selected={draftActive === 'false'}
                aria-controls="au-users-table-panel"
                className={`fm-tab${draftActive === 'false' ? ' is-active' : ''}`}
                onClick={() => setStatusTab('false')}
              >
                Inactivos
              </button>
            </div>
            <button
              type="button"
              className={`au-icon-btn${filtersOpen ? ' is-on' : ''}`}
              aria-expanded={filtersOpen}
              title="Más filtros"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <svg className="au-icon-btn-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {filtersOpen ? (
          <form className="au-filter-panel" onSubmit={onSearchSubmit}>
            <label className="au-filter-field">
              <span>Área (contiene)</span>
              <input
                value={draftArea}
                onChange={(e) => setDraftArea(e.target.value)}
                placeholder="Ej. Tecnología"
              />
            </label>
            <button type="submit" className="au-btn-secondary">
              Aplicar búsqueda
            </button>
          </form>
        ) : null}

        <div
          role="tabpanel"
          id="au-users-table-panel"
          aria-labelledby={
            draftActive === 'all'
              ? 'au-users-tab-all'
              : draftActive === 'true'
                ? 'au-users-tab-active'
                : 'au-users-tab-inactive'
          }
        >
          {listErr && <p className="error au-panel-err">{listErr}</p>}

          <h2 id="au-table-title" className="sr-only">
            Listado de colaboradores
          </h2>
          <div className="au-table-wrap">
          <table className="au-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Rol y departamento</th>
                <th>Fecha ingreso</th>
                <th>Estado</th>
                <th className="au-th-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listBusy ? (
                <tr>
                  <td colSpan={5} className="au-td-empty">
                    Cargando…
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="au-td-empty">
                    No hay resultados.
                  </td>
                </tr>
              ) : (
                list.map((row) => {
                  const title = row.profile?.jobTitle?.trim() || roleLabel(row.role.code);
                  const dept = row.profile?.area?.trim() || '—';
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="au-cell-user">
                          <div className="au-avatar" aria-hidden>
                            {initials(row.firstName, row.lastName)}
                          </div>
                          <div>
                            <div className="au-user-name">
                              {row.firstName} {row.lastName}
                            </div>
                            <div className="au-user-email">{row.email}</div>
                            {row.mustChangePassword ? (
                              <div className="au-user-hint">Debe cambiar contraseña</div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="au-role-title">{title}</div>
                        <div className="au-role-dept">{dept}</div>
                      </td>
                      <td className="au-td-date">{formatIngreso(row.createdAt)}</td>
                      <td>
                        <span className={row.isActive ? 'au-badge au-badge--on' : 'au-badge au-badge--off'}>
                          <span className="au-badge-dot" aria-hidden />
                          {row.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="au-action-link"
                          disabled={rowBusyId === row.id}
                          onClick={() => void toggleActive(row)}
                        >
                          {rowBusyId === row.id
                            ? '…'
                            : row.isActive
                              ? 'Inactivar'
                              : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="au-pagination">
          <p className="au-pagination-info muted small">
            Mostrando {rangeFrom}–{rangeTo} de {total} colaborador{total !== 1 ? 'es' : ''}
          </p>
          <div className="au-pagination-controls">
            <button
              type="button"
              className="au-page-btn"
              disabled={skip <= 0 || listBusy}
              onClick={() => setSkip((s) => Math.max(0, s - take))}
            >
              Anterior
            </button>
            <div className="au-page-nums" role="navigation" aria-label="Páginas">
              {pages.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`au-page-num${p === page ? ' is-current' : ''}`}
                  onClick={() => goPage(p)}
                  disabled={listBusy}
                >
                  {p + 1}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="au-page-btn"
              disabled={skip + take >= total || listBusy}
              onClick={() => setSkip((s) => s + take)}
            >
              Siguiente
            </button>
          </div>
        </footer>
        </div>
      </section>

      {createOpen ? (
        <div
          className="au-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <div
            className="au-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="au-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="au-modal-head">
              <h2 id="au-modal-title" className="au-modal-title">
                Nuevo colaborador
              </h2>
              <button
                type="button"
                className="au-modal-close"
                aria-label="Cerrar"
                onClick={() => setCreateOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="au-modal-hint muted small">
              Rol <code>COLLABORATOR</code>. Si no indicas contraseña, el sistema genera una temporal
              y la muestra una sola vez.
            </p>
            <form onSubmit={onCreate} className="au-modal-form stack">
              <div className="grid-2">
                <label>
                  Nombres *
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Apellidos *
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="grid-2">
                <label>
                  Número de identificación *
                  <input
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Fecha de expedición del documento *
                  <input
                    type="date"
                    value={idIssueDate}
                    onChange={(e) => setIdIssueDate(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label>
                Correo corporativo (acceso) *
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <div className="grid-2">
                <label>
                  Cargo o rol en Jikkosoft
                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Opcional"
                  />
                </label>
                <label>
                  Área
                  <input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Opcional"
                  />
                </label>
              </div>
              <label className="row-between" style={{ alignItems: 'center' }}>
                <span>Generar contraseña temporal automáticamente</span>
                <input
                  type="checkbox"
                  checked={autoPassword}
                  onChange={(e) => setAutoPassword(e.target.checked)}
                />
              </label>
              {!autoPassword ? (
                <label>
                  Contraseña temporal (mín. 8) *
                  <input
                    type="text"
                    autoComplete="new-password"
                    value={temporaryPassword}
                    onChange={(e) => setTemporaryPassword(e.target.value)}
                    minLength={8}
                    required={!autoPassword}
                  />
                </label>
              ) : null}
              {lastGeneratedPassword ? (
                <div className="readonly-block">
                  <strong>Contraseña temporal</strong>
                  <p style={{ margin: '0.35rem 0', fontFamily: 'monospace' }}>
                    {lastGeneratedPassword}
                  </p>
                  <p className="small muted">Guárdala ahora; no se puede recuperar desde esta pantalla.</p>
                </div>
              ) : null}
              {createMsg && <p className="success">{createMsg}</p>}
              {createErr && <p className="error">{createErr}</p>}
              <div className="au-modal-actions">
                <button type="button" className="au-btn-secondary" onClick={() => setCreateOpen(false)}>
                  Cerrar
                </button>
                <button type="submit" className="au-btn-create au-btn-create--inline" disabled={createBusy}>
                  {createBusy ? 'Creando…' : 'Crear colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
