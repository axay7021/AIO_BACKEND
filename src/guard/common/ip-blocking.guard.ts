import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';

@Injectable()
export class IPBlockingGuard implements CanActivate {
  private static caches = {
    failedAttemptsByIP: new LRUCache<string, number>({
      max: 5000,
      ttl: 60 * 60 * 1000,
      updateAgeOnGet: true,
    }),
    blockedIPs: new LRUCache<string, { expiresAt: number }>({
      max: 5000,
      ttl: 60 * 60 * 1000,
      updateAgeOnGet: true,
    }),
  };

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientIP = request.ip;
    const blockData = IPBlockingGuard.caches.blockedIPs.get(clientIP);
    if (blockData && Date.now() < blockData.expiresAt) {
      throw new BadRequestException({
        status: 'error',
        message: 'IP_BLOCKED',
        data: {
          remainingTime: Math.ceil((blockData.expiresAt - Date.now()) / 1000 / 60) + ' minutes',
          reason: 'MULTIPLE_FAILED_ATTEMPT',
        },
      });
    }

    return true;
  }

  trackFailedAttempt(ip: string): void {
    const attempts = (IPBlockingGuard.caches.failedAttemptsByIP.get(ip) || 0) + 1;
    IPBlockingGuard.caches.failedAttemptsByIP.set(ip, attempts);

    if (attempts >= 10) {
      IPBlockingGuard.caches.blockedIPs.set(ip, {
        expiresAt: Date.now() + 30 * 60 * 1000,
      }); // 30 minutes block
    }
  }

  resetAttempts(ip: string): void {
    IPBlockingGuard.caches.failedAttemptsByIP.delete(ip);
    IPBlockingGuard.caches.blockedIPs.delete(ip);
  }
}
