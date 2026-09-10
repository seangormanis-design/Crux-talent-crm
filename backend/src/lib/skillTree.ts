import { PrismaClient } from "@prisma/client";

export interface SkillTreeNode {
  name: string;
  children?: SkillTreeNode[];
}

// Not meant to be exhaustive forever — the tree is meant to grow through
// the "add new skill" picker as it's actually used. This starter set covers
// the common areas within each Microsoft product/platform category.
export const SKILL_TREE: SkillTreeNode[] = [
  {
    name: "D365 F&O",
    children: [
      {
        name: "Finance",
        children: [
          { name: "General Ledger" },
          { name: "Accounts Payable" },
          { name: "Accounts Receivable" },
          { name: "Cash & Bank Management" },
          { name: "Budgeting" },
          { name: "Fixed Assets" },
          { name: "Cost Accounting" },
          { name: "Tax" },
        ],
      },
      {
        name: "SCM",
        children: [
          { name: "Inventory Management" },
          { name: "Master Planning" },
          { name: "Procurement & Sourcing" },
          { name: "Product Information Management" },
          { name: "Production Control/Manufacturing" },
          { name: "Warehouse Management" },
          { name: "Transportation Management" },
          { name: "Asset Management" },
          { name: "Service Management" },
        ],
      },
      { name: "Commerce" },
      { name: "HR" },
      { name: "Project Operations" },
      { name: "Warehousing" },
    ],
  },
  {
    name: "D365 CE",
    children: [
      { name: "Sales" },
      { name: "Customer Service" },
      { name: "Field Service" },
      { name: "Marketing" },
      { name: "Marketing/Customer Insights" },
      { name: "Project Operations" },
    ],
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
    children: [
      { name: "Power Apps" },
      { name: "Power Automate" },
      { name: "Power BI" },
      { name: "Copilot Studio" },
      { name: "Power Pages" },
      { name: "Dataverse" },
    ],
  },
  {
    name: "Azure",
    children: [
      { name: "Azure DevOps" },
      { name: "Integration (Logic Apps, Service Bus, API Management)" },
      { name: "Infrastructure (App Service, Functions, Entra ID)" },
      { name: "Security & Identity" },
    ],
  },
  {
    name: "Data & AI",
    children: [
      { name: "Microsoft Fabric" },
      { name: "Azure AI Foundry" },
      { name: "Azure Synapse Analytics" },
      { name: "Azure SQL/SQL Server" },
      { name: "Databricks" },
      { name: "Copilot (M365 Copilot, Copilot for D365)" },
    ],
  },
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
