import type { SessionReviewDetail } from "@/product/interview-types";

type ReviewDetailSectionsProps = {
  detail?: SessionReviewDetail;
};

function ListBlock({ items, title }: { items: string[]; title: string }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="review-callout">
      <h3>{title}</h3>
      <ul className="review-detail-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ReviewDetailSections({ detail }: ReviewDetailSectionsProps) {
  if (!detail) {
    return null;
  }

  return (
    <>
      <ListBlock items={detail.strengths} title="What Worked" />
      <ListBlock items={detail.focusAreas} title="What To Sharpen" />
      <ListBlock items={detail.practicePlan} title="Practice Plan" />
      <ListBlock items={detail.followUpQuestions} title="Questions To Rehearse" />
      <ListBlock items={detail.evidence} title="Session Evidence" />
    </>
  );
}
