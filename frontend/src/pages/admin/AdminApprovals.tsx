import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/http';

type UserMini = { id: string; firstName: string; lastName: string; email: string };
type UserMiniNoEmail = { id: string; firstName: string; lastName: string };

type JpDetail = {
  kind: 'JIKKOPOINTS_REDEMPTION';
  redemptionType: string;
  jpAmount: number;
  benefitTierId: string | null;
  benefitTierLabel: string | null;
  restKind: string | null;
  ledgerTransactionId: string | null;
};

type LeaveDetail = {
  kind: 'LEAVE_PERMISSION';
  leaveKind: string;
  leaveKindLabel: string;
  startDate: string;
  endDate: string;
  notes: string | null;
};

type MedicalDetail = {
  kind: 'MEDICAL_LEAVE';
  startDate: string;
  endDate: string;
  clinicalSummary: string | null;
};

type Row = {
  id: string;
  category: string;
  status: string;
  justification: string | null;
  attachmentPath: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  targetUser: UserMini;
  requestedBy: UserMiniNoEmail & { email?: string };
  detail: JpDetail | LeaveDetail | MedicalDetail | null;
};

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'JIKKOPOINTS_REDEMPTION', label: 'Jikkopuntos' },
  { value: 'LEAVE_PERMISSION', label: 'Permisos' },
  { value: 'MEDICAL_LEAVE', label: 'Incapacidades' },
] as const;

function titleForRow(r: Row): string {
  if (!r.detail) return r.category;
  if (r.detail.kind === 'JIKKOPOINTS_REDEMPTION') {
    return r.detail.redemptionType === 'BENEFIT'
      ? `Canje beneficio · ${r.detail.jpAmount.toLocaleString('es-CO')} JP`
      : `Canje descanso · ${r.detail.jpAmount.toLocaleString('es-CO')} JP`;
  }
  if (r.detail.kind === 'LEAVE_PERMISSION') {
    return `Permiso · ${r.detail.leaveKindLabel}`;
  }
  return 'Incapacidad médica';
}

function subtitleForRow(r: Row): string | null {
  if (!r.detail) return null;
  if (r.detail.kind === 'JIKKOPOINTS_REDEMPTION' && r.detail.redemptionType === 'BENEFIT') {
    return r.detail.benefitTierLabel ? `«${r.detail.benefitTierLabel}»` : null;
  }
  if (r.detail.kind === 'LEAVE_PERMISSION' || r.detail.kind === 'MEDICAL_LEAVE') {
    const a = new Date(r.detail.startDate).toLocaleDateString('es-CO');
    const b = new Date(r.detail.endDate).toLocaleDateString('es-CO');
    return `${a} — ${b}`;
  }
  return null;
}

export function AdminApprovals() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [category, setCategory] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (filter === 'PENDING') q.set('status', 'PENDING');
    if (category) q.set('category', category);
    const list = await api<Row[]>(`/approvals/admin?${q.toString()}`);
    setRows(list);
  }, [filter, category]);

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

  async function approve(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      await api(`/approvals/admin/${id}/approve`, { method: 'POST', body: '{}' });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      await api(`/approvals/admin/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: rejectNote[id]?.trim() || undefined }),
      });
      setRejectNote((m) => ({ ...m, [id]: '' }));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fm-admin-page">
      <header className="fm-head fm-head--row">
        <div className="fm-head-text">
          <h1 className="fm-title">Aprobaciones RR.HH.</h1>
          <p className="fm-subtitle">
            Bandeja unificada: canjes de jikkopuntos, permisos e incapacidades. Otro administrador debe resolver lo que
            registraste tú (salvo{' '}
            <code className="benef-admin-code">REDEMPTION_ALLOW_SELF_APPROVE=1</code> en servidor de pruebas).
          </p>
        </div>
        <div className="fm-tabs" role="tablist" aria-label="Vista de aprobaciones">
          {(['PENDING', 'ALL'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              id={`approvals-tab-${f.toLowerCase()}`}
              aria-selected={filter === f}
              aria-controls="approvals-panel"
              className={`fm-tab${filter === f ? ' is-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'PENDING' ? 'Pendientes' : 'Historial'}
            </button>
          ))}
        </div>
      </header>

      <div className="fm-toolbar-row" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <label className="jp-filter-label" style={{ margin: 0 }}>
          <span>Módulo</span>
          <select
            className="jp-filter-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filtrar por tipo de solicitud"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {err ? <p className="error">{err}</p> : null}

      <section
        className="fm-panel"
        role="tabpanel"
        id="approvals-panel"
        aria-labelledby={filter === 'PENDING' ? 'approvals-tab-pending' : 'approvals-tab-all'}
      >
        {!rows ? (
          <p className="muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="fm-subtitle" style={{ margin: 0 }}>
            No hay solicitudes {filter === 'PENDING' ? 'pendientes' : ''}
            {category ? ' en este módulo' : ''}.
          </p>
        ) : (
          <ul className="redeem-queue-list">
            {rows.map((r) => (
              <li key={r.id} className="redeem-queue-card">
                <div className="redeem-queue-main">
                  <p className="redeem-queue-title">
                    {titleForRow(r)}{' '}
                    <span className={`redeem-queue-status is-${r.status.toLowerCase()}`}>{r.status}</span>
                  </p>
                  {subtitleForRow(r) ? (
                    <p className="redeem-queue-meta muted small">{subtitleForRow(r)}</p>
                  ) : null}
                  <p className="redeem-queue-meta muted small">
                    Colaborador:{' '}
                    <strong>
                      {r.targetUser.firstName} {r.targetUser.lastName}
                    </strong>{' '}
                    · Solicita:{' '}
                    <strong>
                      {r.requestedBy.firstName} {r.requestedBy.lastName}
                    </strong>
                  </p>
                  {r.justification ? <p className="redeem-queue-just">{r.justification}</p> : null}
                  {r.detail?.kind === 'LEAVE_PERMISSION' && r.detail.notes ? (
                    <p className="muted small">Notas: {r.detail.notes}</p>
                  ) : null}
                  {r.detail?.kind === 'MEDICAL_LEAVE' && r.detail.clinicalSummary ? (
                    <p className="muted small">Resumen clínico: {r.detail.clinicalSummary}</p>
                  ) : null}
                  <p className="muted small">
                    {new Date(r.createdAt).toLocaleString('es-CO')}
                    {r.reviewNote ? ` · Nota: ${r.reviewNote}` : ''}
                  </p>
                </div>
                {r.status === 'PENDING' ? (
                  <div className="redeem-queue-actions">
                    <button
                      type="button"
                      className="fm-btn-primary"
                      disabled={busyId === r.id}
                      onClick={() => void approve(r.id)}
                    >
                      Aprobar
                    </button>
                    <label className="redeem-queue-reject">
                      <span className="muted small">Motivo rechazo (opcional)</span>
                      <input
                        type="text"
                        className="jp-admin-redeem-input"
                        value={rejectNote[r.id] ?? ''}
                        onChange={(e) => setRejectNote((m) => ({ ...m, [r.id]: e.target.value }))}
                        placeholder="Ej. documentación incompleta"
                      />
                    </label>
                    <button
                      type="button"
                      className="fm-btn-danger"
                      disabled={busyId === r.id}
                      onClick={() => void reject(r.id)}
                    >
                      Rechazar
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="fm-subtitle muted small">
        <Link to="/jikkopuntos">← Jikkopuntos</Link>
      </p>
    </div>
  );
}
