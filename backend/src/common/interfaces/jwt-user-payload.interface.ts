import type { RoleCode } from '../constants/roles';

export interface JwtUserPayload {
  userId: string;
  email: string;
  roleCode: RoleCode;
  mustChangePassword: boolean;
}
