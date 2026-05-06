/**
 * Elimina etiquetas HTML básicas y caracteres de control (entrada de texto libre).
 * No sustituye CSP en frontend; reduceriesgo de almacenar HTML activo.
 */
export function stripHtmlLoose(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}
