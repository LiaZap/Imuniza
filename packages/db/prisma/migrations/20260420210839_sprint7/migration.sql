-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'attended', 'no_show', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "conversationId" UUID,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "vaccineSlugs" TEXT[],
    "expectedValue" DECIMAL(10,2),
    "paidValue" DECIMAL(10,2),
    "notes" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccine_card_extractions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "conversationId" UUID,
    "sourceMessageId" TEXT,
    "extracted" JSONB NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaccine_card_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_tenantId_status_idx" ON "appointments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_scheduledFor_idx" ON "appointments"("scheduledFor");

-- CreateIndex
CREATE INDEX "vaccine_card_extractions_tenantId_reviewed_idx" ON "vaccine_card_extractions"("tenantId", "reviewed");

-- CreateIndex
CREATE INDEX "vaccine_card_extractions_patientId_idx" ON "vaccine_card_extractions"("patientId");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccine_card_extractions" ADD CONSTRAINT "vaccine_card_extractions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccine_card_extractions" ADD CONSTRAINT "vaccine_card_extractions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
