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
    name: "Business Central",
    children: [
      { name: "Finance" },
      { name: "Sales & Purchasing" },
      { name: "Inventory & Warehousing" },
      { name: "Manufacturing" },
      { name: "Service Management" },
      { name: "Power Platform Integration" },
    ],
  },
  {
    name: "Power Platform",
    children: [{ name: "Power Apps" }, { name: "Power Automate" }, { name: "Power BI" }, { name: "Copilot Studio" }],
  },
  { name: "Azure" },
  { name: "Data & AI" },
];

// Upsert-by-(parentId, name) is what makes this safe to re-run without
// duplicating anything already in place. Uniqueness is per-parent, so the
// same leaf name can exist under two different branches as distinct nodes
// (e.g. "Finance" under both D365 F&O and Business Central) — re-running
// this never merges or reparents those, it only fills in what's missing.
export async function seedSkillTree(prisma: PrismaClient, nodes: SkillTreeNode[] = SKILL_TREE, parentId: string | null = null) {
  for (const node of nodes) {
    // Prisma's compound-unique selector type doesn't accept null for a
    // nullable field (even though the DB constraint does), so a plain
    // upsert-by-compound-key isn't available for top-level (parentId: null)
    // nodes — find-then-create instead.
    const existing = await prisma.skill.findFirst({ where: { parentId, name: node.name } });
    const skill = existing ?? (await prisma.skill.create({ data: { name: node.name, parentId } }));
    if (node.children?.length) {
      await seedSkillTree(prisma, node.children, skill.id);
    }
  }
}
