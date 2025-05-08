import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';

@Injectable()
export class UserBlockingGuard implements CanActivate {
  private static caches = {
    failedAttemptsByUser: new LRUCache<string, number>({
      max: 5000,
      ttl: 60 * 60 * 1000,
      updateAgeOnGet: true,
    }),
    blockedUsers: new LRUCache<string, { expiresAt: number }>({
      max: 5000,
      ttl: 60 * 60 * 1000,
      updateAgeOnGet: true,
    }),
  };

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientUser = request.user;

    const blockData = UserBlockingGuard.caches.blockedUsers.get(clientUser);
    if (blockData && Date.now() < blockData.expiresAt) {
      throw new BadRequestException({
        status: 'error',
        message: 'USER_BLOCKED',
        data: {
          remainingTime: Math.ceil((blockData.expiresAt - Date.now()) / 1000 / 60) + ' minutes',
          reason: 'MULTIPLE_FAILED_ATTEMPT',
        },
      });
    }

    return true;
  }

  trackFailedAttempt(userId: string): void {
    const attempts = (UserBlockingGuard.caches.failedAttemptsByUser.get(userId) || 0) + 1;
    UserBlockingGuard.caches.failedAttemptsByUser.set(userId, attempts);

    if (attempts >= 10) {
      UserBlockingGuard.caches.blockedUsers.set(userId, {
        expiresAt: Date.now() + 60 * 60 * 1000,
      }); // 60 minutes block
    }
  }

  resetAttempts(userId: string): void {
    UserBlockingGuard.caches.failedAttemptsByUser.delete(userId);
    UserBlockingGuard.caches.blockedUsers.delete(userId);
  }
}
