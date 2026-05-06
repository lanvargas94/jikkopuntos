import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function MatchField(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'matchField',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [related] = args.constraints as [string];
          const other = (args.object as Record<string, unknown>)[related];
          return typeof value === 'string' && value === other;
        },
        defaultMessage() {
          return 'La confirmación no coincide con la nueva contraseña';
        },
      },
    });
  };
}
