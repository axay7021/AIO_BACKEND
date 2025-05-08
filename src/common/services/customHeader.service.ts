import { ExecutionContext, Injectable } from '@nestjs/common';
import { I18nResolver } from 'nestjs-i18n';

@Injectable()
export class CustomHeaderResolver implements I18nResolver {
  resolve(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    return request.headers.language;
  }
}
