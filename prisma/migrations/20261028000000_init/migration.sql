-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AnalysisState" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ComplaintStatus" AS ENUM ('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."ReviewState" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'APPROVED');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('CITIZEN', 'STAFF', 'ADMIN');

-- CreateTable
CREATE TABLE "public"."Attachment" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditEvent" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Complaint" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "serviceAreaId" TEXT NOT NULL,
    "categoryId" TEXT,
    "departmentId" TEXT,
    "citizenId" TEXT NOT NULL,
    "firstNoticedDate" TIMESTAMP(3),
    "status" "public"."ComplaintStatus" NOT NULL DEFAULT 'SUBMITTED',
    "analysisState" "public"."AnalysisState" NOT NULL DEFAULT 'PENDING',
    "reviewState" "public"."ReviewState" NOT NULL DEFAULT 'NOT_REQUIRED',
    "analysisProvider" TEXT,
    "analysisVersion" TEXT,
    "classificationConfidence" DOUBLE PRECISION,
    "aiRationale" TEXT,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "urgency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feasibility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overridePriority" DOUBLE PRECISION,
    "overrideUrgency" DOUBLE PRECISION,
    "overrideFeasibility" DOUBLE PRECISION,
    "overrideReason" TEXT,
    "overriddenById" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RateLimitRecord" (
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitRecord_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."RoutingRule" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "serviceAreaId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StatusHistory" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "fromStatus" "public"."ComplaintStatus",
    "toStatus" "public"."ComplaintStatus" NOT NULL,
    "note" TEXT,
    "isCitizenVisible" BOOLEAN NOT NULL DEFAULT true,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UploadGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "storageUrl" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'CITIZEN',
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_complaintId_idx" ON "public"."Attachment"("complaintId" ASC);

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "public"."AuditEvent"("actorId" ASC);

-- CreateIndex
CREATE INDEX "AuditEvent_complaintId_idx" ON "public"."AuditEvent"("complaintId" ASC);

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "public"."AuditEvent"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "public"."Category"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "public"."Category"("name" ASC);

-- CreateIndex
CREATE INDEX "Complaint_categoryId_idx" ON "public"."Complaint"("categoryId" ASC);

-- CreateIndex
CREATE INDEX "Complaint_citizenId_idx" ON "public"."Complaint"("citizenId" ASC);

-- CreateIndex
CREATE INDEX "Complaint_createdAt_idx" ON "public"."Complaint"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Complaint_departmentId_idx" ON "public"."Complaint"("departmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_reference_key" ON "public"."Complaint"("reference" ASC);

-- CreateIndex
CREATE INDEX "Complaint_reviewState_idx" ON "public"."Complaint"("reviewState" ASC);

-- CreateIndex
CREATE INDEX "Complaint_serviceAreaId_idx" ON "public"."Complaint"("serviceAreaId" ASC);

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "public"."Complaint"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "public"."Department"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "public"."Department"("name" ASC);

-- CreateIndex
CREATE INDEX "RateLimitRecord_expiresAt_idx" ON "public"."RateLimitRecord"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "RoutingRule_categoryId_idx" ON "public"."RoutingRule"("categoryId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RoutingRule_categoryId_serviceAreaId_key" ON "public"."RoutingRule"("categoryId" ASC, "serviceAreaId" ASC);

-- CreateIndex
CREATE INDEX "RoutingRule_departmentId_idx" ON "public"."RoutingRule"("departmentId" ASC);

-- CreateIndex
CREATE INDEX "RoutingRule_serviceAreaId_idx" ON "public"."RoutingRule"("serviceAreaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceArea_code_key" ON "public"."ServiceArea"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceArea_name_key" ON "public"."ServiceArea"("name" ASC);

-- CreateIndex
CREATE INDEX "StatusHistory_changedById_idx" ON "public"."StatusHistory"("changedById" ASC);

-- CreateIndex
CREATE INDEX "StatusHistory_complaintId_idx" ON "public"."StatusHistory"("complaintId" ASC);

-- CreateIndex
CREATE INDEX "UploadGrant_expiresAt_idx" ON "public"."UploadGrant"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "UploadGrant_pathname_idx" ON "public"."UploadGrant"("pathname" ASC);

-- CreateIndex
CREATE INDEX "UploadGrant_storageUrl_idx" ON "public"."UploadGrant"("storageUrl" ASC);

-- CreateIndex
CREATE INDEX "UploadGrant_userId_idx" ON "public"."UploadGrant"("userId" ASC);

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "public"."User"("departmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role" ASC);

-- AddForeignKey
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "public"."Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "public"."Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "public"."ServiceArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoutingRule" ADD CONSTRAINT "RoutingRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoutingRule" ADD CONSTRAINT "RoutingRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoutingRule" ADD CONSTRAINT "RoutingRule_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "public"."ServiceArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusHistory" ADD CONSTRAINT "StatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusHistory" ADD CONSTRAINT "StatusHistory_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "public"."Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

