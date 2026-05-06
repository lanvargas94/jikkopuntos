import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/http';

type CollaboratorHit = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: string;
  isActive: boolean;
  balance: number;
};

type RedeemOption = { kind: string; label: string; jp: number };

type BenefitRewardsMeta = {
  minJpToUnlock: number;
  tiers: { id: string; jp: number; label: string }[];
};

type RedeemSaveRes =
  | {
      targetUserId: string;
      newBalance: number;
      debitedJp: number;
      movementType: string;
    }
  | {
      requestId: string;
      status: string;
      targetUserId: string;
      jp: number;
      movementType: string;
    };

type Step = 'summary' | 'kind' | 'form';

type Props = {
  onRedeemed?: () => void;
};

export function JikkoPointsAdminRedeemPanel({ onRedeemed }: Props) {
  const [options, setOptions] = useState<RedeemOption[] | null>(null);
  const [docInput, setDocInput] = useState('');
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [found, setFound] = useState<CollaboratorHit | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<Step>('summary');
  const [kind, setKind] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [minJpForRewards, setMinJpForRewards] = useState<number | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const o = await api<RedeemOption[]>('/jikkopoints/admin/redeem-rest-options');
        if (!c) setOptions(o);
      } catch {
        if (!c) setOptions([]);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const meta = await api<BenefitRewardsMeta>('/jikkopoints/me/benefit-rewards');
        if (!c) setMinJpForRewards(meta.minJpToUnlock);
      } catch {
        if (!c) setMinJpForRewards(1000);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const modalTitle =
    step === 'summary' ? 'Resumen de búsqueda' : step === 'kind' ? 'Tipo de descanso' : 'Confirmar canje';

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setFound(null);
    setStep('summary');
    setKind(null);
    setJustification('');
    setFile(null);
    setSaveErr(null);
    setSaveOk(null);
  }, []);

  async function search() {
    setSearchErr(null);
    setFound(null);
    setSaveOk(null);
    const q = docInput.trim();
    if (!q) {
      setSearchErr('Escribe un número de documento.');
      return;
    }
    setSearchBusy(true);
    try {
      const res = await api<CollaboratorHit>(
        `/jikkopoints/admin/collaborator-by-id-number?idNumber=${encodeURIComponent(q)}`,
      );
      setFound(res);
      setModalOpen(true);
      setStep('summary');
      setKind(null);
      setJustification('');
      setFile(null);
      setSaveErr(null);
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : 'Error en la búsqueda');
    } finally {
      setSearchBusy(false);
    }
  }

  const selectedOption = kind && options ? options.find((o) => o.kind === kind) : null;

  const canUseJikkopuntos =
    !!found &&
    found.isActive &&
    minJpForRewards !== null &&
    found.balance >= minJpForRewards;

  const useJikkopuntosTitle = !found
    ? undefined
    : !found.isActive
      ? 'Este colaborador está inactivo.'
      : minJpForRewards !== null && found.balance < minJpForRewards
        ? 'Aún no llegas a la meta'
        : undefined;

  async function submitRedeem() {
    if (!found || !kind || !file) return;
    if (justification.trim().length < 10) {
      setSaveErr('La justificación debe tener al menos 10 caracteres.');
      return;
    }
    setSaveErr(null);
    setSaveBusy(true);
    try {
      const fd = new FormData();
      fd.set('targetUserId', found.userId);
      fd.set('kind', kind);
      fd.set('justification', justification.trim());
      fd.set('attachment', file);
      const res = await api<RedeemSaveRes>('/jikkopoints/admin/redeem-rest', {
        method: 'POST',
        body: fd,
      });
      if ('requestId' in res && res.status === 'PENDING') {
        setSaveOk(
          `Solicitud enviada (${res.jp.toLocaleString('es-CO')} JP). Otro administrador debe aprobarla antes de descontar el saldo.`,
        );
      } else if ('newBalance' in res) {
        setSaveOk(
          `Canje registrado. Nuevo saldo del colaborador: ${res.newBalance.toLocaleString('es-CO')} JP.`,
        );
        setFound((prev) => (prev ? { ...prev, balance: res.newBalance } : prev));
        onRedeemed?.();
      }
      setTimeout(() => {
        setDocInput('');
        closeModal();
      }, 2200);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <section className="jp-admin-redeem" aria-labelledby="jp-admin-redeem-title">
      <h2 id="jp-admin-redeem-title" className="jp-admin-redeem-title">
        Uso de jikkopuntos (colaborador)
      </h2>
           <p className="jp-admin-redeem-sub muted small">
        Busca por número de identificación. Solo rol colaborador. El colaborador debe tener al menos{' '}
        <strong>
          {minJpForRewards != null ? minJpForRewards.toLocaleString('es-CO') : '…'} JP
        </strong>{' '}
        (umbral de recompensas) para poder usar jikkopuntos en descansos. Costes:{' '}
        {options?.map((o) => `${o.label} (${o.jp} JP)`).join(' · ') ?? '…'}.
      </p>
      <div className="jp-admin-redeem-search">
        <label className="jp-admin-redeem-label">
          <span>Número de documento</span>
          <input
            className="jp-admin-redeem-input"
            value={docInput}
            onChange={(e) => setDocInput(e.target.value)}
            placeholder="Ej. 1234567890"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
          />
        </label>
        <button type="button" className="jp-btn jp-btn--primary" disabled={searchBusy} onClick={() => void search()}>
          {searchBusy ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      {searchErr ? <p className="error jp-admin-redeem-err">{searchErr}</p> : null}

      {modalOpen && found ? (
        <div className="jp-modal-root" role="presentation">
          <button
            type="button"
            className="jp-modal-backdrop"
            aria-label="Cerrar"
            onClick={() => !saveBusy && closeModal()}
          />
          <div
            className="jp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="jp-modal-title"
          >
            <header className="jp-modal-head">
              <h3 id="jp-modal-title">{modalTitle}</h3>
              <button
                type="button"
                className="jp-modal-close"
                disabled={saveBusy}
                onClick={closeModal}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>
            <div className="jp-modal-body">
              <div className="fm-tabs jp-modal-steps" role="tablist" aria-label="Pasos del canje">
                <span
                  role="tab"
                  aria-selected={step === 'summary'}
                  className={`fm-tab jp-modal-step${step === 'summary' ? ' is-active' : ''}`}
                >
                  1. Resumen
                </span>
                <span
                  role="tab"
                  aria-selected={step === 'kind'}
                  className={`fm-tab jp-modal-step${step === 'kind' ? ' is-active' : ''}`}
                >
                  2. Tipo
                </span>
                <span
                  role="tab"
                  aria-selected={step === 'form'}
                  className={`fm-tab jp-modal-step${step === 'form' ? ' is-active' : ''}`}
                >
                  3. Confirmar
                </span>
              </div>
              {step === 'summary' ? (
                <>
                  <dl className="jp-modal-dl">
                    <div>
                      <dt>Colaborador</dt>
                      <dd>
                        {found.firstName} {found.lastName}
                      </dd>
                    </div>
                    <div>
                      <dt>Correo</dt>
                      <dd>{found.email}</dd>
                    </div>
                    <div>
                      <dt>Documento</dt>
                      <dd>{found.idNumber}</dd>
                    </div>
                    <div>
                      <dt>Jikkopuntos</dt>
                      <dd className="jp-modal-balance">{found.balance.toLocaleString('es-CO')} JP</dd>
                    </div>
                    {!found.isActive ? (
                      <p className="error">Este colaborador está inactivo; no se puede canjear.</p>
                    ) : null}
                    {found.isActive &&
                    minJpForRewards !== null &&
                    found.balance < minJpForRewards ? (
                      <p className="jp-modal-below-threshold muted small">
                        Aún no alcanza el mínimo de {minJpForRewards.toLocaleString('es-CO')} JP para activar canjes
                        alineados a beneficios.
                      </p>
                    ) : null}
                  </dl>
                  <div className="jp-modal-actions">
                    <button type="button" className="jp-btn jp-btn--ghost" disabled={saveBusy} onClick={closeModal}>
                      Cerrar
                    </button>
                    <span
                      className={`jp-tooltip-host${useJikkopuntosTitle ? ' has-tip' : ''}`}
                      title={useJikkopuntosTitle ?? undefined}
                    >
                      <button
                        type="button"
                        className="jp-btn jp-btn--primary"
                        disabled={saveBusy || !canUseJikkopuntos}
                        onClick={() => canUseJikkopuntos && setStep('kind')}
                      >
                        Usar jikkopuntos
                      </button>
                    </span>
                  </div>
                </>
              ) : null}

              {step === 'kind' ? (
                <>
                  <p className="jp-modal-hint">Elige el tipo de descanso a descontar.</p>
                  <div className="jp-kind-grid">
                    {(options ?? []).map((o) => (
                      <button
                        key={o.kind}
                        type="button"
                        className={`jp-kind-card${kind === o.kind ? ' is-selected' : ''}`}
                        onClick={() => setKind(o.kind)}
                      >
                        <span className="jp-kind-label">{o.label}</span>
                        <span className="jp-kind-jp">{o.jp.toLocaleString('es-CO')} JP</span>
                      </button>
                    ))}
                  </div>
                  <div className="jp-modal-actions">
                    <button type="button" className="jp-btn jp-btn--ghost" onClick={() => setStep('summary')}>
                      Atrás
                    </button>
                    <button
                      type="button"
                      className="jp-btn jp-btn--primary"
                      disabled={!kind}
                      onClick={() => setStep('form')}
                    >
                      Continuar
                    </button>
                  </div>
                </>
              ) : null}

              {step === 'form' && selectedOption ? (
                <>
                  <p className="jp-modal-hint">
                    Canje: <strong>{selectedOption.label}</strong> ({selectedOption.jp.toLocaleString('es-CO')} JP).
                    Completa la justificación y adjunta la solicitud (PDF o imagen, máx. 5 MB).
                  </p>
                  <label className="jp-modal-field">
                    <span>Justificación (obligatoria)</span>
                    <textarea
                      className="jp-modal-textarea"
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      rows={4}
                      minLength={10}
                      required
                      placeholder="Describe el motivo y el acuerdo con el colaborador…"
                    />
                  </label>
                  <label className="jp-modal-field">
                    <span>Solicitud / soporte (obligatorio)</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      className="jp-modal-file"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    {file ? <span className="jp-modal-file-name">{file.name}</span> : null}
                  </label>
                  {saveErr ? <p className="error">{saveErr}</p> : null}
                  {saveOk ? <p className="success">{saveOk}</p> : null}
                  <div className="jp-modal-actions">
                    <button type="button" className="jp-btn jp-btn--ghost" disabled={saveBusy} onClick={() => setStep('kind')}>
                      Atrás
                    </button>
                    <button
                      type="button"
                      className="jp-btn jp-btn--primary"
                      disabled={saveBusy || justification.trim().length < 10 || !file}
                      onClick={() => void submitRedeem()}
                    >
                      {saveBusy ? 'Guardando…' : 'Guardar canje'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
