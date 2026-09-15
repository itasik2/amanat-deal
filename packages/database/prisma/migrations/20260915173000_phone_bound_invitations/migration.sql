-- Phone-first OTP authentication for the pilot.
CREATE TABLE "PhoneOtpChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhoneOtpChallenge_phone_key" ON "PhoneOtpChallenge"("phone");
CREATE INDEX "PhoneOtpChallenge_expiresAt_idx" ON "PhoneOtpChallenge"("expiresAt");

-- Invitations are addressed to one verified phone number. The actual
-- counterparty user is recorded only after OTP-authenticated acceptance.
ALTER TABLE "DealInvitation"
  ADD COLUMN "recipientPhone" TEXT,
  ADD COLUMN "claimedByUserId" TEXT;

CREATE INDEX "DealInvitation_recipientPhone_expiresAt_idx"
  ON "DealInvitation"("recipientPhone", "expiresAt");
CREATE INDEX "DealInvitation_claimedByUserId_idx"
  ON "DealInvitation"("claimedByUserId");

ALTER TABLE "DealInvitation"
  ADD CONSTRAINT "DealInvitation_claimedByUserId_fkey"
  FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
