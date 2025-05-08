export const PrismaConstantValues = {
  Language: ['EN', 'JP'],
  Platform: ['WEBSITE', 'EXTENSION', 'APP'],
} as const;

export enum Platform {
  APP = 'APP',
  WEBSITE = 'WEBSITE',
  EXTENSION = 'EXTENSION',
}
