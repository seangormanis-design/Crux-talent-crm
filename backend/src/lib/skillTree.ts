import { PrismaClient } from "@prisma/client";

export interface SkillTreeNode {
  name: string;
  children?: SkillTreeNode[];
}

// Starter set only — deliberately not exhaustive. Azure and Data & AI are
// left flat (no children) pending a deliberate breakdown; the tree is meant
// to grow through the "add new skill" picker as it's actually used, not be
// hardcoded once here.
export const SKILL_TREE: SkillTreeNode[] = [
  {
    name: "D365 F&O",
    children: [
      { name: "Finance", children: [{ name: "General Ledger" }, { name: "Accounts Payable" }] },
      { name: "SCM" },
      { name: "HR" },
      { name: "Warehousing" },
    ],
  },
  {
    name: "D365 CE",
    children: [{ name: "Sales" }, { name: "Customer Service" }, { name: "Field Service" }, { name: "Marketing" }],
  },
  {
    name: "Power Platform",
    children: [{ name: "Power Apps" }, { name: "Power Automate" }, { name: "Power BI" }, { name: "Copilot Studio" }],
  },
  { name: "Azure" },
  { name: "Data & AI" },
];

// Upsert-by-name is what makes this safe to re-run: a name that already
// exists elsewhere in the tree (e.g. "Power BI" previously seeded as a
// flat top-level skill) gets reparented to its new designated place rather
// than duplicated, without touching any existing PersonSkill/Job links to it.
export async function seedSkillTree(prisma: PrismaClient, nodes: SkillTreeNode[] = SKILL_TREE, parentId: string | null = null) {
  for (const node of nodes) {
    const skill = await prisma.skill.upsert({
      where: { name: node.name },
      update: { parentId },
      create: { name: node.name, parentId },
    });
    if (node.children?.length) {
      await seedSkillTree(prisma, node.children, skill.id);
    }
  }
}
