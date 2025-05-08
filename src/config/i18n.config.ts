import * as path from 'path';

import { I18nJsonLoader, I18nModule } from 'nestjs-i18n';

import { CustomHeaderResolver } from '../common/services/customHeader.service';
console.log(path.join(__dirname, '..', '..', '/i18n'));

export const i18nConfig = I18nModule.forRoot({
  fallbackLanguage: 'en',
  loaderOptions: {
    path:
      process.env.NODE_ENV === 'development'
        ? path.join(__dirname, '../../i18n') // src/i18n in development
        : path.join(__dirname, '../../i18n'),
    watch: process.env.NODE_ENV === 'development',
  },
  loader: I18nJsonLoader,
  resolvers: [
    {
      use: CustomHeaderResolver,
      options: ['en', 'es', 'fr', 'ja'], // supported languages
    },
  ],
  logging: process.env.NODE_ENV === 'development',
  // typesOutputPath: path.join(__dirname, '../generated/i18n.generated.ts'),
});
