-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "cargoWeightKg" DOUBLE PRECISION DEFAULT 1000.0;

-- AlterTable
ALTER TABLE "RescueOffer" ADD COLUMN IF NOT EXISTS "counterAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "counterNotes" TEXT,
ADD COLUMN IF NOT EXISTS "counteredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "counterStatus" TEXT,
ADD COLUMN IF NOT EXISTS "isPartnerApproved" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CargoPhoto" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "caption" TEXT,
    "aiVerdict" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargoPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IncidentAssessment" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "cargoPhotoId" TEXT,
    "riskLevel" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "advisoryQuestion" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "source" TEXT NOT NULL,
    "suggestedActions" TEXT NOT NULL,
    "draftDriverUpdate" TEXT,
    "uncertaintyNotes" TEXT,
    "warmingVelocity" DOUBLE PRECISION,
    "estimatedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CargoPhoto_shipmentId_idx" ON "CargoPhoto"("shipmentId");
CREATE INDEX IF NOT EXISTS "CargoPhoto_uploadedById_idx" ON "CargoPhoto"("uploadedById");
CREATE INDEX IF NOT EXISTS "IncidentAssessment_shipmentId_idx" ON "IncidentAssessment"("shipmentId");
CREATE INDEX IF NOT EXISTS "IncidentAssessment_cargoPhotoId_idx" ON "IncidentAssessment"("cargoPhotoId");
CREATE INDEX IF NOT EXISTS "IncidentAssessment_createdAt_idx" ON "IncidentAssessment"("createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CargoPhoto_shipmentId_fkey'
  ) THEN
    ALTER TABLE "CargoPhoto" ADD CONSTRAINT "CargoPhoto_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CargoPhoto_uploadedById_fkey'
  ) THEN
    ALTER TABLE "CargoPhoto" ADD CONSTRAINT "CargoPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IncidentAssessment_shipmentId_fkey'
  ) THEN
    ALTER TABLE "IncidentAssessment" ADD CONSTRAINT "IncidentAssessment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IncidentAssessment_cargoPhotoId_fkey'
  ) THEN
    ALTER TABLE "IncidentAssessment" ADD CONSTRAINT "IncidentAssessment_cargoPhotoId_fkey" FOREIGN KEY ("cargoPhotoId") REFERENCES "CargoPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
