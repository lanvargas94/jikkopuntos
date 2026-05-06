import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/http';
import { useAuth } from '../auth/AuthContext';
import { JikkoPointsAdminRedeemPanel } from '../components/JikkoPointsAdminRedeemPanel';

type BalanceRes = {
  balance: number;
  strategy: 'ledger_sum';
  cachedBalance: number;
  cacheRepaired: boolean;
  inSync: boolean;
};

type MovementRow = {
  id: string;
  createdAt: string;
  movementType: string;
  movementTypeLabel: string;
  amount: number;
  reason: string;
  justification?: string | null;
  attachmentPath?: string | null;
  source: {
    type: string | null;
    id: string | null;
    formResponseId: string | null;
  };
};

type MovementsRes = {
  items: MovementRow[];
  total: number;
  offset: number;
  limit: number;
};

type AdminCollaboratorHeader = {
  userId: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  isActive: boolean;
  balance: number;
};

type AdminCollaboratorMovementsRes = MovementsRes & {
  collaborator: AdminCollaboratorHeader;
};

const PAGE = 25;

type BenefitRewardsPublic = {
  minJpToUnlock: number;
  tiers: { id: string; jp: number; label: string }[];
};

function nextTier(balance: number, tiers: { jp: number; label: string }[]) {
  const sorted = [...tiers].sort((a, b) => a.jp - b.jp);
  const t = sorted.find((x) => x.jp > balance);
  if (t) return { jp: t.jp, reward: t.label };
  const last = sorted[sorted.length - 1];
  if (last) {
    const extra = Math.ceil((balance + 1) / 2500) * 2500;
    return { jp: Math.max(extra, last.jp + 2500), reward: 'Siguiente nivel de recompensas' };
  }
  return { jp: Math.max(balance + 500, 1000), reward: 'Siguiente nivel de recompensas' };
}

function collaboratorLevel(balance: number) {
  if (balance < 800) return 'Colaborador';
  if (balance < 2000) return 'Colaborador Plus';
  return 'Colaborador Pro';
}

function formatJp(n: number) {
  return `${n.toLocaleString('es-CO')} JP`;
}

function formatMovementDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatRef(row: MovementRow): string {
  const s = row.source;
  if (s.formResponseId) {
    return `FORM-${s.formResponseId.slice(0, 6).toUpperCase()}`;
  }
  if (s.type && s.id) {
    const prefix = s.type === 'ADMIN' ? 'ADM' : s.type.slice(0, 4).toUpperCase();
    return `${prefix}-${row.id.slice(0, 6).toUpperCase()}`;
  }
  return `MOV-${row.id.slice(0, 8).toUpperCase()}`;
}

function IconJpMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="15" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconGift({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="8" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8V22M3 12h18" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 8h-2a2 2 0 0 1 0-4c1.5 0 2 2 2 2s.5-2 2-2a2 2 0 0 1 0 4h-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19h16M7 15l3-6 4 4 3-8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconFilter({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.9 7.3h7.6l-6.1 4.7 2.3 7.4L12 17.6l-6.7 4.8 2.3-7.4-6.1-4.7h7.6L12 2z" />
    </svg>
  );
}

type FilterKind = 'all' | 'credit' | 'debit';

export function JikkoPoints() {
  const { jikkopointsTick, user, bumpJikkopoints } = useAuth();
  const isAdmin = user?.roleCode === 'ADMIN';
  const [catalogTiers, setCatalogTiers] = useState<{ jp: number; label: string }[]>([]);
  const [balance, setBalance] = useState<BalanceRes | null>(null);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [filterKind, setFilterKind] = useState<FilterKind>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [adminDocInput, setAdminDocInput] = useState('');
  const [adminCommittedIdNumber, setAdminCommittedIdNumber] = useState<string | null>(null);
  const [adminCollaborator, setAdminCollaborator] = useState<AdminCollaboratorHeader | null>(null);
  const [adminHistLoading, setAdminHistLoading] = useState(false);
  const adminCommittedRef = useRef<string | null>(null);
  const adminMovementsCountRef = useRef(0);

  useEffect(() => {
    adminCommittedRef.current = adminCommittedIdNumber;
  }, [adminCommittedIdNumber]);

  useEffect(() => {
    adminMovementsCountRef.current = movements.length;
  }, [movements.length]);

  const loadInitial = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      if (isAdmin) {
        const [b, meta] = await Promise.all([
          api<BalanceRes>('/jikkopoints/me/balance'),
          api<BenefitRewardsPublic>('/jikkopoints/me/benefit-rewards'),
        ]);
        setBalance(b);
        setCatalogTiers(meta.tiers.map((t) => ({ jp: t.jp, label: t.label })));
        const doc = adminCommittedRef.current;
        if (doc) {
          const lim = Math.min(100, Math.max(PAGE, adminMovementsCountRef.current || PAGE));
          const m = await api<AdminCollaboratorMovementsRes>(
            `/jikkopoints/admin/collaborator-movements?idNumber=${encodeURIComponent(doc)}&limit=${lim}&offset=0`,
          );
          setMovements(m.items);
          setTotal(m.total);
          setOffset(m.items.length);
          setAdminCollaborator(m.collaborator);
        }
      } else {
        const [b, m, meta] = await Promise.all([
          api<BalanceRes>('/jikkopoints/me/balance'),
          api<MovementsRes>(`/jikkopoints/me/movements?limit=${PAGE}&offset=0`),
          api<BenefitRewardsPublic>('/jikkopoints/me/benefit-rewards'),
        ]);
        setBalance(b);
        setMovements(m.items);
        setTotal(m.total);
        setOffset(m.items.length);
        setCatalogTiers(meta.tiers.map((t) => ({ jp: t.jp, label: t.label })));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, jikkopointsTick]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  async function searchAdminHistory() {
    const raw = adminDocInput.trim();
    if (!raw) {
      setErr('Indica un número de documento.');
      return;
    }
    setAdminHistLoading(true);
    setErr(null);
    try {
      const m = await api<AdminCollaboratorMovementsRes>(
        `/jikkopoints/admin/collaborator-movements?idNumber=${encodeURIComponent(raw)}&limit=${PAGE}&offset=0`,
      );
      setAdminCommittedIdNumber(raw);
      setAdminCollaborator(m.collaborator);
      setMovements(m.items);
      setTotal(m.total);
      setOffset(m.items.length);
    } catch (e) {
      setAdminCommittedIdNumber(null);
      setAdminCollaborator(null);
      setMovements([]);
      setTotal(0);
      setOffset(0);
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setAdminHistLoading(false);
    }
  }

  async function loadMore() {
    if (movements.length >= total) return;
    setLoadingMore(true);
    setErr(null);
    try {
      if (isAdmin && adminCommittedIdNumber) {
        const m = await api<AdminCollaboratorMovementsRes>(
          `/jikkopoints/admin/collaborator-movements?idNumber=${encodeURIComponent(adminCommittedIdNumber)}&limit=${PAGE}&offset=${offset}`,
        );
        setMovements((prev) => [...prev, ...m.items]);
        setOffset((o) => o + m.items.length);
        setAdminCollaborator(m.collaborator);
      } else {
        const m = await api<MovementsRes>(
          `/jikkopoints/me/movements?limit=${PAGE}&offset=${offset}`,
        );
        setMovements((prev) => [...prev, ...m.items]);
        setOffset((o) => o + m.items.length);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoadingMore(false);
    }
  }

  const tier = balance ? nextTier(balance.balance, catalogTiers) : null;
  const jpToNext = tier && balance ? Math.max(0, tier.jp - balance.balance) : 0;
  const progressPct =
    tier && balance && tier.jp > 0 ? Math.min(100, (balance.balance / tier.jp) * 100) : 0;
  const levelName = balance ? collaboratorLevel(balance.balance) : '';

  const filteredMovements = useMemo(() => {
    const q = isAdmin ? '' : search.trim().toLowerCase();
    return movements.filter((t) => {
      if (filterKind === 'credit' && t.amount < 0) return false;
      if (filterKind === 'debit' && t.amount >= 0) return false;
      if (!q) return true;
      const ref = formatRef(t).toLowerCase();
      const blob = `${t.reason} ${t.justification ?? ''} ${t.movementTypeLabel} ${ref} ${formatMovementDate(t.createdAt)}`.toLowerCase();
      return blob.includes(q);
    });
  }, [movements, search, filterKind, isAdmin]);

  const allLoaded = movements.length >= total;

  if (loading) {
    return (
      <div className="jp-page">
        <div className="jp-card jp-card--loading">Cargando jikkopuntos…</div>
      </div>
    );
  }
  if (err && !balance) {
    return (
      <div className="jp-page">
        <div className="jp-card jp-card--error">{err}</div>
      </div>
    );
  }
  if (!balance || !tier) {
    return null;
  }

  return (
    <div className="jp-page">
      <header className="jp-page-title-row">
        <h1 className="jp-page-title">Jikkopuntos</h1>
        {user?.roleCode === 'ADMIN' ? (
          <p className="jp-page-title-hint muted small">
            Ranking y reporte Excel en{' '}
            <Link to="/admin/jikkopuntos">Administración de jikkopuntos</Link>.
          </p>
        ) : null}
      </header>
      {user?.roleCode === 'ADMIN' ? (
        <>
          <JikkoPointsAdminRedeemPanel onRedeemed={() => bumpJikkopoints()} />
        </>
      ) : null}
      {user?.roleCode !== 'ADMIN' ? (
        <div className="jp-top-grid">
          <section className="jp-balance-card" aria-labelledby="jp-balance-heading">
            <div className="jp-balance-card-inner">
              <div className="jp-balance-copy">
                <p id="jp-balance-heading" className="jp-balance-kicker">
                  <IconJpMark className="jp-balance-kicker-icon" />
                  Balance actual
                </p>
                <p className="jp-balance-value">
                  <span className="jp-balance-num">{balance.balance.toLocaleString('es-CO')}</span>
                  <span className="jp-balance-unit"> JP</span>
                </p>
                <p className="jp-balance-foot">
                  {jpToNext > 0 ? (
                    <>
                      ¡Vas por buen camino! Estás a solo <strong>{jpToNext.toLocaleString('es-CO')} JP</strong> de tu
                      siguiente recompensa.
                    </>
                  ) : (
                    <>¡Llegaste al siguiente hito! Pronto podrás canjear o seguir sumando.</>
                  )}
                </p>
                {(balance.cacheRepaired || !balance.inSync) && (
                  <p className="jp-balance-tech small">
                    {balance.cacheRepaired && <span> Saldo sincronizado con el historial.</span>}
                    {!balance.inSync && !balance.cacheRepaired && (
                      <span className="jp-balance-warn"> Revisa consistencia con RR.HH. si notas diferencias.</span>
                    )}
                  </p>
                )}
              </div>
              <div className="jp-balance-actions">
                <button type="button" className="jp-btn jp-btn--primary" disabled title="Próximamente">
                  <IconGift className="jp-btn-icon" />
                  Redimir premios
                </button>
                <button type="button" className="jp-btn jp-btn--ghost" disabled title="Próximamente">
                  <IconChart className="jp-btn-icon" />
                  ¿Cómo ganar más?
                </button>
              </div>
            </div>
          </section>

          <section className="jp-progress-card" aria-labelledby="jp-progress-title">
            <h2 id="jp-progress-title" className="jp-progress-title">
              Tu progreso
            </h2>
            <p className="jp-progress-level">
              Nivel: <span className="jp-progress-level-name">{levelName}</span>
            </p>
            <div className="jp-progress-track-wrap">
              <div className="jp-progress-track" role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
                <div className="jp-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="jp-progress-labels">
                <span>{formatJp(balance.balance)}</span>
                <span>{formatJp(tier.jp)}</span>
              </div>
            </div>
            <div className="jp-next-milestone">
              <IconStar className="jp-next-milestone-icon" />
              <div>
                <p className="jp-next-milestone-label">Próximo hito</p>
                <p className="jp-next-milestone-text">{tier.reward}</p>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <section className="jp-history-card" aria-labelledby="jp-history-title">
        <div className="jp-history-head">
          <h2 id="jp-history-title" className="jp-history-title">
            <IconClock className="jp-history-title-icon" />
            Historial de movimientos
          </h2>
          <div className="jp-history-toolbar">
            {!isAdmin ? (
              <div className="jp-search">
                <IconSearch className="jp-search-icon" />
                <input
                  className="jp-search-input"
                  type="search"
                  placeholder="Buscar movimiento…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar en movimientos"
                />
              </div>
            ) : null}
            <button
              type="button"
              className={`jp-icon-btn${filtersOpen ? ' is-on' : ''}`}
              aria-expanded={filtersOpen}
              aria-controls="jp-filter-panel"
              onClick={() => setFiltersOpen((v) => !v)}
              title="Filtros"
            >
              <IconFilter className="jp-icon-btn-svg" />
            </button>
          </div>
        </div>

        {isAdmin ? (
          <div className="jp-admin-history-search">
            <p className="jp-admin-history-search-hint">
              Busque por cédula o documento del colaborador para ver abonos, redenciones y demás movimientos con fecha.
            </p>
            <div className="jp-admin-history-search-row">
              <div className="jp-admin-doc-field">
                <span className="jp-admin-doc-label-text">Número de documento</span>
                <input
                  className="jp-admin-doc-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej. 1234567890"
                  value={adminDocInput}
                  onChange={(e) => setAdminDocInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void searchAdminHistory();
                    }
                  }}
                  aria-label="Número de documento del colaborador"
                />
              </div>
              <button
                type="button"
                className="jp-btn jp-btn--primary"
                disabled={adminHistLoading}
                onClick={() => void searchAdminHistory()}
              >
                {adminHistLoading ? 'Buscando…' : 'Buscar historial'}
              </button>
            </div>
            {adminCollaborator ? (
              <p className="jp-admin-collab-head">
                <strong>
                  {adminCollaborator.firstName} {adminCollaborator.lastName}
                </strong>
                {' · '}
                Doc. {adminCollaborator.idNumber}
                {' · '}
                Saldo:{' '}
                <strong>{adminCollaborator.balance.toLocaleString('es-CO')} JP</strong>
                {!adminCollaborator.isActive ? (
                  <span className="jp-admin-collab-warn"> (Colaborador inactivo)</span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {filtersOpen ? (
          <div id="jp-filter-panel" className="jp-filter-panel">
            <label className="jp-filter-label">
              <span>Tipo</span>
              <select
                className="jp-filter-select"
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value as FilterKind)}
              >
                <option value="all">Todos</option>
                <option value="credit">Abonos</option>
                <option value="debit">Redenciones / cargos</option>
              </select>
            </label>
          </div>
        ) : null}

        {err && <p className="error jp-history-err">{err}</p>}

        {isAdmin && !adminCommittedIdNumber ? (
          <p className="jp-empty">Busque un colaborador por número de documento para ver su historial de jikkopuntos.</p>
        ) : isAdmin && adminCommittedIdNumber && movements.length === 0 ? (
          <p className="jp-empty">Este colaborador no tiene movimientos registrados.</p>
        ) : movements.length === 0 ? (
          <p className="jp-empty">Aún no hay movimientos.</p>
        ) : filteredMovements.length === 0 ? (
          <p className="jp-empty">No hay resultados para tu búsqueda o filtro.</p>
        ) : (
          <div className="jp-table-wrap">
            <table className="jp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Motivo</th>
                  <th>Referencia</th>
                  <th className="jp-th-num">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((t) => {
                  const credit = t.amount >= 0;
                  return (
                    <tr key={t.id}>
                      <td className="jp-td-date">{formatMovementDate(t.createdAt)}</td>
                      <td>
                        <span className={credit ? 'jp-pill jp-pill--abono' : 'jp-pill jp-pill--redencion'}>
                          {credit ? (
                            <>
                              <span className="jp-pill-icon" aria-hidden>
                                +
                              </span>{' '}
                              Abono
                            </>
                          ) : (
                            <>
                              <span className="jp-pill-icon" aria-hidden>
                                ×
                              </span>{' '}
                              Redención
                            </>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className="jp-reason-main">{t.reason}</span>
                        {t.justification ? (
                          <span className="jp-reason-sub muted small">{t.justification}</span>
                        ) : null}
                      </td>
                      <td className="jp-td-ref">{formatRef(t)}</td>
                      <td className={`jp-td-amt ${credit ? 'is-pos' : 'is-neg'}`}>
                        {t.amount > 0 ? `+${t.amount.toLocaleString('es-CO')}` : t.amount.toLocaleString('es-CO')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {movements.length > 0 && (
          <div className="jp-history-footer">
            {!allLoaded ? (
              <button type="button" className="jp-link-all" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? 'Cargando…' : 'Ver todos los movimientos ›'}
              </button>
            ) : (
              <span className="jp-all-shown muted small">Mostrando todos los movimientos ({total})</span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
