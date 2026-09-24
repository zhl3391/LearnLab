-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "topics" INTEGER NOT NULL,
    "nodes" INTEGER NOT NULL,
    "memberships" INTEGER NOT NULL,
    "edges" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportRun_source_version_idx" ON "ImportRun"("source", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRun_source_version_checksum_key" ON "ImportRun"("source", "version", "checksum");
