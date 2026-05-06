import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/http';
import { useAuth } from '../auth/AuthContext';

type Detail =
  | {
      kind: 'JIKKOPOINTS_REDEMPTION';
      redemptionType: string;
      jpAmount: number;
      benefitTierLabel: string | null;
      restKind: string | null;
    }
  | {
      kind: 'LEAVE_PERMISSION';
      leaveKindLabel: string;
      startDate: string;
      endDate: string;
      notes: string | null;
    }
  | {
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
  createdAt: string;
  reviewNote: string | null;
  detail: Detail | null;
};

const LEAVE_OPTIONS = [
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'STUDY', label: 'Estudio' },
  { value: 'MEDICAL_APPOINTMENT', label: 'Cita médica' },
  { value: 'FAMILY', label: 'Familia' },
  { value: 'OTHER', label: 'Otro' },
] as const;

/** yyyy-MM-dd en calendario local (para inputs type="date"). */
function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ymdTodayLocal(): string {
  const n = new Date();
  return toYmdLocal(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
}

function ymdMedicalMinLocal(): string {
  const t = new Date();
  const mid = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  mid.setDate(mid.getDate() - 30);
  return toYmdLocal(mid);
}

/** La fecha final no puede ser anterior a inicio ni al mínimo permitido. */
function endDateMin(start: string, floor: string): string {
  if (start && start >= floor) return start;
  return floor;
}

function rowTitle(r: Row): string {
  if (!r.detail) return r.category;
  if (r.detail.kind === 'JIKKOPOINTS_REDEMPTION') {
    return r.detail.redemptionType === 'BENEFIT'
      ? `Canje beneficio (${r.detail.jpAmount.toLocaleString('es-CO')} JP)`
      : `Canje descanso (${r.detail.jpAmount.toLocaleString('es-CO')} JP)`;
  }
  if (r.detail.kind === 'LEAVE_PERMISSION') return `Permiso · ${r.detail.leaveKindLabel}`;
  return 'Incapacidad médica';
}

export function MyRequests() {
  const { user, bumpJikkopoints } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'leave' | 'medical'>('list');

  const [leaveKind, setLeaveKind] = useState<string>('PERSONAL');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveNotes, setLeaveNotes] = useState('');
  const [leaveJust, setLeaveJust] = useState('');
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState<string | null>(null);

  const [medStart, setMedStart] = useState('');
  const [medEnd, setMedEnd] = useState('');
  const [medSummary, setMedSummary] = useState('');
  const [medJust, setMedJust] = useState('');
  const [medFile, setMedFile] = useState<File | null>(null);
  const [medBusy, setMedBusy] = useState(false);
  const [medMsg, setMedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const list = await api<Row[]>('/approvals/me');
    setRows(list);
  }, []);

  useEffect(() => {
    if (user?.roleCode !== 'ADMIN') {
      void load().catch((e) => setErr(e instanceof Error ? e.message : 'Error'));
    }
  }, [load, user?.roleCode]);

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    setLeaveMsg(null);
    const today = ymdTodayLocal();
    if (leaveStart < today || leaveEnd < today) {
      setLeaveMsg('Las fechas no pueden ser anteriores al día de hoy.');
      return;
    }
    if (leaveEnd < leaveStart) {
      setLeaveMsg('La fecha final debe ser igual o posterior a la inicial.');
      return;
    }
    setLeaveBusy(true);
    try {
      await api('/approvals/me/leave', {
        method: 'POST',
        body: JSON.stringify({
          leaveKind,
          startDate: leaveStart,
          endDate: leaveEnd,
          notes: leaveNotes.trim() || undefined,
          justification: leaveJust.trim(),
        }),
      });
      setLeaveMsg('Solicitud enviada. RR.HH. la revisará.');
      setLeaveJust('');
      setLeaveNotes('');
      await load();
      bumpJikkopoints();
      setTab('list');
    } catch (ex) {
      setLeaveMsg(ex instanceof Error ? ex.message : 'Error');
    } finally {
      setLeaveBusy(false);
    }
  }

  async function submitMedical(e: React.FormEvent) {
    e.preventDefault();
    if (!medFile) {
      setMedMsg('Adjunta el soporte médico (PDF o imagen).');
      return;
    }
    const medMin = ymdMedicalMinLocal();
    if (medStart < medMin || medEnd < medMin) {
      setMedMsg('Las fechas no pueden ser anteriores a hace 30 días.');
      return;
    }
    if (medEnd < medStart) {
      setMedMsg('La fecha final debe ser igual o posterior a la inicial.');
      return;
    }
    setMedMsg(null);
    setMedBusy(true);
    try {
      const fd = new FormData();
      fd.set('startDate', medStart);
      fd.set('endDate', medEnd);
      if (medSummary.trim()) fd.set('clinicalSummary', medSummary.trim());
      if (medJust.trim()) fd.set('justification', medJust.trim());
      fd.set('attachment', medFile);
      await api('/approvals/me/medical-leave', { method: 'POST', body: fd });
      setMedMsg('Reporte enviado. RR.HH. lo revisará.');
      setMedFile(null);
      setMedSummary('');
      setMedJust('');
      await load();
      bumpJikkopoints();
      setTab('list');
    } catch (ex) {
      setMedMsg(ex instanceof Error ? ex.message : 'Error');
    } finally {
      setMedBusy(false);
    }
  }

  if (user?.roleCode === 'ADMIN') {
    return (
      <div className="fm-page">
        <p className="fm-subtitle">
          Como administrador, usa la{' '}
          <Link to="/admin/aprobaciones">bandeja de aprobaciones</Link>. Esta página es para colaboradores.
        </p>
      </div>
    );
  }

  const leaveDateMin = ymdTodayLocal();
  const leaveEndMin = endDateMin(leaveStart, leaveDateMin);
  const medicalDateMin = ymdMedicalMinLocal();
  const medicalEndMin = endDateMin(medStart, medicalDateMin);

  return (
    <div className="fm-page">
      <header className="fm-head">
        <h1 className="fm-title">Mis solicitudes</h1>
        <p className="fm-subtitle">
          Trámites ante RR.HH.: permisos, incapacidades y seguimiento de tus canjes de jikkopuntos.
        </p>
      </header>

      <div
        className="fm-tabs"
        role="tablist"
        aria-label="Tipo de trámite"
        style={{ marginBottom: '1.25rem' }}
      >
        {(
          [
            ['list', 'Mis trámites'],
            ['leave', 'Nuevo permiso'],
            ['medical', 'Incapacidad'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`myreq-tab-${k}`}
            aria-selected={tab === k}
            aria-controls="myreq-panel"
            className={`fm-tab${tab === k ? ' is-active' : ''}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {err ? <p className="error">{err}</p> : null}

      <div role="tabpanel" id="myreq-panel" aria-labelledby={`myreq-tab-${tab}`}>
        {tab === 'list' ? (
        <section className="fm-panel">
          {!rows ? (
            <p className="muted">Cargando…</p>
          ) : rows.length === 0 ? (
            <p className="fm-subtitle" style={{ margin: 0 }}>
              Aún no tienes solicitudes registradas.
            </p>
          ) : (
            <ul className="redeem-queue-list">
              {rows.map((r) => (
                <li key={r.id} className="redeem-queue-card">
                  <div className="redeem-queue-main">
                    <p className="redeem-queue-title">
                      {rowTitle(r)}{' '}
                      <span className={`redeem-queue-status is-${r.status.toLowerCase()}`}>{r.status}</span>
                    </p>
                    {r.justification ? <p className="redeem-queue-just">{r.justification}</p> : null}
                    <p className="muted small">{new Date(r.createdAt).toLocaleString('es-CO')}</p>
                    {r.reviewNote ? <p className="muted small">Nota RR.HH.: {r.reviewNote}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'leave' ? (
        <section className="fm-panel">
          <form onSubmit={(e) => void submitLeave(e)} className="jp-admin-history-search">
            <p className="jp-admin-history-search-hint">
              Solicita permiso laboral. RR.HH. validará fechas y políticas internas. Las fechas solo pueden ser{' '}
              <strong>hoy o días futuros</strong>.
            </p>
            <div className="jp-admin-history-search-row" style={{ alignItems: 'stretch' }}>
              <label className="jp-admin-doc-field">
                <span className="jp-admin-doc-label-text">Tipo</span>
                <select
                  className="jp-admin-doc-input"
                  value={leaveKind}
                  onChange={(e) => setLeaveKind(e.target.value)}
                >
                  {LEAVE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="jp-admin-doc-field">
                <span className="jp-admin-doc-label-text">Desde</span>
                <input
                  className="jp-admin-doc-input"
                  type="date"
                  required
                  min={leaveDateMin}
                  value={leaveStart}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLeaveStart(v);
                    const endMin = endDateMin(v, leaveDateMin);
                    setLeaveEnd((prev) => (prev && prev < endMin ? endMin : prev));
                  }}
                />
              </label>
              <label className="jp-admin-doc-field">
                <span className="jp-admin-doc-label-text">Hasta</span>
                <input
                  className="jp-admin-doc-input"
                  type="date"
                  required
                  min={leaveEndMin}
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                />
              </label>
            </div>
            <label className="jp-admin-doc-field" style={{ marginTop: '0.75rem' }}>
              <span className="jp-admin-doc-label-text">Notas (opcional)</span>
              <textarea
                className="jp-admin-doc-input"
                rows={2}
                value={leaveNotes}
                onChange={(e) => setLeaveNotes(e.target.value)}
              />
            </label>
            <label className="jp-admin-doc-field" style={{ marginTop: '0.75rem' }}>
              <span className="jp-admin-doc-label-text">Motivo / justificación</span>
              <textarea
                className="jp-admin-doc-input"
                rows={3}
                required
                minLength={8}
                value={leaveJust}
                onChange={(e) => setLeaveJust(e.target.value)}
              />
            </label>
            {leaveMsg ? <p className="fm-subtitle">{leaveMsg}</p> : null}
            <button type="submit" className="jp-btn jp-btn--primary" disabled={leaveBusy} style={{ marginTop: '1rem' }}>
              {leaveBusy ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </form>
        </section>
      ) : null}

      {tab === 'medical' ? (
        <section className="fm-panel">
          <form onSubmit={(e) => void submitMedical(e)} className="jp-admin-history-search">
            <p className="jp-admin-history-search-hint">
              Carga el soporte médico (PDF o imagen). La información se revisará de forma confidencial. Puedes indicar
              fechas desde <strong>hace 30 días</strong> hasta el futuro, según el caso.
            </p>
            <div className="jp-admin-history-search-row">
              <label className="jp-admin-doc-field">
                <span className="jp-admin-doc-label-text">Inicio incapacidad</span>
                <input
                  className="jp-admin-doc-input"
                  type="date"
                  required
                  min={medicalDateMin}
                  value={medStart}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMedStart(v);
                    const endMin = endDateMin(v, medicalDateMin);
                    setMedEnd((prev) => (prev && prev < endMin ? endMin : prev));
                  }}
                />
              </label>
              <label className="jp-admin-doc-field">
                <span className="jp-admin-doc-label-text">Fin incapacidad</span>
                <input
                  className="jp-admin-doc-input"
                  type="date"
                  required
                  min={medicalEndMin}
                  value={medEnd}
                  onChange={(e) => setMedEnd(e.target.value)}
                />
              </label>
            </div>
            <label className="jp-admin-doc-field" style={{ marginTop: '0.75rem' }}>
              <span className="jp-admin-doc-label-text">Resumen clínico (opcional)</span>
              <textarea
                className="jp-admin-doc-input"
                rows={2}
                value={medSummary}
                onChange={(e) => setMedSummary(e.target.value)}
                placeholder="Ej. reposo médico por 5 días"
              />
            </label>
            <label className="jp-admin-doc-field" style={{ marginTop: '0.75rem' }}>
              <span className="jp-admin-doc-label-text">Comentarios adicionales (opcional)</span>
              <textarea
                className="jp-admin-doc-input"
                rows={2}
                value={medJust}
                onChange={(e) => setMedJust(e.target.value)}
              />
            </label>
            <label className="jp-admin-doc-field" style={{ marginTop: '0.75rem' }}>
              <span className="jp-admin-doc-label-text">Soporte (obligatorio)</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setMedFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {medMsg ? <p className="fm-subtitle">{medMsg}</p> : null}
            <button type="submit" className="jp-btn jp-btn--primary" disabled={medBusy} style={{ marginTop: '1rem' }}>
              {medBusy ? 'Enviando…' : 'Enviar incapacidad'}
            </button>
          </form>
        </section>
      ) : null}
      </div>
    </div>
  );
}
