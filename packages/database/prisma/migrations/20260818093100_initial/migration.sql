-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM (
  'DRAFT',
  'WAITING_BUYER',
  'WAITING_PAYMENT',
  'FUNDS_SECURED',
  'WAITING_SHIPMENT',
  'SHIPPED',
  'DELIVERED',
  'INSPECTION',
  'COMPLETED',
  'PROBLEM_REPORTED',
  'CANCELLED',
  'EXPIRED',
  'WAITING_LEGAL_RESOLUTION'
);

-- CreateEnum
CREATE TYPE "DealCategory" AS ENUM (
  'GOODS',
  'SERVICE',
  'REPAIR',
  'EQUIPMENT',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "DealRole" AS ENUM (
  'SELLER',
  'BUYER',
  'ADMIN',
  'SYSTEM'
);

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
  "id" TEXT NOT NULL,
  "publicCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "DealCategory" NOT NULL,
  "amountKzt" INTEGER NOT NULL,
  "platformFeeKzt" INTEGER NOT NULL,
  "inspectionHours" INTEGER NOT NULL DEFAULT 48,
  "status" "DealStatus" NOT NULL DEFAULT 'DRAFT',
  "sellerId" TEXT,
  "buyerId" TEXT,
  "acceptedBySellerAt" TIMESTAMP(3),
  "acceptedByBuyerAt" TIMESTAMP(3),
  "fundsSecuredAt" TIMESTAMP(3),
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "inspectionEndsAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealTerm" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DealTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalReference" TEXT,
  "amountKzt" INTEGER NOT NULL,
  "platformFeeKzt" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "rawPayloadHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "carrier" TEXT,
  "trackingNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'MANUAL',
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFile" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "uploadedBy" TEXT,
  "kind" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storageUrl" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealEvent" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" "DealRole" NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" "DealStatus",
  "toStatus" "DealStatus",
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DealEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_publicCode_key" ON "Deal"("publicCode");

-- CreateIndex
CREATE UNIQUE INDEX "DealTerm_dealId_version_key" ON "DealTerm"("dealId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalReference_key" ON "Payment"("externalReference");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealTerm" ADD CONSTRAINT "DealTerm_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
