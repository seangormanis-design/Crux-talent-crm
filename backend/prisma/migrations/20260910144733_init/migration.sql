-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('PARTNER', 'ISV', 'CONSULTANCY', 'END_USER');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('PROSPECT', 'ACTIVE_CLIENT', 'DORMANT', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('CANDIDATE', 'CLIENT_CONTACT');

-- CreateEnum
CREATE TYPE "WorkPreference" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateEnum
CREATE TYPE "DecisionRole" AS ENUM ('HIRING_MANAGER', 'PRACTICE_LEAD', 'DELIVERY_DIRECTOR', 'HR', 'OTHER');

-- CreateEnum
CREATE TYPE "PersonSource" AS ENUM ('LINKEDIN', 'REFERRAL', 'INBOUND', 'SOURCED', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStage" AS ENUM ('POTENTIAL_LEAD', 'QUALIFIED', 'SPEC_TAKEN', 'CV_SOURCING', 'CVS_SENT', 'INTERVIEWING', 'OFFERED', 'PLACED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CandidateStage" AS ENUM ('SOURCED', 'CV_SENT', 'REJECTED', 'INTERVIEWING', 'OFFERED', 'PLACED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CANDIDATE_CV', 'CRUX_FORMATTED_CV', 'TERMS_OF_BUSINESS', 'COMPANY_DOC', 'JOB_SPEC', 'CONTRACTOR_CORP_DOC', 'OTHER');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('PHONE_CALL', 'VIDEO_MEETING', 'FACE_TO_FACE', 'QUALIFICATION_CALL', 'LINKEDIN_MESSAGE', 'EMAIL', 'TEXT');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('PERM_PERCENTAGE', 'CONTRACT_MARGIN', 'DAY_RATE_UPLIFT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('NOT_INVOICED', 'INVOICED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaggableType" AS ENUM ('PERSON', 'COMPANY', 'JOB', 'DOCUMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "companyType" "CompanyType",
    "size" TEXT,
    "hqLocation" TEXT,
    "relationshipStatus" "RelationshipStatus" NOT NULL DEFAULT 'PROSPECT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "personType" "PersonType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "currentEmployerId" TEXT,
    "currentTitle" TEXT,
    "seniority" TEXT,
    "dayRate" DECIMAL(10,2),
    "salaryExpectation" DECIMAL(10,2),
    "location" TEXT,
    "workPreference" "WorkPreference",
    "rightToWork" TEXT,
    "availability" TEXT,
    "motivationsText" TEXT,
    "companyId" TEXT,
    "jobTitle" TEXT,
    "decisionRole" "DecisionRole",
    "relationshipNotes" TEXT,
    "source" "PersonSource",
    "gdprConsent" BOOLEAN NOT NULL DEFAULT false,
    "gdprConsentNote" TEXT,
    "lawfulBasisNote" TEXT,
    "retentionReviewAt" TIMESTAMP(3),
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "linkedPersonId" TEXT,
    "isPrimaryLink" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_skills" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "person_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "level" TEXT,
    "location" TEXT,
    "workPreference" "WorkPreference",
    "salaryMin" DECIMAL(10,2),
    "salaryMax" DECIMAL(10,2),
    "rateMin" DECIMAL(10,2),
    "rateMax" DECIMAL(10,2),
    "stage" "JobStage" NOT NULL DEFAULT 'POTENTIAL_LEAD',
    "owningContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_candidates" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stage" "CandidateStage" NOT NULL DEFAULT 'SOURCED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_changes" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "jobCandidateId" TEXT,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "changedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "personId" TEXT,
    "companyId" TEXT,
    "jobId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personId" TEXT NOT NULL,
    "jobId" TEXT,
    "companyId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placements" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "feeType" "FeeType" NOT NULL,
    "feeValue" DECIMAL(12,2) NOT NULL,
    "invoiceStatus" "InvoiceStatus" NOT NULL DEFAULT 'NOT_INVOICED',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "renewalReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_links" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "taggableType" "TaggableType" NOT NULL,
    "taggableId" TEXT NOT NULL,
    "personId" TEXT,
    "companyId" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_fields" (
    "id" TEXT NOT NULL,
    "taggableType" "TaggableType" NOT NULL,
    "taggableId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_JobEssentialSkills" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_JobIdealSkills" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "people_personType_idx" ON "people"("personType");

-- CreateIndex
CREATE INDEX "people_companyId_idx" ON "people"("companyId");

-- CreateIndex
CREATE INDEX "people_currentEmployerId_idx" ON "people"("currentEmployerId");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "person_skills_personId_skillId_key" ON "person_skills"("personId", "skillId");

-- CreateIndex
CREATE INDEX "jobs_companyId_idx" ON "jobs"("companyId");

-- CreateIndex
CREATE INDEX "jobs_stage_idx" ON "jobs"("stage");

-- CreateIndex
CREATE INDEX "job_candidates_stage_idx" ON "job_candidates"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "job_candidates_jobId_candidateId_key" ON "job_candidates"("jobId", "candidateId");

-- CreateIndex
CREATE INDEX "stage_changes_jobId_idx" ON "stage_changes"("jobId");

-- CreateIndex
CREATE INDEX "stage_changes_jobCandidateId_idx" ON "stage_changes"("jobCandidateId");

-- CreateIndex
CREATE INDEX "documents_personId_idx" ON "documents"("personId");

-- CreateIndex
CREATE INDEX "documents_companyId_idx" ON "documents"("companyId");

-- CreateIndex
CREATE INDEX "documents_jobId_idx" ON "documents"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_versionNo_key" ON "document_versions"("documentId", "versionNo");

-- CreateIndex
CREATE INDEX "interactions_personId_idx" ON "interactions"("personId");

-- CreateIndex
CREATE INDEX "interactions_jobId_idx" ON "interactions"("jobId");

-- CreateIndex
CREATE INDEX "interactions_companyId_idx" ON "interactions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "placements_jobId_key" ON "placements"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tag_links_taggableType_taggableId_idx" ON "tag_links"("taggableType", "taggableId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_links_tagId_taggableType_taggableId_key" ON "tag_links"("tagId", "taggableType", "taggableId");

-- CreateIndex
CREATE INDEX "custom_fields_taggableType_taggableId_idx" ON "custom_fields"("taggableType", "taggableId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_fields_taggableType_taggableId_key_key" ON "custom_fields"("taggableType", "taggableId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "_JobEssentialSkills_AB_unique" ON "_JobEssentialSkills"("A", "B");

-- CreateIndex
CREATE INDEX "_JobEssentialSkills_B_index" ON "_JobEssentialSkills"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_JobIdealSkills_AB_unique" ON "_JobIdealSkills"("A", "B");

-- CreateIndex
CREATE INDEX "_JobIdealSkills_B_index" ON "_JobIdealSkills"("B");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_currentEmployerId_fkey" FOREIGN KEY ("currentEmployerId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_linkedPersonId_fkey" FOREIGN KEY ("linkedPersonId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_skills" ADD CONSTRAINT "person_skills_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_skills" ADD CONSTRAINT "person_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_owningContactId_fkey" FOREIGN KEY ("owningContactId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_candidates" ADD CONSTRAINT "job_candidates_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_candidates" ADD CONSTRAINT "job_candidates_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_changes" ADD CONSTRAINT "stage_changes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_changes" ADD CONSTRAINT "stage_changes_jobCandidateId_fkey" FOREIGN KEY ("jobCandidateId") REFERENCES "job_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_changes" ADD CONSTRAINT "stage_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placements" ADD CONSTRAINT "placements_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_links" ADD CONSTRAINT "tag_links_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_links" ADD CONSTRAINT "tag_links_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_links" ADD CONSTRAINT "tag_links_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_links" ADD CONSTRAINT "tag_links_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobEssentialSkills" ADD CONSTRAINT "_JobEssentialSkills_A_fkey" FOREIGN KEY ("A") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobEssentialSkills" ADD CONSTRAINT "_JobEssentialSkills_B_fkey" FOREIGN KEY ("B") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobIdealSkills" ADD CONSTRAINT "_JobIdealSkills_A_fkey" FOREIGN KEY ("A") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobIdealSkills" ADD CONSTRAINT "_JobIdealSkills_B_fkey" FOREIGN KEY ("B") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
