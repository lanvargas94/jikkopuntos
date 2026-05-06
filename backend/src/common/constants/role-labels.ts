import { ROLE_CODES, type RoleCode } from './roles';

const LABELS: Record<RoleCode, string> = {
  [ROLE_CODES.ADMIN]: 'Administrador en Jikkosoft',
  [ROLE_CODES.COLLABORATOR]: 'Colaborador en Jikkosoft',
};

export function roleDisplayName(code: string): string {
  if (code === ROLE_CODES.ADMIN || code === ROLE_CODES.COLLABORATOR) {
    return LABELS[code];
  }
  return code;
}
