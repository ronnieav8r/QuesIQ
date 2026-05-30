import Image from "next/image";

import officialBadge from "@/features/study/assets/official_badge.png";
import verifiedBadge from "@/features/study/assets/verified_badge.png";

type StudyTrustBadgeProps = {
  compact?: boolean;
  type: "official" | "verified";
};

const BADGES = {
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
  const badge = BADGES[type];
  const size = compact ? 42 : 58;

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
