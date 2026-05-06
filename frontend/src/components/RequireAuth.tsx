import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getRefreshToken, getStoredToken } from '../api/http';
import { useAuth } from '../auth/AuthContext';

export function RequireAuth() {
  const { user, bootstrapped } = useAuth();
  const loc = useLocation();
  const token = getStoredToken();

  if (!bootstrapped) {
    return (
      <div className="card">
        <p>Cargando sesión…</p>
      </div>
    );
  }
  if (!token && !getRefreshToken()) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (user.mustChangePassword && loc.pathname !== '/cambiar-clave') {
    return <Navigate to="/cambiar-clave" replace />;
  }
  return <Outlet />;
}
