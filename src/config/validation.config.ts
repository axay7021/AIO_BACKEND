import { ValidationPipe } from '@nestjs/common';

export const setupValidation = (): ValidationPipe => {
  const validationOptions = {
    whitelist: true, // Automatically remove properties that are not decorated with validation decorators
  };
  return new ValidationPipe(validationOptions);
};
