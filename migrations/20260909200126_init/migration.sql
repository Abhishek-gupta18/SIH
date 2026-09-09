-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "corridorGeoJSON" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parcelCode" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "landType" TEXT NOT NULL,
    "areaAcres" DOUBLE PRECISION NOT NULL,
    "geometryGeoJSON" TEXT NOT NULL,
    "acquisitionStatus" TEXT NOT NULL,
    "ownershipConflict" BOOLEAN NOT NULL DEFAULT false,
    "litigationFlag" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonParcel" (
    "personId" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,

    CONSTRAINT "PersonParcel_pkey" PRIMARY KEY ("personId","parcelId")
);

-- CreateTable
CREATE TABLE "AcquisitionEvent" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "AcquisitionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compensation" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "amountEstimated" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,

    CONSTRAINT "Compensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RRRecord" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "RRRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScore" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "overallRisk" INTEGER NOT NULL,
    "factorsJSON" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,

    CONSTRAINT "RiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "corridorGeoJSON" TEXT NOT NULL,
    "affectedParcels" INTEGER NOT NULL,
    "affectedFamilies" INTEGER NOT NULL,
    "estimatedCompensation" DOUBLE PRECISION NOT NULL,
    "rrRisk" INTEGER NOT NULL,
    "legalRisk" INTEGER NOT NULL,
    "envRisk" INTEGER NOT NULL,
    "predictedDelayMonths" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "linkedCaseId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_parcelCode_key" ON "Parcel"("parcelCode");

-- CreateIndex
CREATE UNIQUE INDEX "Compensation_parcelId_key" ON "Compensation"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "RRRecord_parcelId_key" ON "RRRecord"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskScore_parcelId_key" ON "RiskScore"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonParcel" ADD CONSTRAINT "PersonParcel_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonParcel" ADD CONSTRAINT "PersonParcel_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquisitionEvent" ADD CONSTRAINT "AcquisitionEvent_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RRRecord" ADD CONSTRAINT "RRRecord_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScore" ADD CONSTRAINT "RiskScore_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
