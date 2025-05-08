import { NestFactory } from '@nestjs/core';
import { PrismaService } from '../common/services/prisma.service';
import { AdminSeeder } from './seeders/admin.seeder';
import { PlanSeeder } from './seeders/plan.seeder';
import { PlanFeatureSeeder } from './seeders/planFeature.seeder';

// Create a module for seeding
import { Module } from '@nestjs/common';

@Module({
  providers: [PrismaService, AdminSeeder, PlanSeeder, PlanFeatureSeeder],
})
class SeedModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule);

  try {
    // Run seeders in the correct order
    const adminSeeder = app.get(AdminSeeder);
    await adminSeeder.seed();
    console.log('Admin seeding completed successfully');

    // Seed plans
    const planSeeder = app.get(PlanSeeder);
    await planSeeder.seed();
    console.log('Plan seeding completed successfully');

    // Finally, seed plan features (requires both plans and features)
    const planFeatureSeeder = app.get(PlanFeatureSeeder);
    await planFeatureSeeder.seed();
    console.log('Plan feature seeding completed successfully');

    console.log('All seeding completed successfully');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap()
  .then(() => {
    console.log('Seeding process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Seeding process failed:', error);
    process.exit(1);
  });
