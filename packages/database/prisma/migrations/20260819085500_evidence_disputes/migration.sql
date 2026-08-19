-- Extend evidence metadata
ALTER TABLE "EvidenceFile"
  ADD COLUMN "uploaderRole" "DealRole" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
  ADD COLUMN "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "note" TEXT;

CREATE INDEX "EvidenceFile_dealId_createdAt_idx" ON "EvidenceFile"("dealId", "createdAt");

-- Dispute channel enums
CREATE TYPE "DisputeMessageType" AS ENUM ('MESSAGE', 'PROPOSAL', 'PROPOSAL_ACCEPTED', 'PROPOSAL_REJECTED', 'SYSTEM');
CREATE TYPE "SettlementType" AS ENUM ('FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_TO_SELLER', 'CUSTOM');

-- Immutable dispute messages / settlement proposals
CREATE TABLE "DisputeMessage" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "actorRole" "DealRole" NOT NULL,
  "messageType" "DisputeMessageType" NOT NULL DEFAULT 'MESSAGE',
  "body" TEXT NOT NULL,
  "settlementType" "SettlementType",
  "amountKzt" INTEGER,
  "evidenceId" TEXT,
  "proposalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DisputeMessage_dealId_createdAt_idx" ON "DisputeMessage"("dealId", "createdAt");
CREATE INDEX "DisputeMessage_proposalId_idx" ON "DisputeMessage"("proposalId");

ALTER TABLE "DisputeMessage"
  ADD CONSTRAINT "DisputeMessage_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DisputeMessage"
  ADD CONSTRAINT "DisputeMessage_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
