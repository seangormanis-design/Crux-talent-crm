import { RECORD_KIND_DOT_CLASS, RECORD_KIND_LABEL, RecordKind } from "../lib/recordColors";

// Small coloured dot for record-type indication in tight spaces (list rows,
// kanban cards, timeline entries) — see CLAUDE.md's record-type colour rule.
export default function RecordTypeDot({ kind, className = "" }: { kind: RecordKind; className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${RECORD_KIND_DOT_CLASS[kind]} ${className}`}
      title={RECORD_KIND_LABEL[kind]}
    />
  );
}
