import type { RoleCode } from './AuthContext';

/** Destino tras login cuando no hay `from` previo (deep link). */
export function defaultLandingForRole(role: RoleCode): string {
  return role === 'ADMIN' ? '/admin/formularios' : '/';
}

export function resolvePostLoginPath(
  from: string | undefined,
  role: RoleCode,
): string {
  if (from && from !== '/login') {
    return from;
  }
  return defaultLandingForRole(role);
}
