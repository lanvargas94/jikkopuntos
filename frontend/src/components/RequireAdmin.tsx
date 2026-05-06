import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function RequireAdmin() {
  const { user } = useAuth();
  if (!user || user.roleCode !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
