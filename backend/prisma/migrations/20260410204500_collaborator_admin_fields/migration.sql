-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "area" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_idNumber_key" ON "User"("idNumber");
