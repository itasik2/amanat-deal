-- Rename the initial counterparty-waiting status so it works for deals created by either side.
ALTER TYPE "DealStatus" RENAME VALUE 'WAITING_BUYER' TO 'WAITING_COUNTERPARTY';

-- Public deal parties are intentionally narrower than DealRole, which also contains ADMIN and SYSTEM.
CREATE TYPE "PartyRole" AS ENUM ('SELLER', 'BUYER');

ALTER TABLE "Deal"
ADD COLUMN "creatorRole" "PartyRole";

CREATE TABLE "DealInvitation" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "invitedRole" "PartyRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealInvitation_tokenHash_key" ON "DealInvitation"("tokenHash");
CREATE UNIQUE INDEX "DealInvitation_shortCode_key" ON "DealInvitation"("shortCode");
CREATE INDEX "DealInvitation_dealId_createdAt_idx" ON "DealInvitation"("dealId", "createdAt");
CREATE INDEX "DealInvitation_shortCode_expiresAt_idx" ON "DealInvitation"("shortCode", "expiresAt");

ALTER TABLE "DealInvitation"
ADD CONSTRAINT "DealInvitation_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
