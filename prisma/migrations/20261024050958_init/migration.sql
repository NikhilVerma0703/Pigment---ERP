-- CreateEnum
CREATE TYPE "FormulaType" AS ENUM ('LIQUID_VEIN', 'DRY_VEIN_PIGMENT', 'OTHERS');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('KG', 'GM');

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulas" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "serial_no" INTEGER NOT NULL,
    "formula_type" "FormulaType" NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "mixing_hours" INTEGER NOT NULL DEFAULT 0,
    "mixing_minutes" INTEGER NOT NULL DEFAULT 0,
    "total_quantity_used_kg" DECIMAL(18,6) NOT NULL,
    "total_quantity_required_kg" DECIMAL(18,3) NOT NULL,
    "consumption_rate" DECIMAL(18,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_items" (
    "id" TEXT NOT NULL,
    "formula_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "MeasurementUnit" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "required_quantity" DECIMAL(18,3) NOT NULL,
    "material_id" TEXT,
    "component_formula_id" TEXT,

    CONSTRAINT "formula_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "materials_name_key_key" ON "materials"("name_key");

-- CreateIndex
CREATE UNIQUE INDEX "formulas_serial_no_key" ON "formulas"("serial_no");

-- CreateIndex
CREATE UNIQUE INDEX "formulas_name_key_key" ON "formulas"("name_key");

-- CreateIndex
CREATE INDEX "formulas_date_idx" ON "formulas"("date");

-- CreateIndex
CREATE INDEX "formula_items_material_id_idx" ON "formula_items"("material_id");

-- CreateIndex
CREATE INDEX "formula_items_component_formula_id_idx" ON "formula_items"("component_formula_id");

-- CreateIndex
CREATE UNIQUE INDEX "formula_items_formula_id_line_no_key" ON "formula_items"("formula_id", "line_no");

-- AddForeignKey
ALTER TABLE "formula_items" ADD CONSTRAINT "formula_items_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "formulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_items" ADD CONSTRAINT "formula_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_items" ADD CONSTRAINT "formula_items_component_formula_id_fkey" FOREIGN KEY ("component_formula_id") REFERENCES "formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
