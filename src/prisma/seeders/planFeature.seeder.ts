import { Injectable } from '@nestjs/common';
import { Seeder } from 'nestjs-seeder';
import { PrismaService } from '../../common/services/prisma.service';
import { FeatureType } from '@prisma/client';

@Injectable()
export class PlanFeatureSeeder implements Seeder {
  constructor(private readonly prisma: PrismaService) {}

  async seed(): Promise<void> {
    try {
      const existingPlanFeatures = await this.prisma.planFeature.count();

      if (existingPlanFeatures > 0) {
        console.log('Plan features already exist, skipping seed...');
        return;
      }

      // Get admin for reference
      const admin = await this.prisma.admin.findFirst({
        where: { role: 'SUPER_ADMIN' },
      });

      if (!admin) {
        throw new Error('No admin found. Please run the admin seeder first.');
      }

      // Define features and their types
      const featureDefinitions = {
        // Boolean features
        'Manage Leads and Customer Data': FeatureType.BOOLEAN,
        'Add and Manage Team Members': FeatureType.BOOLEAN,
        'Create Quick Reply Message Templates': FeatureType.BOOLEAN,
        'Organize Leads Using Custom Tags': FeatureType.BOOLEAN,
        'Track Sales Pipeline and Progress': FeatureType.BOOLEAN,
        'Manage and Track Support Tickets': FeatureType.BOOLEAN,
        'Access Business Insights Dashboard': FeatureType.BOOLEAN,
        'Export Business Reports and Data': FeatureType.BOOLEAN,
        'Bulk Import Leads from CSV File': FeatureType.BOOLEAN,
        'Set and Manage Task Reminders': FeatureType.BOOLEAN,
        'Schedule and Manage Business Events': FeatureType.BOOLEAN,
        'Sync Files with Google Drive': FeatureType.BOOLEAN,
        'Create and Manage Departments Easily': FeatureType.BOOLEAN,
        'Save and Store Business Images': FeatureType.BOOLEAN,
        'Sync Conversations Across Multiple Devices': FeatureType.BOOLEAN,
        'Integrate and Manage Facebook Lead': FeatureType.BOOLEAN,
        'Sync Events with Google Calendar': FeatureType.BOOLEAN,
      };

      // Find plans (Standard and Premium)
      const plans = await this.prisma.plan.findMany();
      const standardPlans = plans.filter(plan => plan.name === 'Standard');
      const premiumPlans = plans.filter(plan => plan.name === 'Premium');

      if (standardPlans.length === 0 || premiumPlans.length === 0) {
        throw new Error('Standard and Premium plans not found. Please run the plan seeder first.');
      }

      // Define which features are enabled for standard plan
      const basicPlanFeatures = [
        'Manage Leads and Customer Data',
        'Add and Manage Team Members',
        'Create Quick Reply Message Templates',
        'Organize Leads Using Custom Tags',
        'Track Sales Pipeline and Progress',
        'Manage and Track Support Tickets',
        'Access Business Insights Dashboard',
        'Export Business Reports and Data',
        'Bulk Import Leads from CSV File',
        'Set and Manage Task Reminders',
        'Schedule and Manage Business Events',
        'Sync Files with Google Drive',
        'Create and Manage Departments Easily',
        'Save and Store Business Images',
      ];

      // Premium plan has all features
      const premiumPlanFeatures = [
        ...basicPlanFeatures,
        'Sync Conversations Across Multiple Devices',
        'Integrate and Manage Facebook Lead',
        'Sync Events with Google Calendar',
      ];

      // Assign features to Standard plans
      for (const plan of standardPlans) {
        for (const featureName of basicPlanFeatures) {
          await this.prisma.planFeature.create({
            data: {
              planId: plan.id,
              featureName: featureName,
              featureType: featureDefinitions[featureName],
              isEnabled: true,
              adminId: admin.id,
              lastModifiedById: admin.id,
            },
          });
        }
        console.log(`Added features to plan: ${plan.name}`);
      }

      // Assign features to Premium plans
      for (const plan of premiumPlans) {
        for (const featureName of premiumPlanFeatures) {
          await this.prisma.planFeature.create({
            data: {
              planId: plan.id,
              featureName: featureName,
              featureType: featureDefinitions[featureName],
              isEnabled: true,
              adminId: admin.id,
              lastModifiedById: admin.id,
            },
          });
        }
        console.log(`Added features to plan: ${plan.name}`);
      }

      console.log('All plan features seeded successfully');
    } catch (error) {
      console.error(
        'Error seeding plan features:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  async drop(): Promise<void> {
    // Optional: Implement if you need to remove seeded data
    // await this.prisma.planFeature.deleteMany({});
  }
}
