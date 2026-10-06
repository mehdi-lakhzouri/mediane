-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "alertsSentAt" TIMESTAMP(3),
ADD COLUMN     "allClearSentAt" TIMESTAMP(3),
ADD COLUMN     "dispatchLeaseUntil" TIMESTAMP(3);
