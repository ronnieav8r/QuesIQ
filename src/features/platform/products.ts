export type PlatformProductKey = "dpe" | "interview" | "study";

export type PlatformProduct = {
  description: string;
  href: string;
  key: PlatformProductKey;
  label: string;
  name: string;
  shortName: string;
  status: string;
};

export const platformProducts: PlatformProduct[] = [
  {
    description:
      "Voice-first interview practice, Story Lab, job targets, reviews, and coaching memory.",
    href: "/interview",
    key: "interview",
    label: "Open Interview",
    name: "QuesIQ Interview",
    shortName: "Interview",
    status: "Active",
  },
  {
    description: "Flashcards, study modes, public decks, import tools, and verbal review.",
    href: "/study",
    key: "study",
    label: "Open Study",
    name: "QuesIQ Study",
    shortName: "Study",
    status: "Import lane",
  },
  {
    description: "Private Pilot oral checkride preparation with DPE-owned practice data.",
    href: "/dpe",
    key: "dpe",
    label: "Open DPE",
    name: "QuesIQ DPE",
    shortName: "DPE",
    status: "Import lane",
  },
];

export function getSafeProductHref(value?: string | null) {
  const product = platformProducts.find(
    (item) => item.key === value || item.href === value,
  );

  return product?.href ?? "/";
}

export function getSafeNextPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
