import Image from "next/image";

import expertReviewedBadge from "@/features/study/assets/expert_reviewed_badge.png";
import officialBadge from "@/features/study/assets/official_badge.png";
import verifiedBadge from "@/features/study/assets/verified_badge.png";

type StudyTrustBadgeProps = {
  compact?: boolean;
  type: "expert" | "official" | "verified";
};

const BADGES = {
  expert: {
    alt: "Expert reviewed study content",
    label: "Expert Reviewed",
    src: expertReviewedBadge,
  },
  official: {
    alt: "Official QuesIQ content",
    label: "Official",
    src: officialBadge,
  },
  verified: {
    alt: "Verified study content",
    label: "Verified",
    src: verifiedBadge,
  },
} as const;

export function StudyTrustBadge({ compact = false, type }: StudyTrustBadgeProps) {
  const size = compact ? 42 : 58;
  const badge = BADGES[type];

  return (
    <span
      aria-label={badge.label}
      title={badge.alt}
      style={{
        alignItems: "center",
        display: "inline-flex",
        flexShrink: 0,
        height: `${size}px`,
        justifyContent: "center",
        width: `${size}px`,
      }}
    >
      <Image
        alt={badge.alt}
        height={size}
        priority={!compact}
        src={badge.src}
        style={{
          display: "block",
          height: "100%",
          objectFit: "contain",
          width: "100%",
        }}
        width={size}
      />
    </span>
  );
}
