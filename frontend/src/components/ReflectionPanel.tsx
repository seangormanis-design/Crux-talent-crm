import { useState } from "react";

const CORE_QUESTION_LABELS: Record<string, string> = {
  whyItMatters: "Why this matters",
  whoToSpeakTo: "Who else to speak to",
  whyNow: "Why now",
  whatToSay: "What to say",
  whatsTheOutcome: "What the outcome should be",
};

export default function ReflectionPanel({
  reflection,
  reflecting,
  onReflect,
  onFeedback,
}: {
  reflection: any;
  reflecting: boolean;
  onReflect: () => void;
  onFeedback: (reaction: "UP" | "DOWN", comment?: string) => Promise<void>;
}) {
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!reflection) {
    return (
      <button
        type="button"
        disabled={reflecting}
        onClick={onReflect}
        className="mt-1 text-xs text-purple-700 hover:underline disabled:opacity-50"
      >
        {reflecting ? "Reflecting..." : "Reflect on this call"}
      </button>
    );
  }

  const content = reflection.content ?? {};
  const feedback = reflection.feedback;

  async function submit(reaction: "UP" | "DOWN") {
    setSubmitting(true);
    try {
      await onFeedback(reaction, commenting ? comment.trim() || undefined : undefined);
      setCommenting(false);
      setComment("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 rounded border border-purple-200 bg-purple-50 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium text-purple-900">
          Private reflection{" "}
          <span className="font-normal text-purple-500">
            — {reflection.basis === "TRANSCRIPT" ? "based on full transcript" : "based on your note only"}
          </span>
        </p>
        <button
          type="button"
          disabled={reflecting}
          onClick={onReflect}
          className="text-purple-700 hover:underline disabled:opacity-50"
        >
          {reflecting ? "Reflecting..." : "Re-reflect"}
        </button>
      </div>

      {reflection.basis === "NOTE_ONLY" && (
        <p className="mb-2 text-purple-500">
          This can only assess what was written down, not what was actually asked or said on the call.
        </p>
      )}

      {content.thinSections?.length > 0 && (
        <div className="mb-2">
          <p className="font-medium text-purple-800">Areas that may not have been explored as deeply</p>
          <ul className="ml-3 list-disc text-purple-700">
            {content.thinSections.map((s: any, i: number) => (
              <li key={i}>
                <span className="font-medium">{s.section}:</span> {s.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.crossSignals?.length > 0 && (
        <div className="mb-2">
          <p className="font-medium text-purple-800">Worth connecting</p>
          <ul className="ml-3 list-disc text-purple-700">
            {content.crossSignals.map((s: any, i: number) => (
              <li key={i}>
                <span className="font-medium">{s.observedIn}:</span> {s.suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.coreQuestions && (
        <div className="mb-2">
          <p className="font-medium text-purple-800">The five core commercial questions</p>
          <ul className="ml-3 list-disc text-purple-700">
            {Object.entries(CORE_QUESTION_LABELS).map(([key, label]) => {
              const q = content.coreQuestions[key];
              if (!q) return null;
              return (
                <li key={key}>
                  <span className="font-medium">
                    {q.addressed ? "✓" : "○"} {label}:
                  </span>{" "}
                  {q.note}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {content.summary && <p className="mb-2 italic text-purple-800">{content.summary}</p>}

      <div className="border-t border-purple-200 pt-2">
        {feedback ? (
          <p className="text-purple-500">
            You marked this {feedback.reaction === "UP" ? "helpful 👍" : "not useful 👎"}
            {feedback.comment ? ` — "${feedback.comment}"` : ""}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-purple-500">Was this useful?</span>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit("UP")}
              className="rounded border border-purple-300 px-1.5 py-0.5 hover:bg-white disabled:opacity-50"
            >
              👍
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit("DOWN")}
              className="rounded border border-purple-300 px-1.5 py-0.5 hover:bg-white disabled:opacity-50"
            >
              👎
            </button>
            {!commenting ? (
              <button type="button" onClick={() => setCommenting(true)} className="text-purple-600 hover:underline">
                + add a comment
              </button>
            ) : (
              <input
                autoFocus
                className="flex-1 rounded border border-purple-300 px-2 py-1 text-xs"
                placeholder="e.g. already asked this, just didn't note it"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
