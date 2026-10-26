-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('GRIT', 'POWDER', 'RESIN', 'CATALYST', 'COBALT', 'SILANE', 'OTHER');

-- AlterTable
ALTER TABLE "production_materials" ADD COLUMN     "category" "MaterialCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "color" TEXT,
ADD COLUMN     "item_name" TEXT,
ADD COLUMN     "percent" DECIMAL(9,3),
ADD COLUMN     "size" TEXT;


-- Existing rows: the six standard materials get their category from the name.
UPDATE "production_materials" SET "category" = CASE "name_key"
  WHEN 'grit' THEN 'GRIT'::"MaterialCategory"
  WHEN 'powder' THEN 'POWDER'::"MaterialCategory"
  WHEN 'resin' THEN 'RESIN'::"MaterialCategory"
  WHEN 'catalyst' THEN 'CATALYST'::"MaterialCategory"
  WHEN 'cobalt' THEN 'COBALT'::"MaterialCategory"
  WHEN 'silane' THEN 'SILANE'::"MaterialCategory"
  WHEN 'sealne' THEN 'SILANE'::"MaterialCategory"
  ELSE 'OTHER'::"MaterialCategory" END;
