-- CreateTable
CREATE TABLE "pigment_stocks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pigment_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pigment_stock_entries" (
    "id" TEXT NOT NULL,
    "pigment_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "unit" "MeasurementUnit" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "quantity_kg" DECIMAL(18,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pigment_stock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pigment_stocks_name_key_key" ON "pigment_stocks"("name_key");

-- CreateIndex
CREATE INDEX "pigment_stock_entries_pigment_id_idx" ON "pigment_stock_entries"("pigment_id");

-- AddForeignKey
ALTER TABLE "pigment_stock_entries" ADD CONSTRAINT "pigment_stock_entries_pigment_id_fkey" FOREIGN KEY ("pigment_id") REFERENCES "pigment_stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
