export const FORM_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  /** No acepta respuestas; el enlace puede mostrar mensaje de cierre. */
  CLOSED: 'CLOSED',
} as const;

export type FormStatus = (typeof FORM_STATUS)[keyof typeof FORM_STATUS];
