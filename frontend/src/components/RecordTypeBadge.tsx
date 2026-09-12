import { RECORD_KIND_BADGE_CLASS, RecordKind } from "../lib/recordColors";

// Tinted pill for "Also linked as X" style call-outs — see CLAUDE.md's
// record-type colour rule.
export default function RecordTypeBadge({
  kind,
  children,
  className = "",
}: {
  kind: RecordKind;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${RECORD_KIND_BADGE_CLASS[kind]} ${className}`}>{children}</span>
  );
}
