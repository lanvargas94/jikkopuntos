import { randomBytes } from 'crypto';

const CHARSET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@$%';

/** Contraseña temporal legible (no exige política de 12 caracteres del cambio voluntario). */
export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARSET[bytes[i]! % CHARSET.length]!;
  }
  return out;
}
