-- CreateEnum
CREATE TYPE "MixerType" AS ENUM ('MIXER_1', 'MIXER_2', 'ROYMIX');

-- CreateTable
CREATE TABLE "production_records" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "serial_no" INTEGER NOT NULL,
    "batch_number" TEXT NOT NULL,
    "loc_number" TEXT NOT NULL,
    "design_name" TEXT NOT NULL,
    "total_cycles" INTEGER NOT NULL,
    "mixers_used" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_mixers" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "mixer" "MixerType" NOT NULL,
    "cycle_time_changed" BOOLEAN NOT NULL DEFAULT false,
    "change_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "production_mixers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_cycle_changes" (
    "id" TEXT NOT NULL,
    "mixer_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "from_cycle" INTEGER NOT NULL,
    "to_cycle" INTEGER NOT NULL,

    CONSTRAINT "production_cycle_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_pigments" (
    "id" TEXT NOT NULL,
    "mixer_id" TEXT NOT NULL,
    "cycle_change_id" TEXT,
    "line_no" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "unit" "MeasurementUnit" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "formula_id" TEXT,

    CONSTRAINT "production_pigments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_materials" (
    "id" TEXT NOT NULL,
    "mixer_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "is_standard" BOOLEAN NOT NULL DEFAULT false,
    "unit" "MeasurementUnit" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "production_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_records_serial_no_key" ON "production_records"("serial_no");

-- CreateIndex
CREATE INDEX "production_records_date_idx" ON "production_records"("date");

-- CreateIndex
CREATE INDEX "production_records_batch_number_idx" ON "production_records"("batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "production_mixers_record_id_mixer_key" ON "production_mixers"("record_id", "mixer");

-- CreateIndex
CREATE UNIQUE INDEX "production_cycle_changes_mixer_id_seq_key" ON "production_cycle_changes"("mixer_id", "seq");

-- CreateIndex
CREATE INDEX "production_pigments_mixer_id_idx" ON "production_pigments"("mixer_id");

-- CreateIndex
CREATE INDEX "production_pigments_cycle_change_id_idx" ON "production_pigments"("cycle_change_id");

-- CreateIndex
CREATE INDEX "production_pigments_formula_id_idx" ON "production_pigments"("formula_id");

-- CreateIndex
CREATE INDEX "production_pigments_name_key_idx" ON "production_pigments"("name_key");

-- CreateIndex
CREATE INDEX "production_materials_mixer_id_idx" ON "production_materials"("mixer_id");

-- CreateIndex
CREATE INDEX "production_materials_name_key_idx" ON "production_materials"("name_key");

-- AddForeignKey
ALTER TABLE "production_mixers" ADD CONSTRAINT "production_mixers_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "production_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_cycle_changes" ADD CONSTRAINT "production_cycle_changes_mixer_id_fkey" FOREIGN KEY ("mixer_id") REFERENCES "production_mixers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_pigments" ADD CONSTRAINT "production_pigments_mixer_id_fkey" FOREIGN KEY ("mixer_id") REFERENCES "production_mixers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_pigments" ADD CONSTRAINT "production_pigments_cycle_change_id_fkey" FOREIGN KEY ("cycle_change_id") REFERENCES "production_cycle_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_pigments" ADD CONSTRAINT "production_pigments_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_mixer_id_fkey" FOREIGN KEY ("mixer_id") REFERENCES "production_mixers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
