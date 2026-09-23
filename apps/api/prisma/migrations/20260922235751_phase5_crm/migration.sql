-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DISQUALIFIED');

-- DropIndex
DROP INDEX "Lead_ownerId_idx";

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "leadId" TEXT,
ALTER COLUMN "dealId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "orderId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "edrpou" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "segment" "Segment" NOT NULL DEFAULT 'B2C',
ADD COLUMN     "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "leadId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_orgId_key" ON "Company"("orgId");

-- CreateIndex
CREATE INDEX "Company_edrpou_idx" ON "Company"("edrpou");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_key" ON "Contact"("userId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_orderId_key" ON "Deal"("orderId");

-- CreateIndex
CREATE INDEX "Lead_ownerId_status_idx" ON "Lead"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_done_idx" ON "Task"("assigneeId", "done");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

