-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "personalEmail" TEXT,
    "phoneMobile" TEXT,
    "phoneAlt" TEXT,
    "address" TEXT,
    "city" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyRelationship" TEXT,
    "professionalSummary" TEXT,
    "educationBackground" TEXT,
    "previousWorkExperience" TEXT,
    "skills" TEXT,
    "linkedInUrl" TEXT,
    "profilePhotoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProfileChangeLog_userId_idx" ON "ProfileChangeLog"("userId");

-- CreateIndex
CREATE INDEX "ProfileChangeLog_createdAt_idx" ON "ProfileChangeLog"("createdAt");
