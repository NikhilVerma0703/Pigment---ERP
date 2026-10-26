-- Numbered mixers + "Roymix Used".
--
-- A record now has N regular mixers (Mixer 1 … Mixer N) and, optionally, one
-- Roymix Mixer. Existing rows are converted, not dropped:
--   MIXER_1 → REGULAR 1,  MIXER_2 → REGULAR 2,  ROYMIX → ROYMIX 1
-- and each record's mixers_used / roymix_used are recomputed from its mixers.

-- CreateEnum
CREATE TYPE "MixerKind" AS ENUM ('REGULAR', 'ROYMIX');

-- Add the new columns (nullable until filled)
ALTER TABLE "production_mixers" ADD COLUMN "kind" "MixerKind",
ADD COLUMN "position" INTEGER;

UPDATE "production_mixers" SET
  "kind" = CASE "mixer" WHEN 'ROYMIX' THEN 'ROYMIX'::"MixerKind" ELSE 'REGULAR'::"MixerKind" END,
  "position" = CASE "mixer" WHEN 'MIXER_2' THEN 2 ELSE 1 END;

ALTER TABLE "production_mixers" ALTER COLUMN "kind" SET NOT NULL,
ALTER COLUMN "position" SET NOT NULL;

-- Drop the old column, its index and enum
DROP INDEX "production_mixers_record_id_mixer_key";
ALTER TABLE "production_mixers" DROP COLUMN "mixer";
DROP TYPE "MixerType";

-- CreateIndex
CREATE UNIQUE INDEX "production_mixers_record_id_kind_position_key" ON "production_mixers"("record_id", "kind", "position");

-- Record-level counts
ALTER TABLE "production_records" ADD COLUMN "roymix_used" BOOLEAN NOT NULL DEFAULT false;

UPDATE "production_records" r SET
  "roymix_used" = EXISTS (SELECT 1 FROM "production_mixers" m WHERE m."record_id" = r."id" AND m."kind" = 'ROYMIX'),
  "mixers_used" = (SELECT COUNT(*) FROM "production_mixers" m WHERE m."record_id" = r."id" AND m."kind" = 'REGULAR');
