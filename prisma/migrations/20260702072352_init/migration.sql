-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ConstraintType" AS ENUM ('DRAWING', 'MATERIAL', 'LABOUR', 'EQUIPMENT', 'APPROVAL', 'RFI', 'CLIENT_DECISION');

-- CreateEnum
CREATE TYPE "ConstraintStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "activityName" TEXT NOT NULL,
    "wbsCode" TEXT,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedFinish" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualFinish" TIMESTAMP(3),
    "originalDurationDays" INTEGER NOT NULL,
    "actualDurationDays" INTEGER,
    "status" "ActivityStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "responsibleEngineer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Constraint" (
    "id" SERIAL NOT NULL,
    "activityId" TEXT NOT NULL,
    "constraintType" "ConstraintType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ConstraintStatus" NOT NULL DEFAULT 'OPEN',
    "targetRemovalDate" TIMESTAMP(3) NOT NULL,
    "actualRemovalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Constraint_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Constraint" ADD CONSTRAINT "Constraint_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
