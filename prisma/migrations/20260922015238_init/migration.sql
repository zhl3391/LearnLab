-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('KNOWLEDGE', 'SKILL', 'APPLICATION');

-- CreateEnum
CREATE TYPE "Granularity" AS ENUM ('L1_DOMAIN', 'L2_CONCEPT', 'L3_CAPABILITY', 'L4_SPECIFIC');

-- CreateEnum
CREATE TYPE "EdgeType" AS ENUM ('PREREQUISITE', 'PART_OF', 'RELATED');

-- CreateEnum
CREATE TYPE "EdgeStrength" AS ENUM ('REQUIRED', 'IMPORTANT', 'HELPFUL');

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningNode" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "NodeType" NOT NULL,
    "granularity" "Granularity" NOT NULL,
    "difficulty" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicMembership" (
    "topicId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "TopicMembership_pkey" PRIMARY KEY ("topicId","nodeId")
);

-- CreateTable
CREATE TABLE "LearningEdge" (
    "id" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "type" "EdgeType" NOT NULL,
    "strength" "EdgeStrength" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Topic_parentId_idx" ON "Topic"("parentId");

-- CreateIndex
CREATE INDEX "LearningNode_type_idx" ON "LearningNode"("type");

-- CreateIndex
CREATE INDEX "LearningNode_granularity_idx" ON "LearningNode"("granularity");

-- CreateIndex
CREATE INDEX "TopicMembership_nodeId_idx" ON "TopicMembership"("nodeId");

-- CreateIndex
CREATE INDEX "LearningEdge_sourceNodeId_type_idx" ON "LearningEdge"("sourceNodeId", "type");

-- CreateIndex
CREATE INDEX "LearningEdge_targetNodeId_type_idx" ON "LearningEdge"("targetNodeId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "LearningEdge_sourceNodeId_targetNodeId_type_key" ON "LearningEdge"("sourceNodeId", "targetNodeId", "type");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMembership" ADD CONSTRAINT "TopicMembership_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMembership" ADD CONSTRAINT "TopicMembership_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "LearningNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEdge" ADD CONSTRAINT "LearningEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "LearningNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEdge" ADD CONSTRAINT "LearningEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "LearningNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
