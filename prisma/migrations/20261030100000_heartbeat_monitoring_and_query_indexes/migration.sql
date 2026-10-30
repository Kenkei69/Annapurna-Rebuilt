-- CreateTable
CREATE TABLE "TelemetryScanCursor" (
    "id" TEXT NOT NULL DEFAULT 'gap-evaluation',
    "lastShipmentId" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastScanStartedAt" TIMESTAMP(3),
    "lastScanCompletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemetryScanCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Device_status_isSimulated_idx" ON "Device"("status", "isSimulated");

-- CreateIndex
CREATE INDEX "Shipment_status_latestRecordedAt_idx" ON "Shipment"("status", "latestRecordedAt");

-- CreateIndex
CREATE INDEX "Alert_shipmentId_ruleCode_status_idx" ON "Alert"("shipmentId", "ruleCode", "status");
