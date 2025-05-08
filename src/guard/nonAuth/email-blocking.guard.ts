import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';

@Injectable()
export class EmailBlockingGuard implements CanActivate {
  private static caches = {
    failedLoginsByEmail: new LRUCache<string, number>({
      max: 5000,
      ttl: 60 * 60 * 1000,
      updateAgeOnGet: true,
    }),
    blockedEmails: new LRUCache<string, { expiresAt: number }>({
      max: 5000,
      ttl: 60 * 60 * 1000,
      updateAgeOnGet: true,
    }),
  };

  canActivate(context: ExecutionContext): boolean {
    const { email } = context.switchToHttp().getRequest().body;

    // Check if email is blocked
    const blockData = EmailBlockingGuard.caches.blockedEmails.get(email);
    if (blockData && Date.now() < blockData.expiresAt) {
      const remainingTime = Math.ceil((blockData.expiresAt - Date.now()) / 1000 / 60);
      throw new BadRequestException({
        status: 'error',
        message: 'EMAIL_BLOCKED',
        data: {
          remainingTime: `${remainingTime} minutes`,
          reason: 'MULTIPLE_FAILED_ATTEMPT',
        },
      });
    }

    return true;
  }

  trackFailedAttempt(email: string): void {
    const attempts = (EmailBlockingGuard.caches.failedLoginsByEmail.get(email) || 0) + 1;
    EmailBlockingGuard.caches.failedLoginsByEmail.set(email, attempts);

    if (attempts >= 5) {
      EmailBlockingGuard.caches.blockedEmails.set(email, {
        expiresAt: Date.now() + 60 * 60 * 1000,
      });
    }
  }

  resetAttempts(email: string): void {
    EmailBlockingGuard.caches.failedLoginsByEmail.delete(email);
    EmailBlockingGuard.caches.blockedEmails.delete(email);
  }
}

// import {

//   BadRequestException,
//   CanActivate,
//   ExecutionContext,
//   Injectable,
// } from "@nestjs/common";
// import { LRUCache } from "lru-cache";
// @Injectable()
// export class EmailBlockingGuard implements CanActivate {
//   private static failedLoginsByEmail: LRUCache<string, number>;
//   private static blockedEmails: LRUCache<string, { expiresAt: number }>;

//   constructor() {
//     if (!EmailBlockingGuard.failedLoginsByEmail) {
//       EmailBlockingGuard.failedLoginsByEmail = new LRUCache({
//         max: 5000,
//         ttl: 60 * 60 * 1000,
//         updateAgeOnGet: true,
//       });
//     }

//     if (!EmailBlockingGuard.blockedEmails) {
//       EmailBlockingGuard.blockedEmails = new LRUCache({
//         max: 5000,
//         ttl: 60 * 60 * 1000,
//         updateAgeOnGet: true,
//       });
//     }
//   }

//   canActivate(context: ExecutionContext): boolean {
//     const request = context.switchToHttp().getRequest();
//     const { email } = request.body;

//     const blockData = EmailBlockingGuard.blockedEmails.get(email);
//     if (blockData && Date.now() < blockData.expiresAt) {
//       throw new BadRequestException({
//         status: "error",
//         message: "EMAIL_BLOCKED",
//         data: {
//           remainingTime:
//             Math.ceil((blockData.expiresAt - Date.now()) / 1000 / 60) +
//             " minutes",
//           reason: "MULTIPLE_FAILED_ATTEMPT",
//         },
//       });
//     }

//     return true;
//   }

//   trackFailedAttempt(email: string): void {
//     const attempts =
//       (EmailBlockingGuard.failedLoginsByEmail.get(email) || 0) + 1;
//     EmailBlockingGuard.failedLoginsByEmail.set(email, attempts);

//     if (attempts >= 5) {
//       const blockData = { expiresAt: Date.now() + 60 * 60 * 1000 };
//       EmailBlockingGuard.blockedEmails.set(email, blockData);
//     }
//   }

//   resetAttempts(email: string): void {
//     EmailBlockingGuard.failedLoginsByEmail.delete(email);
//     EmailBlockingGuard.blockedEmails.delete(email);
//   }
// }
// // import {
// //   BadRequestException,
// //   CanActivate,
// //   ExecutionContext,
// //   Injectable,
// // } from "@nestjs/common";
// // import { LRUCache } from "lru-cache";

// // @Injectable()
// // export class EmailBlockingGuard implements CanActivate {
// //   public failedLoginsByEmail: LRUCache<string, number>;
// //   public blockedEmails: LRUCache<string, { expiresAt: number }>;

// //   constructor() {
// //     this.failedLoginsByEmail = new LRUCache({
// //       max: 5000,
// //       ttl: 60 * 60 * 1000,
// //       updateAgeOnGet: true,
// //     });
// //     this.blockedEmails = new LRUCache({
// //       max: 5000,
// //       ttl: 60 * 60 * 1000,
// //       updateAgeOnGet: true,
// //     });
// //   }

// //   canActivate(context: ExecutionContext): boolean {
// //     const request = context.switchToHttp().getRequest();
// //     const { email } = request.body;
// //     console.log({ email });
// //     console.log(`Curdfgdgdgdgdgdgdgdfgh: ${this.failedLoginsByEmail.size}`);
// //     const blockData = this.blockedEmails.get(email);
// //     console.log({ blockData });
// //     console.log("size", this.blockedEmails.size);
// //     console.log("dgdggfdsgsfg", this.blockedEmails.entries());
// //     const entries: any = [];

// //     for (const [email, record] of this.blockedEmails.entries()) {
// //       entries.push({ email, record });
// //     }
// //     console.log({ entries });
// //     if (blockData && Date.now() < blockData.expiresAt) {
// //       console.log("return email error message");
// //       throw new BadRequestException({
// //         status: "error",
// //         message: "EMAIL_BLOCKED",
// //         data: {
// //           remainingTime:
// //             Math.ceil((blockData.expiresAt - Date.now()) / 1000 / 60) +
// //             " minutes",
// //           reason: "MULTIPLE_FAILED_ATTEMPT",
// //         },
// //       });
// //     }

// //     return true;
// //   }

// //   trackFailedAttempt(email: string): void {
// //     console.log({ email });
// //     const attempts = (this.failedLoginsByEmail.get(email) || 0) + 1;
// //     console.log("emial attempts ", attempts);
// //     console.log("Cache before setting:", this.failedLoginsByEmail.entries());
// //     console.log(
// //       `Current number of blocked emails in LRU cache: ${this.failedLoginsByEmail.size}`
// //     );
// //     this.failedLoginsByEmail.set(email, attempts);
// //     console.log(
// //       `Current number of blocked emails in LRU cache: ${this.failedLoginsByEmail.size}`
// //     );

// //     console.log("Cache after setting:", this.failedLoginsByEmail.entries());

// //     if (attempts >= 5) {
// //       console.log("now email blocked");
// //       const blockData = { expiresAt: Date.now() + 60 * 60 * 1000 }; // 1 hour block
// //     //   console.log(
// //     //     "Current cache size before setting:",
// //     //     this.blockedEmails.size
// //     //   );
// //     //   console.log(
// //     //     "All blocked emails:",
// //     //     Array.from(this.blockedEmails.entries())
// //     //   );
// //     //   console.log("Checking specific email:", email);

// //     //   console.log("Cache before setting:", this.blockedEmails.entries());
// //       this.blockedEmails.set(email, blockData);
// //     //   console.log("Cache after setting:", this.blockedEmails.entries());
// //     //   console.log(`Blocked email set in LRU cache: ${email}`);
// //     //   console.log(
// //     //     `Blocked email value (expiresAt): ${JSON.stringify(blockData)}`
// //     //   );
// //     //   console.log(
// //     //     `Current number of blocked emails in LRU cache: ${this.blockedEmails.size}`
// //     //   );
// //     }
// //   }

// //   resetAttempts(email: string): void {
// //     this.failedLoginsByEmail.delete(email);
// //     this.blockedEmails.delete(email);
// //   }
// // }
