-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('scheduled', 'sent', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "CampaignAudience" AS ENUM ('all', 'baby_below_12m', 'missing_next_dose', 'custom');

-- DropIndex
DROP INDEX "kb_chunks_embedding_hnsw_idx";

-- CreateTable
CREATE TABLE "patient_vaccinations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "vaccineId" UUID,
    "vaccineSlug" TEXT NOT NULL,
    "dose" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "nextDueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_vaccinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_reminders" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "vaccineSlug" TEXT NOT NULL,
    "dose" INTEGER NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'scheduled',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccination_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "audience" "CampaignAudience" NOT NULL DEFAULT 'all',
    "audienceFilter" JSONB NOT NULL DEFAULT '{}',
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "totalTargets" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_vaccinations_tenantId_patientId_idx" ON "patient_vaccinations"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "patient_vaccinations_nextDueAt_idx" ON "patient_vaccinations"("nextDueAt");

-- CreateIndex
CREATE INDEX "vaccination_reminders_tenantId_status_scheduledFor_idx" ON "vaccination_reminders"("tenantId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "vaccination_reminders_patientId_idx" ON "vaccination_reminders"("patientId");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_status_idx" ON "campaigns"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "patient_vaccinations" ADD CONSTRAINT "patient_vaccinations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_vaccinations" ADD CONSTRAINT "patient_vaccinations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_vaccinations" ADD CONSTRAINT "patient_vaccinations_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "vaccines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_reminders" ADD CONSTRAINT "vaccination_reminders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_reminders" ADD CONSTRAINT "vaccination_reminders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
