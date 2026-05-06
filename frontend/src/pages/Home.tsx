import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, apiBlob } from '../api/http';
import { useAuth } from '../auth/AuthContext';

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

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconJikkopuntos({ className }: { className?: string }) {
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

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M17 11a3 3 0 1 0-3-3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M3 21v-1a5 5 0 0 1 5-5h2M21 21v-1a5 5 0 0 0-5-5h-2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19h16M7 15l3-6 4 4 3-8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg className="home-dash-tile-chevron" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
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

type DashTileProps = { to: string; title: string; subtitle: string; icon: ReactNode };

function DashTile({ to, title, subtitle, icon }: DashTileProps) {
  return (
    <Link to={to} className="home-dash-tile">
      <span className="home-dash-tile-icon-wrap" aria-hidden>
        {icon}
      </span>
      <span className="home-dash-tile-body">
        <span className="home-dash-tile-title">{title}</span>
        <span className="home-dash-tile-sub">{subtitle}</span>
      </span>
      <IconChevron />
    </Link>
  );
}

function Top10Chart({
  items,
  loading,
  err,
}: {
  items: LeaderboardRes['items'];
  loading: boolean;
  err: string | null;
}) {
  const max = Math.max(1, ...items.map((i) => i.balance));

  if (loading) {
    return (
      <div className="home-jp-chart home-jp-chart--loading" aria-busy="true">
        <p className="home-jp-chart-loading-msg">Cargando ranking…</p>
      </div>
    );
  }
  if (err) {
    return <p className="error home-jp-chart-err">{err}</p>;
  }
  if (items.length === 0) {
    return <p className="home-jp-chart-empty">Aún no hay saldos de jikkopuntos para mostrar.</p>;
  }

  return (
    <div
      className="home-jp-chart"
      role="list"
      aria-label="Top 10 colaboradores con más jikkopuntos"
    >
      {items.map((row) => {
        const label = `${row.firstName} ${row.lastName}`.trim() || row.email;
        const pct = Math.round((row.balance / max) * 100);
        return (
          <div key={row.userId} className="home-jp-chart-row" role="listitem">
            <span className="home-jp-chart-rank" aria-hidden>
              {row.rank}
            </span>
            <div className="home-jp-chart-main">
              <div className="home-jp-chart-label-row">
                <span className="home-jp-chart-name" title={row.email}>
                  {label}
                </span>
                <span className="home-jp-chart-val">{row.balance.toLocaleString('es-CO')} JP</span>
              </div>
              <div className="home-jp-chart-bar-track">
                <div
                  className="home-jp-chart-bar-fill"
                  style={{ width: `${pct}%` }}
                  role="presentation"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminHome() {
  const { user } = useAuth();
  const [lb, setLb] = useState<LeaderboardRes | null>(null);
  const [lbErr, setLbErr] = useState<string | null>(null);
  const [lbLoading, setLbLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [dlErr, setDlErr] = useState<string | null>(null);

  const loadLb = useCallback(async () => {
    setLbErr(null);
    setLbLoading(true);
    try {
      const res = await api<LeaderboardRes>('/jikkopoints/admin/leaderboard?limit=10');
      setLb(res);
    } catch (e) {
      setLbErr(e instanceof Error ? e.message : 'Error');
      setLb(null);
    } finally {
      setLbLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLb();
  }, [loadLb]);

  async function downloadReport() {
    setDlErr(null);
    setDownloading(true);
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
      setDlErr(e instanceof Error ? e.message : 'Error al descargar');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fm-admin-page home-dash">
      <header className="fm-head">
        <div className="fm-head-icon-wrap">
          <IconChart className="fm-head-icon" />
        </div>
        <div>
          <h1 className="fm-title">Hola, {user?.firstName}</h1>
          <p className="fm-subtitle">
            Panel de inicio del portal de Recursos Humanos. Accede rápido a tus herramientas y revisa el
            rendimiento en jikkopuntos del equipo.
          </p>
        </div>
      </header>

      <section className="home-dash-section" aria-labelledby="home-dash-accesos">
        <h2 id="home-dash-accesos" className="home-dash-section-title">
          Accesos rápidos
        </h2>
        <div className="home-dash-tiles">
          <DashTile
            to="/perfil"
            title="Ver o editar perfil"
            subtitle="Hoja de vida y datos de contacto"
            icon={<IconUser className="home-dash-tile-svg" />}
          />
          <DashTile
            to="/jikkopuntos"
            title="Jikkopuntos"
            subtitle="Saldo e historial personal"
            icon={<IconJikkopuntos className="home-dash-tile-svg" />}
          />
          <DashTile
            to="/formularios"
            title="Formularios publicados"
            subtitle="Responder formularios activos"
            icon={<IconClipboard className="home-dash-tile-svg" />}
          />
          <DashTile
            to="/admin/usuarios"
            title="Gestión de colaboradores"
            subtitle="Crear y administrar cuentas"
            icon={<IconUsers className="home-dash-tile-svg" />}
          />
          <DashTile
            to="/admin/formularios"
            title="Formularios (admin)"
            subtitle="Definir, publicar y ver respuestas"
            icon={<IconClipboard className="home-dash-tile-svg" />}
          />
          <DashTile
            to="/admin/jikkopuntos"
            title="Jikkopuntos — informe"
            subtitle="Ranking completo y descarga Excel"
            icon={<IconJikkopuntos className="home-dash-tile-svg" />}
          />
          <DashTile
            to="/admin/beneficios"
            title="Mis beneficios"
            subtitle="Vista administración del módulo"
            icon={<IconGift className="home-dash-tile-svg" />}
          />
        </div>
      </section>

      <section className="fm-panel home-jp-panel" aria-labelledby="home-jp-chart-title">
        <div className="home-jp-panel-head">
          <div>
            <h2 id="home-jp-chart-title" className="fm-title" style={{ fontSize: '1.2rem', margin: '0 0 0.25rem' }}>
              Top 10 — más jikkopuntos
            </h2>
            <p className="fm-subtitle" style={{ margin: 0 }}>
              {lb && !lbLoading
                ? `${lb.totalCollaborators} colaboradores en total · actualizado ${new Date(lb.generatedAt).toLocaleString('es-CO')}`
                : 'Saldo neto acumulado por colaborador.'}
            </p>
          </div>
          <div className="home-jp-panel-actions">
            <button
              type="button"
              className="jp-btn jp-btn--primary home-jp-dl-btn"
              disabled={downloading}
              onClick={() => void downloadReport()}
            >
              <IconDownload className="home-jp-dl-ico" />
              {downloading ? 'Generando…' : 'Excel (.xlsx)'}
            </button>
            <Link to="/admin/jikkopuntos" className="home-jp-panel-link">
              Ver informe completo
            </Link>
          </div>
        </div>
        {dlErr ? <p className="error home-jp-dl-err">{dlErr}</p> : null}
        <Top10Chart items={lb?.items ?? []} loading={lbLoading} err={lbErr} />
      </section>
    </div>
  );
}

function CollaboratorHome() {
  const { user } = useAuth();
  return (
    <div className="fm-page home-dash">
      <header className="fm-head">
        <div className="fm-head-icon-wrap">
          <IconUser className="fm-head-icon" />
        </div>
        <div>
          <h1 className="fm-title">Hola, {user?.firstName}</h1>
          <p className="fm-subtitle">
            Este es el MVP del portal de Recursos Humanos. Usa el menú o los accesos de abajo para gestionar tu
            perfil, puntos y formularios.
          </p>
        </div>
      </header>
      <section className="home-dash-section" aria-labelledby="home-collab-accesos">
        <h2 id="home-collab-accesos" className="home-dash-section-title">
          Accesos rápidos
        </h2>
        <div className="home-dash-tiles home-dash-tiles--narrow">
          <DashTile
            to="/perfil"
            title="Ver o editar perfil"
            subtitle="Hoja de vida y datos de contacto"
            icon={<IconUser className="home-dash-tile-svg" />}
          />
          <DashTile
            to="/jikkopuntos"
            title="Jikkopuntos"
            subtitle="Saldo e historial"
            icon={<IconJikkopuntos className="home-dash-tile-svg" />}
          />
          <DashTile
            to="/formularios"
            title="Formularios publicados"
            subtitle="Responder formularios activos"
            icon={<IconClipboard className="home-dash-tile-svg" />}
          />
          <DashTile
            to="/beneficios"
            title="Mis beneficios"
            subtitle="Canje por jikkopuntos al alcanzar el umbral"
            icon={<IconGift className="home-dash-tile-svg" />}
          />
        </div>
      </section>
    </div>
  );
}

export function Home() {
  const { user } = useAuth();
  if (user?.roleCode === 'ADMIN') {
    return <AdminHome />;
  }
  return <CollaboratorHome />;
}
