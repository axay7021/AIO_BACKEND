// src/prisma/seeders/admin.seeder.ts
import { Injectable } from '@nestjs/common';
import { Seeder } from 'nestjs-seeder';
import { PrismaService } from '../../common/services/prisma.service';
import * as bcrypt from 'bcrypt';
import { Admin, Prisma } from '@prisma/client';

@Injectable()
export class AdminSeeder implements Seeder {
  constructor(private readonly prisma: PrismaService) {}

  async seed(): Promise<void> {
    const adminEmail: string = process.env.ADMIN_EMAIL || 'admin@prisma.com';
    const adminPassword: string = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminFirstName: string = process.env.ADMIN_FIRST_NAME || 'Super';
    const adminLastName: string = process.env.ADMIN_LAST_NAME || 'Admin';

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be defined in .env file');
    }

    try {
      const existingAdmin: Admin | null = await this.prisma.admin.findUnique({
        where: { email: adminEmail },
      });

      if (existingAdmin) {
        return;
      }

      const hashedPassword: string = await bcrypt.hash(adminPassword, 10);

      const adminData: Prisma.AdminCreateInput = {
        email: adminEmail,
        password: hashedPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
      };

      const admin: Admin = await this.prisma.admin.create({
        data: adminData,
      });

      // console.log('Admin seeded successfully:', admin.email);
    } catch (error) {
      console.error(
        'Error seeding admin:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  async drop(): Promise<void> {
    // Optional: Implement if you need to remove seeded data
    // await this.prisma.admin.deleteMany({});
  }
}
