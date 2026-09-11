-- CreateEnum
CREATE TYPE "ReflectionBasis" AS ENUM ('TRANSCRIPT', 'NOTE_ONLY');

-- CreateEnum
CREATE TYPE "FeedbackReaction" AS ENUM ('UP', 'DOWN');

-- AlterTable
ALTER TABLE "interactions" ADD COLUMN     "transcript" TEXT;

-- CreateTable
CREATE TABLE "call_reflections" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "basis" "ReflectionBasis" NOT NULL,
    "content" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_reflections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_reflection_feedback" (
    "id" TEXT NOT NULL,
    "reflectionId" TEXT NOT NULL,
    "reaction" "FeedbackReaction" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_reflection_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_call_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_call_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_reflections_interactionId_key" ON "call_reflections"("interactionId");

-- CreateIndex
CREATE UNIQUE INDEX "call_reflection_feedback_reflectionId_key" ON "call_reflection_feedback"("reflectionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_call_profiles_userId_key" ON "user_call_profiles"("userId");

-- AddForeignKey
ALTER TABLE "call_reflections" ADD CONSTRAINT "call_reflections_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_reflection_feedback" ADD CONSTRAINT "call_reflection_feedback_reflectionId_fkey" FOREIGN KEY ("reflectionId") REFERENCES "call_reflections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_call_profiles" ADD CONSTRAINT "user_call_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
