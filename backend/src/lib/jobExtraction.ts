import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, CLAUDE_MODEL } from "./anthropicClient";

export interface ExtractedJobFields {
  title?: string;
  companyName?: string;
  location?: string;
  level?: string;
  workPreference?: "REMOTE" | "HYBRID" | "ONSITE";
  salaryMin?: number;
  salaryMax?: number;
  rateMin?: number;
  rateMax?: number;
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "record_job_fields",
  description: "Extract structured job posting fields from pasted job post text (e.g. copied from LinkedIn).",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "The job title. Empty string if not clearly stated." },
      companyName: { type: "string", description: "The hiring company's name. Empty string if not stated." },
      location: {
        type: "string",
        description: "Location as stated (city/region/country). Empty string if not given.",
      },
      level: {
        type: "string",
        description: "Seniority/level (e.g. 'Senior', 'Lead', 'Principal'). Empty string if not clear from the text.",
      },
      workPreference: {
        type: "string",
        enum: ["REMOTE", "HYBRID", "ONSITE", ""],
        description: "Work arrangement if the post states one; empty string if not mentioned.",
      },
      salaryMin: {
        type: "number",
        description:
          "Lower end of an annual salary range, only if the post states a salary (not a day/contract rate). " +
          "If only one figure is given, the same value as salaryMax. 0 if not applicable.",
      },
      salaryMax: {
        type: "number",
        description: "Upper end of an annual salary range. Same rules as salaryMin. 0 if not applicable.",
      },
      rateMin: {
        type: "number",
        description:
          "Lower end of a day/contract rate, only if the post states a rate instead of a salary. " +
          "If only one figure is given, the same value as rateMax. 0 if not applicable.",
      },
      rateMax: {
        type: "number",
        description: "Upper end of a day/contract rate. Same rules as rateMin. 0 if not applicable.",
      },
    },
    required: ["title", "companyName", "location", "level", "workPreference", "salaryMin", "salaryMax", "rateMin", "rateMax"],
    additionalProperties: false,
  },
  strict: true,
};

// Drafts structured Job fields from pasted post text — never writes to the
// database itself (same idiom as CV parsing). jobSpecText is deliberately
// NOT produced here: the caller (routes/jobs.ts) passes the raw pasted
// text straight through unchanged, since that's the one field a recruiter
// needs to trust literally rather than a paraphrased AI reading of it.
export async function extractJobFields(text: string): Promise<ExtractedJobFields> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    output_config: { effort: "high" },
    system:
      "You are an assistant for Crux Talent, a recruitment CRM. Extract structured fields from a pasted job " +
      "posting. Only extract what the text actually states — an empty string (or 0 for a numeric field) is " +
      "correct for anything not clearly present; never invent or estimate a figure. A posting usually states " +
      "either an annual salary or a day/contract rate, not both — populate only the pair that matches what's " +
      "actually written, leaving the other pair as 0/0.",
    messages: [{ role: "user", content: text }],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "record_job_fields" },
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return structured job fields");

  const raw = toolUse.input as Record<string, unknown>;
  const workPreference =
    raw.workPreference === "REMOTE" || raw.workPreference === "HYBRID" || raw.workPreference === "ONSITE"
      ? raw.workPreference
      : undefined;

  return {
    title: (raw.title as string) || undefined,
    companyName: (raw.companyName as string) || undefined,
    location: (raw.location as string) || undefined,
    level: (raw.level as string) || undefined,
    workPreference,
    salaryMin: (raw.salaryMin as number) || undefined,
    salaryMax: (raw.salaryMax as number) || undefined,
    rateMin: (raw.rateMin as number) || undefined,
    rateMax: (raw.rateMax as number) || undefined,
  };
}
