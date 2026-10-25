-- AlterTable
ALTER TABLE "AlumniProfile"
ADD COLUMN "mentoringTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "professionalExperience" TEXT,
ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MentorshipMessage" (
    "id" TEXT NOT NULL,
    "mentorshipRequestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MentorshipMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerResource" (
    "id" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareerResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityRecommendation" (
    "id" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "company" VARCHAR(160) NOT NULL,
    "location" VARCHAR(160) NOT NULL,
    "type" "JobType" NOT NULL DEFAULT 'FULL_TIME',
    "url" VARCHAR(1000) NOT NULL,
    "details" VARCHAR(2000) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DriveVolunteer" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "note" VARCHAR(1000),
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DriveVolunteer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentorshipMessage_mentorshipRequestId_createdAt_idx" ON "MentorshipMessage"("mentorshipRequestId", "createdAt");
CREATE INDEX "CareerResource_status_createdAt_idx" ON "CareerResource"("status", "createdAt");
CREATE INDEX "CareerResource_alumniId_createdAt_idx" ON "CareerResource"("alumniId", "createdAt");
CREATE INDEX "OpportunityRecommendation_status_createdAt_idx" ON "OpportunityRecommendation"("status", "createdAt");
CREATE INDEX "OpportunityRecommendation_alumniId_createdAt_idx" ON "OpportunityRecommendation"("alumniId", "createdAt");
CREATE UNIQUE INDEX "DriveVolunteer_driveId_alumniId_key" ON "DriveVolunteer"("driveId", "alumniId");
CREATE INDEX "DriveVolunteer_status_createdAt_idx" ON "DriveVolunteer"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MentorshipMessage" ADD CONSTRAINT "MentorshipMessage_mentorshipRequestId_fkey" FOREIGN KEY ("mentorshipRequestId") REFERENCES "MentorshipRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorshipMessage" ADD CONSTRAINT "MentorshipMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerResource" ADD CONSTRAINT "CareerResource_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "AlumniProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerResource" ADD CONSTRAINT "CareerResource_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityRecommendation" ADD CONSTRAINT "OpportunityRecommendation_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "AlumniProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityRecommendation" ADD CONSTRAINT "OpportunityRecommendation_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DriveVolunteer" ADD CONSTRAINT "DriveVolunteer_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriveVolunteer" ADD CONSTRAINT "DriveVolunteer_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "AlumniProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
