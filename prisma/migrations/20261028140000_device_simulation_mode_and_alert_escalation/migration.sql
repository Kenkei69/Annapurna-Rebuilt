-- AlterTable
ALTER TABLE "Device" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "escalatedFromId" TEXT;

-- CreateIndex
CREATE INDEX "Alert_escalatedFromId_idx" ON "Alert"("escalatedFromId");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_escalatedFromId_fkey" FOREIGN KEY ("escalatedFromId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
