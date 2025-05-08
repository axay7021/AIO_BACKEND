-- DropForeignKey
ALTER TABLE "organization_subscriptions" DROP CONSTRAINT "organization_subscriptions_createdById_fkey";

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
