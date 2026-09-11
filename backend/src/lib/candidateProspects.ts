import { Prisma } from "@prisma/client";

// Called whenever a Job closes (stage becomes PLACED or REJECTED), from
// both the manual stage-change endpoint and placement creation (which also
// flips the job to PLACED). Every candidate on that job who reached
// Shortlisted-or-beyond — i.e. wasn't screened out (REJECTED) — but wasn't
// the eventual placement, gets a CandidateProspect row so their shortlisting
// history is still discoverable once the job itself is closed.
export async function recordProspectsForClosedJob(
  tx: Prisma.TransactionClient,
  jobId: string,
  companyId: string,
  placedCandidateId?: string | null
): Promise<void> {
  const pairings = await tx.jobCandidate.findMany({ where: { jobId } });

  const prospects = pairings.filter(
    (jc) => jc.stage !== "REJECTED" && jc.candidateId !== placedCandidateId
  );

  for (const jc of prospects) {
    await tx.candidateProspect.upsert({
      where: { candidateId_sourceJobId: { candidateId: jc.candidateId, sourceJobId: jobId } },
      create: { candidateId: jc.candidateId, sourceJobId: jobId, companyId, reachedStage: jc.stage },
      update: { reachedStage: jc.stage, companyId },
    });
  }
}
