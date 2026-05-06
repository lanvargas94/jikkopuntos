/**
 * Política de contraseña para cambios (no aplica al login de contraseñas antiguas cortas).
 * - 12–128 caracteres
 * - al menos una minúscula, mayúscula, dígito y carácter especial
 */
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*._\-]).{12,128}$/;

export const PASSWORD_POLICY_HINT =
  'Mínimo 12 caracteres; incluye mayúscula, minúscula, número y un símbolo (!@#$%^&*._-).';

export function validatePasswordPolicy(plain: string): string | null {
  if (plain.length < 12 || plain.length > 128) {
    return 'La contraseña debe tener entre 12 y 128 caracteres.';
  }
  if (!PASSWORD_PATTERN.test(plain)) {
    return `La contraseña no cumple la política de seguridad. ${PASSWORD_POLICY_HINT}`;
  }
  return null;
}
