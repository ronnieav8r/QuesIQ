export type StudyCardSourceForBack = {
  id: string;
  sourceLabel: string | null;
  sourceMetadata: Record<string, unknown> | null;
  sourceType: string;
  sourceUrl: string | null;
};

type StudyCardBackProps = {
  answer: string;
  className?: string;
  explanation?: string | null;
  sources?: StudyCardSourceForBack[];
};

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function additionalReferences(source: StudyCardSourceForBack) {
  const labels = stringList(source.sourceMetadata?.additionalReferenceLabels);
  const urls = stringList(source.sourceMetadata?.additionalReferenceUrls);
  const length = Math.max(labels.length, urls.length);

  return Array.from({ length }, (_, index) => ({
    label: labels[index] || urls[index] || `Additional reference ${index + 1}`,
    url: urls[index],
  }));
}

export function StudyCardBack({
  answer,
  className,
  explanation,
  sources = [],
}: StudyCardBackProps) {
  const publicSources = sources.filter(
    (source) =>
      source.sourceLabel ||
      source.sourceUrl ||
      stringValue(source.sourceMetadata?.referenceNote) ||
      additionalReferences(source).length > 0,
  );

  return (
    <div className={className ? `study-card-back ${className}` : "study-card-back"}>
      <section>
        <span className="study-card-back__label">Answer</span>
        <p className="study-card-back__answer">{answer}</p>
      </section>

      {explanation && (
        <section>
          <span className="study-card-back__label">Explanation</span>
          <p>{explanation}</p>
        </section>
      )}

      {publicSources.length > 0 && (
        <section className="study-card-references">
          <span className="study-card-back__label">Sources</span>
          {publicSources.map((source) => {
            const referenceNote = stringValue(source.sourceMetadata?.referenceNote);
            const refs = additionalReferences(source);

            return (
              <div className="study-card-reference-group" key={source.id}>
                {source.sourceLabel || source.sourceUrl ? (
                  source.sourceUrl ? (
                    <a href={source.sourceUrl} rel="noreferrer" target="_blank">
                      {source.sourceLabel || source.sourceUrl}
                    </a>
                  ) : (
                    <span>{source.sourceLabel}</span>
                  )
                ) : null}
                {referenceNote && <p>{referenceNote}</p>}
                {refs.length > 0 && (
                  <div className="study-card-additional-references">
                    <span>Additional References</span>
                    <ul>
                      {refs.map((reference, index) => (
                        <li key={`${source.id}-reference-${index}`}>
                          {reference.url ? (
                            <a href={reference.url} rel="noreferrer" target="_blank">
                              {reference.label}
                            </a>
                          ) : (
                            <span>{reference.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
