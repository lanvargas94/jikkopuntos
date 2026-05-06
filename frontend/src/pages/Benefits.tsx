import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/http';
import { useAuth } from '../auth/AuthContext';

type BalanceRes = {
  balance: number;
  strategy: string;
  cachedBalance: number;
  cacheRepaired: boolean;
  inSync: boolean;
};

type TierRow = { id: string; jp: number; label: string };

type BenefitMeta = {
  minJpToUnlock: number;
  tiers: TierRow[];
};

export function Benefits() {
  const { user, bumpJikkopoints } = useAuth();
  const [meta, setMeta] = useState<BenefitMeta | null>(null);
  const [balance, setBalance] = useState<BalanceRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalTier, setModalTier] = useState<TierRow | null>(null);
  const [justification, setJustification] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [b, m] = await Promise.all([
        api<BalanceRes>('/jikkopoints/me/balance'),
        api<BenefitMeta>('/jikkopoints/me/benefit-rewards'),
      ]);
      setBalance(b);
      setMeta(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (user?.roleCode === 'ADMIN') {
    return <Navigate to="/admin/beneficios" replace />;
  }

  async function submitRedeem() {
    if (!modalTier || !file) return;
    if (justification.trim().length < 10) {
      setSaveErr('Los comentarios deben tener al menos 10 caracteres.');
      return;
    }
    setSaveErr(null);
    setSaveBusy(true);
    try {
      const fd = new FormData();
      fd.set('tierId', modalTier.id);
      fd.set('justification', justification.trim());
      fd.set('attachment', file);
      const res = await api<
        | { newBalance: number; debitedJp: number; tierId: string }
        | { requestId: string; status: string; tierId: string; jp: number }
      >('/jikkopoints/me/redeem-benefit', { method: 'POST', body: fd });
      if ('requestId' in res && res.status === 'PENDING') {
        setSaveOk(
          `Solicitud enviada (${res.jp.toLocaleString('es-CO')} JP). RR.HH. la revisará; aún no se descuenta tu saldo.`,
        );
      } else if ('newBalance' in res) {
        setSaveOk(
          `Canje registrado. Se descontaron ${res.debitedJp.toLocaleString('es-CO')} JP. Tu nuevo saldo es ${res.newBalance.toLocaleString('es-CO')} JP.`,
        );
        setBalance((prev) =>
          prev ? { ...prev, balance: res.newBalance, inSync: true, cacheRepaired: false } : prev,
        );
        bumpJikkopoints();
      }
      setTimeout(() => {
        setModalTier(null);
        setJustification('');
        setFile(null);
        setSaveOk(null);
        void load();
      }, 2400);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaveBusy(false);
    }
  }

  function closeModal() {
    if (saveBusy) return;
    setModalTier(null);
    setJustification('');
    setFile(null);
    setSaveErr(null);
    setSaveOk(null);
  }

  if (loading) {
    return (
      <div className="fm-page">
        <div className="fm-panel fm-panel--loading">Cargando beneficios…</div>
      </div>
    );
  }
  if (err || !meta || !balance) {
    return (
      <div className="fm-page">
        <div className="fm-panel fm-panel--error">{err ?? 'No se pudo cargar.'}</div>
      </div>
    );
  }

  const unlocked = balance.balance >= meta.minJpToUnlock;

  return (
    <div className="fm-page benefits-page">
      <header className="fm-head">
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
        <div>
          <h1 className="fm-title">Mis beneficios</h1>
          <p className="fm-subtitle">
            Canjea recompensas alineadas a tus jikkopuntos. Necesitas al menos{' '}
            <strong>{meta.minJpToUnlock.toLocaleString('es-CO')} JP</strong> para habilitar el canje.
            Cada recompensa descuenta los JP indicados. Debes adjuntar el <strong>PDF de autorización de tu jefe</strong>{' '}
            para el día de descanso o beneficio solicitado.
          </p>
        </div>
      </header>

      {!unlocked ? (
        <div className="fm-panel benefits-locked" role="status">
          <p className="benefits-locked-title">Módulo bloqueado</p>
          <p className="fm-subtitle" style={{ margin: 0 }}>
            Tu saldo actual es <strong>{balance.balance.toLocaleString('es-CO')} JP</strong>. Cuando llegues a{' '}
            <strong>{meta.minJpToUnlock.toLocaleString('es-CO')} JP</strong> podrás elegir recompensa y redimir
            jikkopuntos.
          </p>
        </div>
      ) : null}

      <section className="fm-panel" aria-label="Catálogo de recompensas">
        <h2 className="benefits-section-title">Recompensas por nivel de JP</h2>
        {meta.tiers.length === 0 ? (
          <p className="fm-subtitle" style={{ margin: 0 }}>
            Aún no hay recompensas publicadas. Un administrador puede crearlas en{' '}
            <strong>Mis beneficios</strong> (menú Administración).
          </p>
        ) : null}
        <ul className="benefits-tier-list">
          {meta.tiers.map((t) => {
            const eligible = balance.balance >= t.jp;
            return (
              <li
                key={t.id}
                className={`benefits-tier-card${eligible && unlocked ? ' is-eligible' : ' is-locked'}`}
              >
                <div className="benefits-tier-main">
                  <p className="benefits-tier-label">{t.label}</p>
                  <p className="benefits-tier-jp">{t.jp.toLocaleString('es-CO')} JP</p>
                </div>
                {eligible && unlocked ? (
                  <button
                    type="button"
                    className="jp-btn jp-btn--primary"
                    onClick={() => {
                      setModalTier(t);
                      setJustification('');
                      setFile(null);
                      setSaveErr(null);
                      setSaveOk(null);
                    }}
                  >
                    Elegir y redimir
                  </button>
                ) : (
                  <span className="benefits-tier-lock muted small">
                    {unlocked ? `Necesitas ${t.jp.toLocaleString('es-CO')} JP` : 'Aún no disponible'}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {modalTier ? (
        <div className="jp-modal-root" role="presentation">
          <button type="button" className="jp-modal-backdrop" aria-label="Cerrar" onClick={closeModal} />
          <div className="jp-modal" role="dialog" aria-modal="true" aria-labelledby="benef-redeem-title">
            <header className="jp-modal-head">
              <h3 id="benef-redeem-title">Redimir jikkopuntos</h3>
              <button type="button" className="jp-modal-close" onClick={closeModal} aria-label="Cerrar">
                ×
              </button>
            </header>
            <div className="jp-modal-body">
              <p className="jp-modal-hint">
                Recompensa: <strong>{modalTier.label}</strong> — se descontarán{' '}
                <strong>{modalTier.jp.toLocaleString('es-CO')} JP</strong> de tu saldo.
              </p>
              <label className="jp-modal-field">
                <span>Comentarios (obligatorio)</span>
                <textarea
                  className="jp-modal-textarea"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={4}
                  placeholder="Motivo del beneficio, fechas del descanso acordadas, etc."
                />
              </label>
              <label className="jp-modal-field">
                <span>PDF — autorización del jefe (obligatorio)</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="jp-modal-file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? <span className="jp-modal-file-name">{file.name}</span> : null}
              </label>
              {saveErr ? <p className="error">{saveErr}</p> : null}
              {saveOk ? <p className="success">{saveOk}</p> : null}
              <div className="jp-modal-actions">
                <button type="button" className="jp-btn jp-btn--ghost" disabled={saveBusy} onClick={closeModal}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="jp-btn jp-btn--primary"
                  disabled={saveBusy || justification.trim().length < 10 || !file}
                  onClick={() => void submitRedeem()}
                >
                  {saveBusy ? 'Guardando…' : 'Confirmar redención'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
