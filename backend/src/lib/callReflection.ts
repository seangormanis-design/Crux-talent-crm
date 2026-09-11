import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { getAnthropicClient, CLAUDE_MODEL } from "./anthropicClient";

export interface ReflectionContent {
  thinSections: { section: string; note: string }[];
  crossSignals: { observedIn: string; suggestion: string }[];
  coreQuestions: {
    whyItMatters: { addressed: boolean; note: string };
    whoToSpeakTo: { addressed: boolean; note: string };
    whyNow: { addressed: boolean; note: string };
    whatToSay: { addressed: boolean; note: string };
    whatsTheOutcome: { addressed: boolean; note: string };
  };
  summary: string;
}

const CORE_QUESTION_SHAPE = {
  type: "object",
  properties: {
    addressed: { type: "boolean" },
    note: { type: "string" },
  },
  required: ["addressed", "note"],
  additionalProperties: false,
} as const;

const REFLECTION_TOOL: Anthropic.Tool = {
  name: "record_reflection",
  description: "Record a constructive, private reflection on a Qualification Call.",
  input_schema: {
    type: "object",
    properties: {
      thinSections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            section: {
              type: "string",
              description: "Which template section this concerns (Present, Past, Future, AOB, Threats, Leads, or Personal info)",
            },
            note: { type: "string", description: "Why this section seems thin or generic compared to the others" },
          },
          required: ["section", "note"],
          additionalProperties: false,
        },
      },
      crossSignals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            observedIn: { type: "string", description: "Which section the signal was noticed in" },
            suggestion: { type: "string", description: "A question probably worth asking in another section as a result" },
          },
          required: ["observedIn", "suggestion"],
          additionalProperties: false,
        },
      },
      coreQuestions: {
        type: "object",
        properties: {
          whyItMatters: CORE_QUESTION_SHAPE,
          whoToSpeakTo: CORE_QUESTION_SHAPE,
          whyNow: CORE_QUESTION_SHAPE,
          whatToSay: CORE_QUESTION_SHAPE,
          whatsTheOutcome: CORE_QUESTION_SHAPE,
        },
        required: ["whyItMatters", "whoToSpeakTo", "whyNow", "whatToSay", "whatsTheOutcome"],
        additionalProperties: false,
      },
      summary: {
        type: "string",
        description: "A short, constructive closing note — never a score or judgement. Should naturally reflect whether this is based on a transcript or the note alone.",
      },
    },
    required: ["thinSections", "crossSignals", "coreQuestions", "summary"],
    additionalProperties: false,
  },
  strict: true,
};

const REFLECTION_SYSTEM_PROMPT = `You are a private call-review assistant for a recruiter at Crux Talent, reflecting on their own Qualification Call notes. This is never a score or performance judgement — always constructive and specific, like a thoughtful colleague pointing out what might be worth a second look.

The call follows a 7-section template: PRESENT (thoughts, feelings, pulse), PAST (experience, projects, skills, CV), FUTURE (motivations, plans, desires, what matters most), AOB (salary, notice period, visa status), THREATS (life-changing moments, other job offers, promotions, projects — anything that could derail a placement), LEADS (names of other people worth targeting, market intel, company signals), PERSONAL INFO (hobbies, family, personal context).

Assess substance, not just whether each section was filled in. Look for:
1. Sections that read thin or generic compared to the others — an area that may not have been explored as deeply.
2. Signals present in one section that suggest a question probably worth asking in another (e.g. a THREATS mention of "other interviews" with no corresponding FUTURE detail on how seriously they're being considered).
3. Whether the note addresses five core commercial questions: why this matters, who else should be spoken to, why now, what to say, what the outcome should be.

An empty thinSections or crossSignals array is a correct result when nothing stands out — don't invent observations to fill them.`;

export async function reflectOnCall(context: {
  personName: string;
  notes: string;
  transcript?: string | null;
  basis: "TRANSCRIPT" | "NOTE_ONLY";
  profileSummary?: string | null;
}): Promise<ReflectionContent> {
  const client = getAnthropicClient();

  const basisNote =
    context.basis === "TRANSCRIPT"
      ? "A full call transcript is provided below alongside the recruiter's written note — you can assess what was actually said, not just what was written down."
      : 'Only the recruiter\'s written note is available (no transcript) — you can only assess what was written down, not what was actually asked or said on the call. Frame observations accordingly (e.g. "the note doesn\'t mention X" rather than implying X wasn\'t discussed).';

  const profileNote = context.profileSummary
    ? `\n\nKnown patterns for this recruiter, from their reactions to past reflections — tailor your observations accordingly, and don't repeat feedback they've indicated isn't useful:\n${context.profileSummary}`
    : "";

  const userContent = [
    `Candidate: ${context.personName}`,
    "",
    "--- WRITTEN NOTE (Present/Past/Future/AOB/Threats/Leads/Personal info) ---",
    context.notes,
    context.transcript ? `\n--- CALL TRANSCRIPT ---\n${context.transcript}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 3000,
    output_config: { effort: "high" },
    system: `${REFLECTION_SYSTEM_PROMPT}\n\n${basisNote}${profileNote}`,
    messages: [{ role: "user", content: userContent }],
    tools: [REFLECTION_TOOL],
    tool_choice: { type: "tool", name: "record_reflection" },
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a structured reflection");
  return toolUse.input as ReflectionContent;
}

const PROFILE_TOOL: Anthropic.Tool = {
  name: "record_profile",
  description: "Record an updated rolling personal profile of a recruiter's call-review patterns.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "2-4 short paragraphs: patterns in what tends to be missed on calls, what's already done well, and what kinds of feedback have been dismissed as not useful.",
      },
    },
    required: ["summary"],
    additionalProperties: false,
  },
  strict: true,
};

export async function summarizeCallProfile(context: {
  priorSummary?: string | null;
  feedbackEntries: { reaction: "UP" | "DOWN"; comment?: string | null; reflectionSummary: string }[];
}): Promise<string> {
  const client = getAnthropicClient();

  const entriesText = context.feedbackEntries
    .map((e, i) => {
      const parts = [`${i + 1}. [${e.reaction === "UP" ? "helpful" : "not useful"}] on: "${e.reflectionSummary}"`];
      if (e.comment?.trim()) parts.push(`comment: "${e.comment.trim()}"`);
      return parts.join(" — ");
    })
    .join("\n");

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    output_config: { effort: "medium" },
    system:
      "You maintain a short rolling personal profile for a recruiter, summarising patterns in how they react to " +
      "AI call-review feedback. Merge new feedback into the existing profile rather than replacing it wholesale — " +
      "evolve it, keeping what's still true and adjusting what isn't. Keep it concise (2-4 short paragraphs).",
    messages: [
      {
        role: "user",
        content: [
          context.priorSummary ? `Existing profile:\n${context.priorSummary}` : "No existing profile yet.",
          "",
          "New feedback since the last update:",
          entriesText,
        ].join("\n"),
      },
    ],
    tools: [PROFILE_TOOL],
    tool_choice: { type: "tool", name: "record_profile" },
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a profile summary");
  return (toolUse.input as { summary: string }).summary;
}

const PROFILE_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

// Rolling, not append-only: regenerated in place from everything new since
// the last update, on a ~weekly cadence — triggered opportunistically right
// after feedback is saved, or manually via the "Refresh now" action.
export async function refreshCallProfileIfDue(
  prisma: PrismaClient,
  userId: string,
  options: { force?: boolean } = {}
): Promise<boolean> {
  const profile = await prisma.userCallProfile.findUnique({ where: { userId } });
  const since = profile?.updatedAt ?? new Date(0);

  const scopeFilter = { reflection: { interaction: { createdById: userId } } };

  const newFeedbackCount = await prisma.callReflectionFeedback.count({
    where: { createdAt: { gt: since }, ...scopeFilter },
  });
  if (newFeedbackCount === 0) return false;

  const isDue = options.force || !profile || profile.updatedAt.getTime() <= Date.now() - PROFILE_REFRESH_INTERVAL_MS;
  if (!isDue) return false;

  const entries = await prisma.callReflectionFeedback.findMany({
    where: { createdAt: { gt: since }, ...scopeFilter },
    include: { reflection: true },
    orderBy: { createdAt: "asc" },
  });

  const summary = await summarizeCallProfile({
    priorSummary: profile?.summary ?? null,
    feedbackEntries: entries.map((e) => ({
      reaction: e.reaction,
      comment: e.comment,
      reflectionSummary: (e.reflection.content as any)?.summary ?? "",
    })),
  });

  await prisma.userCallProfile.upsert({
    where: { userId },
    update: { summary },
    create: { userId, summary },
  });
  return true;
}
