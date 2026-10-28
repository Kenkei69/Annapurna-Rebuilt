-- AlterTable
ALTER TABLE "RescuePartnerProfile" ADD COLUMN     "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED_SELF_REPORTED',
ALTER COLUMN "facilityName" DROP NOT NULL,
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL,
ALTER COLUMN "capacityAvailableKg" DROP NOT NULL,
ALTER COLUMN "tempRangeMin" DROP NOT NULL,
ALTER COLUMN "tempRangeMax" DROP NOT NULL,
ALTER COLUMN "isActive" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "RescuePartnerProfile_onboardingComplete_idx" ON "RescuePartnerProfile"("onboardingComplete");

-- Invariant Check Constraints
ALTER TABLE "Shipment" ADD CONSTRAINT "chk_shipment_temp_range" CHECK ("tempMin" < "tempMax");
ALTER TABLE "RescuePartnerProfile" ADD CONSTRAINT "chk_partner_temp_range" CHECK ("tempRangeMin" IS NULL OR "tempRangeMax" IS NULL OR "tempRangeMin" < "tempRangeMax");
ALTER TABLE "RescuePartnerProfile" ADD CONSTRAINT "chk_partner_capacity" CHECK ("capacityAvailableKg" IS NULL OR "capacityAvailableKg" >= 0);
ALTER TABLE "RescueOffer" ADD CONSTRAINT "chk_offer_amount" CHECK ("offerAmount" > 0);
ALTER TABLE "RescueOffer" ADD CONSTRAINT "chk_offer_capacity" CHECK ("capacityOfferedKg" > 0);
ALTER TABLE "RescueOffer" ADD CONSTRAINT "chk_offer_eta" CHECK ("estimatedEtaMinutes" >= 0);
ALTER TABLE "RescueOpportunity" ADD CONSTRAINT "chk_opp_weight" CHECK ("cargoWeightKg" > 0);
ALTER TABLE "RescueOpportunity" ADD CONSTRAINT "chk_opp_temp_range" CHECK ("tempRequirementMin" < "tempRequirementMax");
