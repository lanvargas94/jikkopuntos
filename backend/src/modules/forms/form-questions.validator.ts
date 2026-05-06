import { BadRequestException } from '@nestjs/common';
import { FORM_QUESTION_TYPE } from '../../common/constants/form-question-type';
export type QuestionWithOptions = {
  id: string;
  type: string;
  label: string;
  helpText: string | null;
  required: boolean;
  options: { id: string; label: string; value: string }[];
};

/** Validación estructural para publicar o guardar borrador coherente. */
export function assertQuestionsStructurallyValid(
  questions: QuestionWithOptions[],
): void {
  if (!questions.length) {
    throw new BadRequestException(
      'El formulario debe tener al menos una pregunta antes de publicar',
    );
  }
  const seenQ = new Set<string>();
  for (const q of questions) {
    if (!q.label?.trim()) {
      throw new BadRequestException('Cada pregunta debe tener un enunciado');
    }
    if (seenQ.has(q.id)) {
      throw new BadRequestException(`Id de pregunta duplicado: ${q.id}`);
    }
    seenQ.add(q.id);

    if (
      q.type !== FORM_QUESTION_TYPE.TEXT_OPEN &&
      q.type !== FORM_QUESTION_TYPE.SINGLE_SELECT &&
      q.type !== FORM_QUESTION_TYPE.MULTI_SELECT
    ) {
      throw new BadRequestException(`Tipo de pregunta no soportado: ${q.type}`);
    }

    if (q.type === FORM_QUESTION_TYPE.TEXT_OPEN) {
      if (q.options.length > 0) {
        throw new BadRequestException(
          `La pregunta "${q.label.slice(0, 40)}…" no debe tener opciones`,
        );
      }
      continue;
    }

    if (q.options.length < 2) {
      throw new BadRequestException(
        `Las preguntas de selección necesitan al menos 2 opciones: ${q.label.slice(0, 60)}`,
      );
    }
    const seenVal = new Set<string>();
    const seenOptId = new Set<string>();
    for (const o of q.options) {
      if (!o.label?.trim()) {
        throw new BadRequestException('Cada opción debe tener texto visible');
      }
      if (!o.value?.trim()) {
        throw new BadRequestException('Cada opción debe tener un valor interno');
      }
      if (seenVal.has(o.value)) {
        throw new BadRequestException(
          `Valores de opción duplicados en: ${q.label.slice(0, 40)}`,
        );
      }
      seenVal.add(o.value);
      if (seenOptId.has(o.id)) {
        throw new BadRequestException('Id de opción duplicado');
      }
      seenOptId.add(o.id);
    }
  }
}

export function validateAnswersAgainstQuestions(
  questions: QuestionWithOptions[],
  answers: Record<string, unknown>,
): void {
  const allowedKeys = new Set(questions.map((q) => q.id));

  for (const q of questions) {
    const raw = answers[q.id];
    const missing =
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && raw.trim() === '') ||
      (Array.isArray(raw) && raw.length === 0);

    if (q.required && missing) {
      throw new BadRequestException(`Falta respuesta obligatoria: ${q.label}`);
    }
    if (missing && !q.required) {
      continue;
    }

    if (q.type === FORM_QUESTION_TYPE.TEXT_OPEN) {
      if (typeof raw !== 'string') {
        throw new BadRequestException(`Respuesta de texto inválida: ${q.label}`);
      }
      continue;
    }

    const allowed = new Set(q.options.map((o) => o.value));

    if (q.type === FORM_QUESTION_TYPE.SINGLE_SELECT) {
      if (typeof raw !== 'string' || !allowed.has(raw)) {
        throw new BadRequestException(`Opción no válida en: ${q.label}`);
      }
      continue;
    }

    if (q.type === FORM_QUESTION_TYPE.MULTI_SELECT) {
      if (!Array.isArray(raw)) {
        throw new BadRequestException(`Se esperaba lista de opciones en: ${q.label}`);
      }
      for (const item of raw) {
        if (typeof item !== 'string' || !allowed.has(item)) {
          throw new BadRequestException(`Opción no válida en: ${q.label}`);
        }
      }
    }
  }

  for (const key of Object.keys(answers)) {
    if (!allowedKeys.has(key)) {
      throw new BadRequestException(`Campo de respuesta desconocido: ${key}`);
    }
  }
}
