-- AlterTable
ALTER TABLE "Application" ADD COLUMN "companyLogoPath" TEXT;
ALTER TABLE "Application" ADD COLUMN "companyLogoType" TEXT;

-- AlterTable
ALTER TABLE "DeletedApplication" ADD COLUMN "companyLogoPath" TEXT;
ALTER TABLE "DeletedApplication" ADD COLUMN "companyLogoType" TEXT;
