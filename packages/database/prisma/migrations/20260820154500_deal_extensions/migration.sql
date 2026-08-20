-- CreateEnum
CREATE TYPE "DealExtensionType" AS ENUM ('EVIDENCE');

-- CreateTable
CREATE TABLE "DealExtension" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "type" "DealExtensionType" NOT NULL,
  "enabledByRole" "DealRole" NOT NULL DEFAULT 'SYSTEM',
  "config" JSONB,
  "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DealExtension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealExtension_dealId_type_key" ON "DealExtension"("dealId", "type");

-- CreateIndex
CREATE INDEX "DealExtension_dealId_enabledAt_idx" ON "DealExtension"("dealId", "enabledAt");

-- AddForeignKey
ALTER TABLE "DealExtension" ADD CONSTRAINT "DealExtension_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
