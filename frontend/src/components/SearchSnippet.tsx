// Renders a full-text search snippet from the backend (built with Postgres's
// ts_headline, using a plain-text `~~HL~~` marker instead of its default
// <b> tags — see backend/src/routes/search.ts). Splitting on the marker and
// rendering each piece as a plain text node means nothing extracted from an
// uploaded CV or note can ever be interpreted as markup, unlike
// dangerouslySetInnerHTML would allow.
export default function SearchSnippet({ text }: { text: string }) {
  const parts = text.split("~~HL~~");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-amber-200 px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
