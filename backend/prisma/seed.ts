import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { seedSkillTree } from "../src/lib/skillTree";
import { seedRoleTypes } from "../src/lib/roleTypes";

const prisma = new PrismaClient();

async function main() {
  const demoEmail = process.env.SEED_USER_EMAIL ?? "sean@cruxtalent.com";
  const demoPassword = process.env.SEED_USER_PASSWORD ?? "changeme123";

  await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      passwordHash: await hashPassword(demoPassword),
      name: "Sean Gorman",
    },
  });

  await seedSkillTree(prisma);
  await seedRoleTypes(prisma);
  const d365Fo = await prisma.skill.findUniqueOrThrow({ where: { name: "D365 F&O" } });
  const powerBi = await prisma.skill.findUniqueOrThrow({ where: { name: "Power BI" } });
  const solutionArchitect = await prisma.roleType.findUniqueOrThrow({ where: { name: "Solution Architect" } });

  const company = await prisma.company.create({
    data: {
      name: "Northwind Dynamics Partners",
      website: "https://northwind-example.com",
      industry: "Microsoft Partner",
      companyType: "PARTNER",
      size: "50-200",
      hqLocation: "Manchester, UK",
      relationshipStatus: "ACTIVE_CLIENT",
      notes: "Long-standing D365 F&O partner, quarterly hiring pattern.",
    },
  });

  const clientContact = await prisma.person.create({
    data: {
      personType: "CLIENT_CONTACT",
      firstName: "Jordan",
      surname: "Blake",
      workEmail: "jordan.blake@northwind-example.com",
      companyId: company.id,
      jobTitle: "Delivery Director",
      decisionRole: "DELIVERY_DIRECTOR",
      gdprConsent: true,
      source: "REFERRAL",
    },
  });

  const candidate = await prisma.person.create({
    data: {
      personType: "CANDIDATE",
      firstName: "Alex",
      surname: "Rivera",
      workEmail: "alex.rivera@example.com",
      currentTitle: "D365 F&O Solution Architect",
      seniority: "Senior",
      dayRate: 650,
      location: "Leeds, UK",
      workPreference: "HYBRID",
      rightToWork: "UK/EU",
      availability: "4 weeks notice",
      motivationsText: "Wants product-facing work and more architectural ownership.",
      gdprConsent: true,
      source: "LINKEDIN",
      skills: { create: [{ skillId: d365Fo.id, isPrimary: true }, { skillId: powerBi.id }] },
      roleTypes: { connect: [{ id: solutionArchitect.id }] },
    },
  });

  const job = await prisma.job.create({
    data: {
      title: "D365 F&O Solution Architect",
      companyId: company.id,
      level: "Senior",
      location: "Leeds / Hybrid",
      workPreference: "HYBRID",
      rateMin: 600,
      rateMax: 700,
      stage: "CV_SOURCING",
      owningContactId: clientContact.id,
      essentialSkills: { connect: [{ id: d365Fo.id }] },
      idealSkills: { connect: [{ id: powerBi.id }] },
      roleTypes: { connect: [{ id: solutionArchitect.id }] },
    },
  });

  const pairing = await prisma.jobCandidate.create({
    data: { jobId: job.id, candidateId: candidate.id, stage: "CV_SENT" },
  });

  await prisma.stageChange.createMany({
    data: [
      { jobId: job.id, toStage: "POTENTIAL_LEAD" },
      { jobId: job.id, fromStage: "POTENTIAL_LEAD", toStage: "QUALIFIED" },
      { jobId: job.id, fromStage: "QUALIFIED", toStage: "SPEC_TAKEN" },
      { jobId: job.id, fromStage: "SPEC_TAKEN", toStage: "CV_SOURCING" },
      { jobCandidateId: pairing.id, toStage: "SHORTLISTED" },
      { jobCandidateId: pairing.id, fromStage: "SHORTLISTED", toStage: "CV_SENT" },
    ],
  });

  await prisma.interaction.createMany({
    data: [
      {
        type: "QUALIFICATION_CALL",
        personId: candidate.id,
        jobId: job.id,
        notes: "Confirmed rate expectations and hybrid preference.",
      },
      {
        type: "EMAIL",
        personId: clientContact.id,
        jobId: job.id,
        companyId: company.id,
        notes: "Sent CV for Alex Rivera, awaiting feedback.",
      },
    ],
  });

  console.log("Seed complete. Login with:", demoEmail, "/", demoPassword);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
