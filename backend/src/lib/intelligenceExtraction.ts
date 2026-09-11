import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, CLAUDE_MODEL } from "./anthropicClient";

export interface ExtractedIntelligence {
  peopleMentioned: string[];
  companiesMentioned: string[];
  marketSignals: string[];
  followUpActions: string[];
  notableQuotes: string[];
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "record_intelligence",
  description: "Record structured intelligence extracted from CRM interaction notes.",
  input_schema: {
    type: "object",
    properties: {
      peopleMentioned: {
        type: "array",
        items: { type: "string" },
        description:
          "Names of people mentioned in the notes other than the primary contact this interaction is logged against, each with brief context.",
      },
      companiesMentioned: {
        type: "array",
        items: { type: "string" },
        description: "Companies mentioned in the notes, with brief context.",
      },
      marketSignals: {
        type: "array",
        items: { type: "string" },
        description: "Market intelligence: rate/salary benchmarks, demand signals, competitor moves, hiring trends.",
      },
      followUpActions: {
        type: "array",
        items: { type: "string" },
        description: "Concrete next steps or follow-ups implied by the notes.",
      },
      notableQuotes: {
        type: "array",
        items: { type: "string" },
        description: "Direct or closely paraphrased quotes worth remembering verbatim.",
      },
    },
    required: ["peopleMentioned", "companiesMentioned", "marketSignals", "followUpActions", "notableQuotes"],
    additionalProperties: false,
  },
  strict: true,
};

export async function extractIntelligence(context: {
  personName: string;
  personType: string;
  companyName?: string | null;
  jobTitle?: string | null;
  notes: string;
}): Promise<ExtractedIntelligence> {
  const client = getAnthropicClient();

  const contextLines = [
    `Primary contact: ${context.personName} (${context.personType === "CANDIDATE" ? "Candidate" : "Client contact"})`,
    context.companyName ? `Company: ${context.companyName}` : null,
    context.jobTitle ? `Related job: ${context.jobTitle}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    output_config: { effort: "high" },
    system:
      "You are an assistant for Crux Talent, a recruitment CRM. Extract structured intelligence from " +
      "interaction notes so nothing useful gets lost in a wall of text. Be conservative — only include " +
      "items genuinely supported by the notes. Empty arrays are correct when nothing applies; don't " +
      "invent content to fill a category.",
    messages: [{ role: "user", content: `${contextLines}\n\n--- NOTES ---\n${context.notes}` }],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "record_intelligence" },
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return structured intelligence");

  return toolUse.input as ExtractedIntelligence;
}
