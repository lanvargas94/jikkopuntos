import { BadRequestException } from '@nestjs/common';
import type { FormFieldDef, FormFieldType, FormSchema } from './form-schema.types';

const ALLOWED: FormFieldType[] = [
  'text',
  'textarea',
  'number',
  'select',
  'boolean',
];

export function parseFormSchemaJson(raw: string): FormSchema {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('schemaJson inválido: no es JSON válido');
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { fields?: unknown }).fields)
  ) {
    throw new BadRequestException('schemaJson debe ser un objeto con array "fields"');
  }
  const fields = (parsed as { fields: unknown[] }).fields;
  if (fields.length === 0) {
    throw new BadRequestException('El formulario necesita al menos un campo');
  }
  const seen = new Set<string>();
  for (const f of fields) {
    assertFieldDef(f, seen);
  }
  return parsed as FormSchema;
}

function assertFieldDef(f: unknown, seen: Set<string>): asserts f is FormFieldDef {
  if (!f || typeof f !== 'object') {
    throw new BadRequestException('Definición de campo inválida');
  }
  const field = f as Record<string, unknown>;
  if (typeof field.id !== 'string' || !field.id.trim()) {
    throw new BadRequestException('Cada campo debe tener id (string no vacío)');
  }
  if (seen.has(field.id)) {
    throw new BadRequestException(`Id de campo duplicado: ${field.id}`);
  }
  seen.add(field.id);
  if (typeof field.label !== 'string' || !field.label.trim()) {
    throw new BadRequestException(`Campo ${field.id}: label obligatorio`);
  }
  if (
    typeof field.type !== 'string' ||
    !ALLOWED.includes(field.type as FormFieldType)
  ) {
    throw new BadRequestException(
      `Campo ${field.id}: type debe ser text|textarea|number|select|boolean`,
    );
  }
  if (field.type === 'select') {
    if (!Array.isArray(field.options) || field.options.length === 0) {
      throw new BadRequestException(`Campo ${field.id}: select requiere options no vacías`);
    }
    for (const o of field.options) {
      if (typeof o !== 'string') {
        throw new BadRequestException(`Campo ${field.id}: cada option debe ser string`);
      }
    }
  }
}

export function validateAnswersAgainstSchema(
  schema: FormSchema,
  answers: Record<string, unknown>,
): void {
  for (const field of schema.fields) {
    const val = answers[field.id];
    const missing =
      val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
    if (field.required && missing) {
      throw new BadRequestException(`Falta respuesta obligatoria: ${field.label}`);
    }
    if (missing && !field.required) {
      continue;
    }
    switch (field.type) {
      case 'text':
      case 'textarea':
        if (typeof val !== 'string') {
          throw new BadRequestException(`Texto inválido en: ${field.label}`);
        }
        break;
      case 'number': {
        const n = typeof val === 'number' ? val : Number(val);
        if (Number.isNaN(n)) {
          throw new BadRequestException(`Número inválido en: ${field.label}`);
        }
        break;
      }
      case 'boolean':
        if (typeof val !== 'boolean') {
          throw new BadRequestException(`Se esperaba booleano en: ${field.label}`);
        }
        break;
      case 'select': {
        if (typeof val !== 'string' || !field.options?.includes(val)) {
          throw new BadRequestException(`Opción no permitida en: ${field.label}`);
        }
        break;
      }
      default:
        break;
    }
  }
  for (const key of Object.keys(answers)) {
    if (!schema.fields.some((ff) => ff.id === key)) {
      throw new BadRequestException(`Campo de respuesta no existe en el formulario: ${key}`);
    }
  }
}
