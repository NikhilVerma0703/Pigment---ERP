-- CreateEnum
CREATE TYPE "StockEntryKind" AS ENUM ('INITIAL', 'ADDITION', 'ADJUSTMENT');

-- DropIndex
DROP INDEX "formulas_name_key_key";

-- AlterTable
ALTER TABLE "pigment_stock_entries" ADD COLUMN     "kind" "StockEntryKind" NOT NULL DEFAULT 'ADDITION',
ADD COLUMN     "note" TEXT;

-- CreateIndex
CREATE INDEX "formulas_name_key_idx" ON "formulas"("name_key");


-- Each pigment's earliest entry is its initial stock.
UPDATE "pigment_stock_entries" e SET "kind" = 'INITIAL'
WHERE e."id" = (
  SELECT x."id" FROM "pigment_stock_entries" x
  WHERE x."pigment_id" = e."pigment_id"
  ORDER BY x."date", x."created_at", x."id" LIMIT 1
);

-- Every saved formula gets a stock row, so its production is tracked.
INSERT INTO "pigment_stocks" ("id", "name", "name_key", "color", "created_at", "updated_at")
SELECT DISTINCT ON (f."name_key") 'fs_' || f."id", f."name", f."name_key", '#64748b', now(), now()
FROM "formulas" f
WHERE NOT EXISTS (SELECT 1 FROM "pigment_stocks" s WHERE s."name_key" = f."name_key")
ORDER BY f."name_key", f."created_at" DESC;
