/*
  Warnings:

  - You are about to drop the column `emergencyContactName` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `emergencyContactPhone` on the `user_profiles` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SessionChannel" AS ENUM ('WEB', 'MOBILE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "EmergencyContactRelationship" AS ENUM ('SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'RELATIVE', 'FRIEND', 'COLLEAGUE', 'OTHER');

-- AlterTable
ALTER TABLE "refresh_sessions" ADD COLUMN     "channel" "SessionChannel" NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "user_profiles" DROP COLUMN "emergencyContactName",
DROP COLUMN "emergencyContactPhone",
ADD COLUMN     "avatarKey" VARCHAR(255),
ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "gender" "Gender";

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "relationship" "EmergencyContactRelationship" NOT NULL,
    "phoneNumber" VARCHAR(32) NOT NULL,
    "priority" SMALLINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emergency_contacts_profileId_priority_key" ON "emergency_contacts"("profileId", "priority");

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
