/*
  Warnings:

  - A unique constraint covering the columns `[subdomain]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "subdomain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_subdomain_key" ON "organizations"("subdomain");
