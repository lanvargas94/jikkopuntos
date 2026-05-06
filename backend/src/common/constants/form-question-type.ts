/** Tipos de pregunta del constructor; extensible sin migración (string + settingsJson). */
export const FORM_QUESTION_TYPE = {
  TEXT_OPEN: 'TEXT_OPEN',
  SINGLE_SELECT: 'SINGLE_SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
} as const;

export type FormQuestionTypeCode =
  (typeof FORM_QUESTION_TYPE)[keyof typeof FORM_QUESTION_TYPE];

export const FORM_QUESTION_TYPES: FormQuestionTypeCode[] = [
  FORM_QUESTION_TYPE.TEXT_OPEN,
  FORM_QUESTION_TYPE.SINGLE_SELECT,
  FORM_QUESTION_TYPE.MULTI_SELECT,
];
