-- DropForeignKey
ALTER TABLE "organization_subscriptions" DROP CONSTRAINT "organization_subscriptions_lastModifiedById_fkey";

-- AlterTable
ALTER TABLE "organization_subscriptions" ALTER COLUMN "lastModifiedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
