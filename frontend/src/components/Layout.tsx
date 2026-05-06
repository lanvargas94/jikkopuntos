import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NotificationBell } from './NotificationBell';

function LogoMark() {
  return (
    <div className="app-sidebar-logo-mark" aria-hidden>
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="10" fill="#2563eb" />
        <path
          d="M12 28V16l8-4 8 4v12M12 20l8 4 8-4M20 12v8"
          stroke="#fff"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function IconUser() {
  return (
    <svg className="app-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
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

/** Dos círculos enlazados — marca JP en sidebar */
function IconJikkopuntos() {
  return (
    <svg className="app-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="15" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconGift() {
  return (
    <svg className="app-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconClipboard() {
  return (
    <svg className="app-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconKey() {
  return (
    <svg className="app-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M10.5 10.5L21 21M15 15l3 3M18 12l3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className="app-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconHome() {
  return (
    <svg className="app-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg className="app-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M14 15l4-3-4-3M18 12H9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className="app-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const wideMain =
    pathname.startsWith('/admin/usuarios') ||
    pathname.startsWith('/admin/formularios') ||
    pathname.startsWith('/admin/jikkopuntos') ||
    pathname.startsWith('/admin/aprobaciones');

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `app-sidebar-link${isActive ? ' active' : ''}`;

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Navegación principal">
        <Link to="/" className="app-sidebar-brand">
          <LogoMark />
          <span className="app-sidebar-brand-text">Jikkosoft</span>
        </Link>
        <nav className="app-sidebar-nav">
          <NavLink to="/" className={navClass} end>
            <IconHome />
            Inicio
          </NavLink>
          <NavLink to="/perfil" className={navClass}>
            <IconUser />
            Mi perfil
          </NavLink>
          <NavLink to="/jikkopuntos" className={navClass}>
            <IconJikkopuntos />
            Jikkopuntos
          </NavLink>
          {user?.roleCode !== 'ADMIN' ? (
            <NavLink to="/mis-solicitudes" className={navClass}>
              <IconClipboard />
              Mis solicitudes
            </NavLink>
          ) : null}
          {user?.roleCode !== 'ADMIN' ? (
            <NavLink to="/beneficios" className={navClass}>
              <IconGift />
              Mis beneficios
            </NavLink>
          ) : null}
          <NavLink to="/formularios" className={navClass}>
            <IconClipboard />
            Formularios
          </NavLink>
          <NavLink to="/cambiar-clave" className={navClass}>
            <IconKey />
            Seguridad
          </NavLink>
          {user?.roleCode === 'ADMIN' ? (
            <div className="app-sidebar-admin">
              <p className="app-sidebar-admin-label">Administración</p>
              <NavLink to="/admin/usuarios" className={navClass}>
                <IconUsers />
                Gestión usuarios
              </NavLink>
              <NavLink to="/admin/formularios" className={navClass}>
                <IconClipboard />
                Formularios
              </NavLink>
              <NavLink to="/admin/jikkopuntos" className={navClass}>
                <IconJikkopuntos />
                Jikkopuntos (informe)
              </NavLink>
              <NavLink to="/admin/aprobaciones" className={navClass}>
                <IconClipboard />
                Aprobaciones RR.HH.
              </NavLink>
              <NavLink to="/admin/beneficios" className={navClass}>
                <IconGift />
                Mis beneficios
              </NavLink>
              <span className="app-sidebar-link app-sidebar-link--disabled" title="Próximamente">
                <IconSettings />
                Configuración
              </span>
            </div>
          ) : null}
        </nav>
        <div className="app-sidebar-footer">
          <button
            type="button"
            className="app-sidebar-link app-sidebar-logout"
            onClick={() => {
              void (async () => {
                await logout();
                navigate('/login');
              })();
            }}
          >
            <IconLogout />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="app-shell-body">
        <main className={wideMain ? 'app-main app-main--wide' : 'app-main'}>
          <div className="app-main-toolbar">
            <NotificationBell />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
