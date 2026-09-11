-- CreateTable
CREATE TABLE "interaction_intelligence" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "peopleMentioned" JSONB NOT NULL,
    "companiesMentioned" JSONB NOT NULL,
    "marketSignals" JSONB NOT NULL,
    "followUpActions" JSONB NOT NULL,
    "notableQuotes" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interaction_intelligence_interactionId_key" ON "interaction_intelligence"("interactionId");

-- AddForeignKey
ALTER TABLE "interaction_intelligence" ADD CONSTRAINT "interaction_intelligence_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
