-- CreateEnum
CREATE TYPE "ProtectionPlan" AS ENUM ('BASIC', 'EXTENDED');

-- CreateEnum
CREATE TYPE "DisputeAssistanceStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'SETTLEMENT_REACHED', 'CLOSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "protectionPlan" "ProtectionPlan" NOT NULL DEFAULT 'BASIC';

-- CreateTable
CREATE TABLE "DisputeAssistance" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "status" "DisputeAssistanceStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedByRole" "DealRole" NOT NULL,
  "quotedFeeKzt" INTEGER,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DisputeAssistance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DisputeAssistance_dealId_key" ON "DisputeAssistance"("dealId");

-- AddForeignKey
ALTER TABLE "DisputeAssistance" ADD CONSTRAINT "DisputeAssistance_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Evidence is now part of every deal. The temporary extension table is no longer needed.
DROP TABLE IF EXISTS "DealExtension";
DROP TYPE IF EXISTS "DealExtensionType";
