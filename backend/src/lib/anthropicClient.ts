import Anthropic from "@anthropic-ai/sdk";

// Lazily constructed (and lazily validated) rather than at module load —
// unlike JWT_SECRET, a missing key here should only break the specific
// AI-powered features that need it, not boot the whole server.
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your .env file to use AI-powered features (Extract Intelligence, call reflections)."
    );
  }
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export const CLAUDE_MODEL = "claude-opus-5";
