import { NestFactory } from '@nestjs/core';
import { PrismaService } from '../common/services/prisma.service';
import { AdminSeeder } from './seeders/admin.seeder';

// Create a module for seeding
import { Module } from '@nestjs/common';

@Module({
  providers: [PrismaService, AdminSeeder],
})
class SeedModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule);

  try {
    // Run seeders in the correct order
    const adminSeeder = app.get(AdminSeeder);
    await adminSeeder.seed();
    // console.log('Admin seeding completed successfully');

    // console.log('All seeding completed successfully');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap()
  .then(() => {
    // console.log('Seeding process completed');
    process.exit(0);
  })
  .catch(error => {
    // console.error('Seeding process failed:', error);
    process.exit(1);
  });
