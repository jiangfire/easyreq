-- CreateTable
CREATE TABLE "GlobalCounter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GlobalCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalCounter_name_key" ON "GlobalCounter"("name");

-- Add globalNumber as nullable first
ALTER TABLE "Requirement" ADD COLUMN "globalNumber" INTEGER;

-- Populate globalNumber for existing rows using row_number ordered by createdAt
UPDATE "Requirement" r
SET "globalNumber" = sub.rn
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
    FROM "Requirement"
) sub
WHERE r.id = sub.id;

-- Make globalNumber required
ALTER TABLE "Requirement" ALTER COLUMN "globalNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_globalNumber_key" ON "Requirement"("globalNumber");

-- Make projectId nullable
ALTER TABLE "Requirement" ALTER COLUMN "projectId" DROP NOT NULL;

-- Make project-specific number nullable
ALTER TABLE "Requirement" ALTER COLUMN "number" DROP NOT NULL;

-- CreateIndex for unassigned requirement queries
CREATE INDEX "Requirement_projectId_idx" ON "Requirement"("projectId");

-- Initialize global counter with the highest existing globalNumber
INSERT INTO "GlobalCounter" ("id", "name", "value")
VALUES (gen_random_uuid()::text, 'requirement', (SELECT COALESCE(MAX("globalNumber"), 0) FROM "Requirement"));
