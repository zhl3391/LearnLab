CREATE TYPE "EdgeReviewStatus" AS ENUM ('SOURCE', 'NEEDS_REVIEW', 'REVIEWED', 'REJECTED');
CREATE TYPE "EdgeReviewDecision" AS ENUM ('APPROVE', 'REJECT');

ALTER TABLE "LearningEdge"
ADD COLUMN "reviewStatus" "EdgeReviewStatus" NOT NULL DEFAULT 'SOURCE';

UPDATE "LearningEdge"
SET "reviewStatus" = CASE "metadata"->>'reviewStatus'
  WHEN 'NEEDS_REVIEW' THEN 'NEEDS_REVIEW'::"EdgeReviewStatus"
  WHEN 'REVIEWED' THEN 'REVIEWED'::"EdgeReviewStatus"
  WHEN 'REJECTED' THEN 'REJECTED'::"EdgeReviewStatus"
  ELSE 'SOURCE'::"EdgeReviewStatus"
END;

CREATE INDEX "LearningEdge_reviewStatus_idx" ON "LearningEdge"("reviewStatus");

CREATE TABLE "LearningEdgeReview" (
    "id" TEXT NOT NULL,
    "edgeId" TEXT NOT NULL,
    "decision" "EdgeReviewDecision" NOT NULL,
    "reviewer" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningEdgeReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LearningEdgeReview_edgeId_fkey" FOREIGN KEY ("edgeId") REFERENCES "LearningEdge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LearningEdgeReview_edgeId_createdAt_idx" ON "LearningEdgeReview"("edgeId", "createdAt");
