import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, CLAUDE_MODEL } from "./anthropicClient";
import { QualificationSections } from "./qualificationSections";

export interface ExtractedQualificationSections {
  qcPresent: string;
  qcPast: string;
  qcFuture: string;
  qcAob: string;
  qcThreats: string;
  qcLeads: string;
  qcPersonalInfo: string;
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "record_qualification_sections",
  description: "Draft the 7-section Qualification Call template from a call transcript.",
  input_schema: {
    type: "object",
    properties: {
      qcPresent: {
        type: "string",
        description: "Present: thoughts, feelings, pulse. Empty string if the transcript has nothing for this.",
      },
      qcPast: { type: "string", description: "Past: experience, projects, skills, CV." },
      qcFuture: { type: "string", description: "Future: motivations, plans, desires, what matters most." },
      qcAob: { type: "string", description: "AOB: salary, notice period, visa status." },
      qcThreats: {
        type: "string",
        description:
          "Threats: life-changing moments, other job offers, promotions, projects — anything that could derail a placement.",
      },
      qcLeads: { type: "string", description: "Leads: names of other people worth targeting, market intel, company signals." },
      qcPersonalInfo: { type: "string", description: "Personal info: hobbies, family, personal context worth remembering." },
    },
    required: ["qcPresent", "qcPast", "qcFuture", "qcAob", "qcThreats", "qcLeads", "qcPersonalInfo"],
    additionalProperties: false,
  },
  strict: true,
};

// Drafts all 7 sections from a transcript — never writes to the database
// itself (same idiom as CV parsing: the caller shows this as an editable,
// reviewable draft and only the user's explicit save persists anything).
// The recruiter's own existing text (if any) is shown to the model for
// context only, so it doesn't contradict what's already been written, but
// the model always drafts its own independent version of every section —
// merging/keeping/discarding is left entirely to the human reviewing both.
export async function extractQualificationSections(context: {
  personName: string;
  transcript: string;
  existingSections: QualificationSections;
}): Promise<ExtractedQualificationSections> {
  const client = getAnthropicClient();

  const existingLines = Object.entries(context.existingSections)
    .filter((entry): entry is [string, string] => !!entry[1]?.trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    output_config: { effort: "high" },
    system:
      "You are an assistant for Crux Talent, a recruitment CRM. Draft the 7-section Qualification Call " +
      "template from a call transcript, in the recruiter's own note-taking style — concise, factual, not a " +
      "verbatim transcript excerpt. An empty string is correct for a section when the transcript has nothing " +
      "that belongs there — don't invent content to fill it in." +
      (existingLines
        ? " The recruiter has already written some sections manually — draft your own independent version " +
          "from the transcript for every section regardless of what they already wrote; they will compare " +
          "both and decide what to keep themselves, so do not simply echo their existing text back."
        : ""),
    messages: [
      {
        role: "user",
        content: [
          `Candidate: ${context.personName}`,
          existingLines ? `\n--- RECRUITER'S EXISTING NOTES (for context only) ---\n${existingLines}` : null,
          `\n--- CALL TRANSCRIPT ---\n${context.transcript}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "record_qualification_sections" },
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a structured draft");

  return toolUse.input as ExtractedQualificationSections;
}
