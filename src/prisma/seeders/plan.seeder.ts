import { Injectable } from '@nestjs/common';
import { Seeder } from 'nestjs-seeder';
import { PrismaService } from '../../common/services/prisma.service';
import { Plan, PlanType } from '@prisma/client';

@Injectable()
export class PlanSeeder implements Seeder {
  constructor(private readonly prisma: PrismaService) {}

  async seed(): Promise<void> {
    try {
      const existingPlans = await this.prisma.plan.findMany({
        where: {
          OR: [{ name: 'Standard' }, { name: 'Premium' }],
        },
      });

      if (existingPlans.length > 0) {
        console.log('Plans already exist, skipping seed...');
        return;
      }

      // Get admin for reference
      const admin = await this.prisma.admin.findFirst({
        where: { role: 'SUPER_ADMIN' },
      });

      if (!admin) {
        throw new Error('No admin found. Please run the admin seeder first.');
      }

      // Define plan configurations
      const planConfigs = [
        {
          name: 'Standard',
          description: 'Basic features for small teams',
          planType: PlanType.STANDARD,
          monthlyPrice: 599,
          yearlyPrice: 479,
        },
        {
          name: 'Premium',
          description: 'Advanced features for growing teams',
          planType: PlanType.PREMIUM,
          monthlyPrice: 799,
          yearlyPrice: 639,
        },
      ];

      // Create plans
      for (const config of planConfigs) {
        const plan: Plan = await this.prisma.plan.create({
          data: {
            name: config.name,
            description: config.description,
            planType: config.planType,
            monthlyPrice: config.monthlyPrice,
            yearlyPrice: config.yearlyPrice,
            isActive: true,
            createdBy: { connect: { id: admin.id } },
            lastModifiedBy: { connect: { id: admin.id } },
            isPopular: config.name === 'Premium' ? true : false,
          },
        });

        console.log(
          `Plan seeded successfully: ${plan.name} with monthly price $${plan.monthlyPrice} and yearly price $${plan.yearlyPrice}`,
        );
      }

      console.log('All plans seeded successfully');
    } catch (error) {
      console.error(
        'Error seeding plans:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  async drop(): Promise<void> {
    // Optional: Implement if you need to remove seeded data
    // await this.prisma.plan.deleteMany({});
  }
}
