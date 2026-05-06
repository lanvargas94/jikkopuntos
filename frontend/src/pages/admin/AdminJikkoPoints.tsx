import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiBlob } from '../../api/http';

type LeaderboardRes = {
  generatedAt: string;
  limit: number;
  totalCollaborators: number;
  items: {
    rank: number;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    area: string | null;
    balance: number;
  }[];
};

function IconJp() {
  return (
    <svg className="fm-head-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="15" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden width="18" height="18">
      <path
        d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminJikkoPoints() {
  const [data, setData] = useState<LeaderboardRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await api<LeaderboardRes>('/jikkopoints/admin/leaderboard?limit=10');
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadReport() {
    setDownloading(true);
    setErr(null);
    try {
      const blob = await apiBlob('/jikkopoints/admin/report.xlsx');
      const day = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jikkopuntos-colaboradores-${day}.xlsx`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al descargar');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fm-admin-page">
      <div className="fm-head">
        <div className="fm-head-icon-wrap">
          <IconJp />
        </div>
        <div>
          <h1 className="fm-title">Jikkopuntos — administración</h1>
          <p className="fm-subtitle">
            Top de colaboradores por saldo neto y reporte Excel con todos los colaboradores de Jikkosoft.
            Los colaboradores solo ven su saldo e historial en{' '}
            <Link to="/jikkopuntos">Jikkopuntos</Link>.
          </p>
        </div>
      </div>

      <div className="fm-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <button
          type="button"
          className="jp-btn jp-btn--primary"
          disabled={downloading}
          onClick={() => void downloadReport()}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <IconDownload />
            {downloading ? 'Generando…' : 'Descargar reporte Excel (.xlsx)'}
          </span>
        </button>
        <span className="muted small" style={{ color: '#64748b' }}>
          Incluye correo, datos de perfil y saldo neto (JP) a la fecha de todos los colaboradores.
        </span>
      </div>

      {err ? <p className="error fm-panel-err">{err}</p> : null}

      {loading ? (
        <div className="fm-panel fm-panel--loading">Cargando ranking…</div>
      ) : data ? (
        <section className="fm-panel" aria-labelledby="jp-admin-lb-title">
          <h2 id="jp-admin-lb-title" className="fm-title" style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>
            Top {data.limit} colaboradores
          </h2>
          <p className="fm-subtitle" style={{ marginBottom: '1rem' }}>
            Total de colaboradores en el sistema: <strong>{data.totalCollaborators}</strong>. Generado:{' '}
            {new Date(data.generatedAt).toLocaleString('es-CO')}
          </p>
          {data.items.length === 0 ? (
            <p className="fm-empty-text">No hay colaboradores con saldo registrado.</p>
          ) : (
            <div className="jp-table-wrap">
              <table className="jp-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Colaborador</th>
                    <th>Correo</th>
                    <th>Cargo</th>
                    <th>Área</th>
                    <th className="jp-th-num">Saldo (JP)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.userId}>
                      <td>{row.rank}</td>
                      <td>
                        {row.firstName} {row.lastName}
                      </td>
                      <td>{row.email}</td>
                      <td>{row.jobTitle ?? '—'}</td>
                      <td>{row.area ?? '—'}</td>
                      <td className="jp-td-amt is-pos">{row.balance.toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
