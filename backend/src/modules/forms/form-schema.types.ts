export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'boolean';

export interface FormFieldDef {
  id: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  options?: string[];
}

export interface FormSchema {
  fields: FormFieldDef[];
}
